import { audit, disconnectSocialAccount, listSocialAccounts, upsertSocialAccount } from "./db";
import { badRequest, jsonResponse, redirectResponse, utcNow } from "./http";
import { getRuntimeSettings } from "./settings";
import type { Env, Platform } from "./types";

type OAuthPlatform = Extract<Platform, "instagram" | "threads">;

interface ProviderConfig {
  platform: OAuthPlatform;
  clientId: string;
  clientSecret: string;
  scopes: string[];
  authUrl: string;
  tokenUrl: string;
}

interface TokenResponse {
  access_token?: string;
  token_type?: string;
  expires_in?: number;
  error?: { message?: string };
}

interface ThreadsMeResponse {
  id?: string;
  username?: string;
  error?: { message?: string };
}

interface InstagramPage {
  id?: string;
  name?: string;
  access_token?: string;
  instagram_business_account?: {
    id?: string;
    username?: string;
  };
}

interface InstagramPagesResponse {
  data?: InstagramPage[];
  error?: { message?: string };
}

const stateCookieName = "ap_oauth_state";

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function base64UrlDecode(value: string): Uint8Array {
  const normalized = value.replaceAll("-", "+").replaceAll("_", "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function encodeJson(value: unknown): string {
  return base64UrlEncode(new TextEncoder().encode(JSON.stringify(value)));
}

function decodeJson<T>(value: string): T {
  return JSON.parse(new TextDecoder().decode(base64UrlDecode(value))) as T;
}

async function hmac(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return base64UrlEncode(new Uint8Array(signature));
}

function stateSecret(env: Env): string {
  return env.OAUTH_STATE_SECRET ?? env.TOKEN_ENCRYPTION_KEY ?? env.META_APP_SECRET ?? env.INSTAGRAM_CLIENT_SECRET ?? "";
}

async function createState(env: Env, platform: OAuthPlatform): Promise<string> {
  const nonce = base64UrlEncode(crypto.getRandomValues(new Uint8Array(16)));
  const payload = encodeJson({ platform, nonce, createdAt: Date.now() });
  return `${payload}.${await hmac(stateSecret(env), payload)}`;
}

async function verifyState(env: Env, state: string): Promise<{ platform: OAuthPlatform }> {
  const [payload, signature] = state.split(".");
  if (!payload || !signature || signature !== (await hmac(stateSecret(env), payload))) {
    throw new Error("OAuth state validation failed.");
  }
  const decoded = decodeJson<{ platform?: string; createdAt?: number }>(payload);
  if (decoded.platform !== "instagram" && decoded.platform !== "threads") throw new Error("Unsupported OAuth platform.");
  if (!decoded.createdAt || Date.now() - decoded.createdAt > 10 * 60 * 1000) throw new Error("OAuth state expired.");
  return { platform: decoded.platform };
}

async function encryptionKey(secret: string): Promise<CryptoKey> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(secret));
  return crypto.subtle.importKey("raw", digest, { name: "AES-GCM" }, false, ["encrypt"]);
}

async function encryptToken(env: Env, token: string): Promise<string> {
  if (!env.TOKEN_ENCRYPTION_KEY || env.TOKEN_ENCRYPTION_KEY.length < 24) {
    throw new Error("TOKEN_ENCRYPTION_KEY secret is required before saving account tokens.");
  }
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await encryptionKey(env.TOKEN_ENCRYPTION_KEY), new TextEncoder().encode(token));
  return `${base64UrlEncode(iv)}.${base64UrlEncode(new Uint8Array(encrypted))}`;
}

function platformFromUrl(url: URL): OAuthPlatform | null {
  const platform = url.searchParams.get("platform");
  return platform === "instagram" || platform === "threads" ? platform : null;
}

async function providerConfig(env: Env, platform: OAuthPlatform): Promise<ProviderConfig | null> {
  const settings = await getRuntimeSettings(env);
  const metaClientId = settings.metaAppId;
  const metaClientSecret = settings.metaAppSecret;
  if (platform === "instagram") {
    return {
      platform,
      clientId: metaClientId,
      clientSecret: metaClientSecret,
      scopes: ["pages_show_list", "pages_read_engagement", "instagram_basic", "instagram_content_publish"],
      authUrl: "https://www.facebook.com/v20.0/dialog/oauth",
      tokenUrl: "https://graph.facebook.com/v20.0/oauth/access_token",
    };
  }

  return {
    platform,
    clientId: env.THREADS_CLIENT_ID ?? settings.metaAppId,
    clientSecret: env.THREADS_CLIENT_SECRET ?? settings.metaAppSecret,
    scopes: ["threads_basic", "threads_content_publish"],
    authUrl: "https://threads.net/oauth/authorize",
    tokenUrl: "https://graph.threads.net/oauth/access_token",
  };
}

function missingConfig(config: ProviderConfig | null, env: Env): string[] {
  const missing = [];
  if (!config?.clientId) missing.push("client_id");
  if (!config?.clientSecret) missing.push("client_secret");
  if (!stateSecret(env)) missing.push("oauth_state_secret");
  if (!env.TOKEN_ENCRYPTION_KEY) missing.push("token_encryption_key");
  return missing;
}

function redirectUri(request: Request): string {
  return `${new URL(request.url).origin}/api/auth/meta/callback`;
}

async function exchangeCode(config: ProviderConfig, code: string, request: Request): Promise<TokenResponse> {
  const url = new URL(config.tokenUrl);
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("client_secret", config.clientSecret);
  url.searchParams.set("redirect_uri", redirectUri(request));
  url.searchParams.set("code", code);
  const response = await fetch(url.toString());
  const data = (await response.json()) as TokenResponse;
  if (!response.ok || !data.access_token) {
    throw new Error(data.error?.message ?? "OAuth token exchange failed.");
  }
  return data;
}

async function resolveInstagramAccount(accessToken: string): Promise<{ accountId: string; providerUserId: string; username: string; tokenToStore: string }> {
  const url = new URL("https://graph.facebook.com/v20.0/me/accounts");
  url.searchParams.set("fields", "id,name,access_token,instagram_business_account{id,username}");
  url.searchParams.set("access_token", accessToken);
  const response = await fetch(url.toString());
  const data = (await response.json()) as InstagramPagesResponse;
  if (!response.ok) throw new Error(data.error?.message ?? "Could not read Facebook Pages for Instagram.");

  const pages = data.data ?? [];
  if (pages.length === 0) {
    throw new Error("No Facebook Pages were returned. Reconnect and approve Page access for the Facebook Page linked to Instagram.");
  }

  const page = data.data?.find((item) => item.instagram_business_account?.id && item.access_token);
  if (!page?.instagram_business_account?.id || !page.access_token) {
    const pagesWithInstagram = pages.filter((item) => item.instagram_business_account?.id);
    if (pagesWithInstagram.length > 0) {
      const pageNames = pagesWithInstagram.map((item) => item.name ?? item.id ?? "unnamed Page").slice(0, 3).join(", ");
      throw new Error(`Instagram account was found on Facebook Page(s), but Page access token was missing: ${pageNames}. Reconnect and approve all requested permissions.`);
    }
    const pageNames = pages.map((item) => item.name ?? item.id ?? "unnamed Page").slice(0, 3).join(", ");
    throw new Error(`Facebook Page access works, but no Page exposes an Instagram Business account: ${pageNames}. Check that the selected Page is linked to the Instagram professional account and approve access to that Page.`);
  }

  return {
    accountId: page.instagram_business_account.id,
    providerUserId: page.id ?? "",
    username: page.instagram_business_account.username ?? page.name ?? "Instagram Business",
    tokenToStore: page.access_token,
  };
}

async function resolveThreadsAccount(accessToken: string): Promise<{ accountId: string; providerUserId: string; username: string; tokenToStore: string }> {
  const url = new URL("https://graph.threads.net/v1.0/me");
  url.searchParams.set("fields", "id,username");
  url.searchParams.set("access_token", accessToken);
  const response = await fetch(url.toString());
  const data = (await response.json()) as ThreadsMeResponse;
  if (!response.ok || !data.id) throw new Error(data.error?.message ?? "Could not read Threads profile.");
  return {
    accountId: data.id,
    providerUserId: data.id,
    username: data.username ?? "Threads",
    tokenToStore: accessToken,
  };
}

function tokenExpiry(expiresIn?: number): string {
  if (!expiresIn) return "";
  return new Date(Date.now() + expiresIn * 1000).toISOString();
}

function getCookie(request: Request, name: string): string {
  const cookie = request.headers.get("cookie") ?? "";
  const match = cookie.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : "";
}

export async function oauthReadiness(request: Request, env: Env): Promise<Response> {
  const instagram = await providerConfig(env, "instagram");
  const threads = await providerConfig(env, "threads");
  return jsonResponse({
    redirect_uri: redirectUri(request),
    platforms: {
      instagram: { configured: missingConfig(instagram, env).length === 0, missing: missingConfig(instagram, env) },
      threads: { configured: missingConfig(threads, env).length === 0, missing: missingConfig(threads, env) },
    },
  });
}

export async function listConnectedAccounts(env: Env): Promise<Response> {
  return jsonResponse({ accounts: await listSocialAccounts(env) });
}

export async function startMetaOAuth(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const platform = platformFromUrl(url);
  if (!platform) return badRequest("platform must be instagram or threads");

  const config = await providerConfig(env, platform);
  const missing = missingConfig(config, env);
  if (!config || missing.length > 0) {
    return jsonResponse({ error: "OAuth is not configured.", missing, redirect_uri: redirectUri(request) }, 409);
  }

  const state = await createState(env, platform);
  const authUrl = new URL(config.authUrl);
  authUrl.searchParams.set("client_id", config.clientId);
  authUrl.searchParams.set("redirect_uri", redirectUri(request));
  authUrl.searchParams.set("scope", config.scopes.join(","));
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("state", state);

  return redirectResponse(authUrl.toString(), {
    "set-cookie": `${stateCookieName}=${encodeURIComponent(state)}; Path=/api/auth/meta; Max-Age=600; HttpOnly; Secure; SameSite=Lax`,
  });
}

export async function handleMetaCallback(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const code = url.searchParams.get("code") ?? "";
  const state = url.searchParams.get("state") ?? "";
  const error = url.searchParams.get("error_description") ?? url.searchParams.get("error") ?? "";
  if (error) return redirectResponse(`/?oauth_error=${encodeURIComponent(error)}`);
  if (!code || !state) return redirectResponse("/?oauth_error=missing_oauth_code");

  try {
    if (getCookie(request, stateCookieName) !== state) throw new Error("OAuth browser state cookie did not match.");
    const verified = await verifyState(env, state);
    const config = await providerConfig(env, verified.platform);
    if (!config) throw new Error("OAuth provider is not configured.");

    const token = await exchangeCode(config, code, request);
    const account = verified.platform === "instagram"
      ? await resolveInstagramAccount(token.access_token ?? "")
      : await resolveThreadsAccount(token.access_token ?? "");

    const accountId = await upsertSocialAccount(env, {
      platform: verified.platform,
      accountId: account.accountId,
      providerUserId: account.providerUserId,
      username: account.username,
      accessTokenCiphertext: await encryptToken(env, account.tokenToStore),
      scopes: config.scopes,
      tokenExpiresAt: tokenExpiry(token.expires_in),
      status: "connected",
    });
    await audit(env, "oauth.callback.connected", "social_account", accountId, { platform: verified.platform });
    return redirectResponse(`/?connected=${verified.platform}`, {
      "set-cookie": `${stateCookieName}=; Path=/api/auth/meta; Max-Age=0; HttpOnly; Secure; SameSite=Lax`,
    });
  } catch (callbackError) {
    const message = callbackError instanceof Error ? callbackError.message : "OAuth callback failed.";
    return redirectResponse(`/?oauth_error=${encodeURIComponent(message)}`, {
      "set-cookie": `${stateCookieName}=; Path=/api/auth/meta; Max-Age=0; HttpOnly; Secure; SameSite=Lax`,
    });
  }
}

export async function disconnectConnectedAccount(request: Request, env: Env): Promise<Response> {
  const input = (await request.json().catch(() => ({}))) as { platform?: Platform };
  if (input.platform !== "instagram" && input.platform !== "threads" && input.platform !== "kakao") {
    return badRequest("platform must be instagram, threads, or kakao");
  }
  return jsonResponse({ disconnected: await disconnectSocialAccount(env, input.platform) });
}
