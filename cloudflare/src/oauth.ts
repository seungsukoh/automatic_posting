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
  user_id?: string | number;
  error?: { message?: string };
}

interface ThreadsMeResponse {
  id?: string;
  username?: string;
  error?: { message?: string };
}

interface InstagramMeResponse {
  id?: string;
  user_id?: string;
  username?: string;
  error?: { message?: string };
}

const stateCookieName = "ap_oauth_state";
const instagramGraphBaseUrl = "https://graph.instagram.com/v21.0";

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
      scopes: ["instagram_business_basic", "instagram_business_content_publish"],
      authUrl: "https://www.instagram.com/oauth/authorize",
      tokenUrl: "https://api.instagram.com/oauth/access_token",
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
  if (config.platform === "instagram") {
    const body = new URLSearchParams();
    body.set("client_id", config.clientId);
    body.set("client_secret", config.clientSecret);
    body.set("grant_type", "authorization_code");
    body.set("redirect_uri", redirectUri(request));
    body.set("code", code);
    const response = await fetch(config.tokenUrl, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body,
    });
    const data = (await response.json()) as TokenResponse;
    if (!response.ok || !data.access_token) {
      throw new Error(data.error?.message ?? "Instagram OAuth token exchange failed.");
    }
    return data;
  }

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

async function exchangeInstagramLongLivedToken(config: ProviderConfig, shortLivedToken: string): Promise<TokenResponse> {
  const url = new URL("https://graph.instagram.com/access_token");
  url.searchParams.set("grant_type", "ig_exchange_token");
  url.searchParams.set("client_secret", config.clientSecret);
  url.searchParams.set("access_token", shortLivedToken);
  const response = await fetch(url.toString());
  const data = (await response.json()) as TokenResponse;
  if (!response.ok || !data.access_token) {
    throw new Error(data.error?.message ?? "Instagram long-lived token exchange failed.");
  }
  return data;
}

async function resolveInstagramAccount(accessToken: string, fallbackUserId: string): Promise<{ accountId: string; providerUserId: string; username: string; tokenToStore: string }> {
  const url = new URL(`${instagramGraphBaseUrl}/me`);
  url.searchParams.set("fields", "user_id,username");
  url.searchParams.set("access_token", accessToken);
  const response = await fetch(url.toString());
  const data = (await response.json()) as InstagramMeResponse;
  if (!response.ok) throw new Error(data.error?.message ?? "Could not read Instagram Business profile.");
  const accountId = data.user_id ?? data.id ?? fallbackUserId;
  if (!accountId) {
    throw new Error("Instagram Business Login did not return an account id.");
  }

  return {
    accountId,
    providerUserId: accountId,
    username: data.username ?? "Instagram Business",
    tokenToStore: accessToken,
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

async function safeAudit(env: Env, action: string, metadata: Record<string, unknown>): Promise<void> {
  try {
    await audit(env, action, "oauth", null, metadata);
  } catch {
    // OAuth should not fail just because diagnostics could not be written.
  }
}

async function auditOAuthFailure(env: Env, request: Request, reason: string, details: Record<string, unknown> = {}): Promise<void> {
  const url = new URL(request.url);
  await safeAudit(env, "oauth.callback.failed", {
    reason,
    has_code: Boolean(url.searchParams.get("code")),
    has_state: Boolean(url.searchParams.get("state")),
    has_state_cookie: Boolean(getCookie(request, stateCookieName)),
    error: url.searchParams.get("error") ?? "",
    error_description: url.searchParams.get("error_description") ?? "",
    user_agent: request.headers.get("user-agent") ?? "",
    ...details,
  });
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
  if (platform === "instagram") {
    authUrl.searchParams.set("enable_fb_login", "0");
    authUrl.searchParams.set("force_authentication", "1");
  }

  await safeAudit(env, "oauth.start", {
    platform,
    client_id: config.clientId,
    redirect_uri: redirectUri(request),
    scope: config.scopes.join(","),
  });

  return redirectResponse(authUrl.toString(), {
    "set-cookie": `${stateCookieName}=${encodeURIComponent(state)}; Path=/api/auth/meta; Max-Age=600; HttpOnly; Secure; SameSite=Lax`,
  });
}

export async function handleMetaCallback(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const code = url.searchParams.get("code") ?? "";
  const state = url.searchParams.get("state") ?? "";
  const error = url.searchParams.get("error_description") ?? url.searchParams.get("error") ?? "";
  if (error) {
    await auditOAuthFailure(env, request, "provider_error", { message: error });
    return redirectResponse(`/?oauth_error=${encodeURIComponent(error)}`);
  }
  if (!code || !state) {
    await auditOAuthFailure(env, request, "missing_code_or_state");
    return redirectResponse("/?oauth_error=missing_oauth_code");
  }

  try {
    if (getCookie(request, stateCookieName) !== state) {
      await auditOAuthFailure(env, request, "state_cookie_mismatch");
      throw new Error("OAuth browser state cookie did not match.");
    }
    const verified = await verifyState(env, state);
    const config = await providerConfig(env, verified.platform);
    if (!config) throw new Error("OAuth provider is not configured.");

    const token = await exchangeCode(config, code, request);
    const effectiveToken = verified.platform === "instagram"
      ? await exchangeInstagramLongLivedToken(config, token.access_token ?? "")
      : token;
    const account = verified.platform === "instagram"
      ? await resolveInstagramAccount(effectiveToken.access_token ?? "", String(token.user_id ?? ""))
      : await resolveThreadsAccount(effectiveToken.access_token ?? "");

    const accountId = await upsertSocialAccount(env, {
      platform: verified.platform,
      accountId: account.accountId,
      providerUserId: account.providerUserId,
      username: account.username,
      accessTokenCiphertext: await encryptToken(env, account.tokenToStore),
      scopes: config.scopes,
      tokenExpiresAt: tokenExpiry(effectiveToken.expires_in),
      status: "connected",
    });
    await audit(env, "oauth.callback.connected", "social_account", accountId, { platform: verified.platform });
    return redirectResponse(`/?connected=${verified.platform}`, {
      "set-cookie": `${stateCookieName}=; Path=/api/auth/meta; Max-Age=0; HttpOnly; Secure; SameSite=Lax`,
    });
  } catch (callbackError) {
    const message = callbackError instanceof Error ? callbackError.message : "OAuth callback failed.";
    await auditOAuthFailure(env, request, "callback_exception", { message });
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
