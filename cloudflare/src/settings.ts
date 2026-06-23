import { badRequest, jsonResponse, serviceUnavailable } from "./http";
import type { Env } from "./types";

interface SettingRow {
  name: string;
  value: string;
  encrypted: number;
  updated_at: string;
}

export interface RuntimeSettings {
  metaAppId: string;
  metaAppSecret: string;
  metaLoginConfigId: string;
  threadsClientId: string;
  threadsClientSecret: string;
  metaAppIdSource: string;
  metaAppSecretSource: string;
  metaLoginConfigIdSource: string;
  threadsClientIdSource: string;
  threadsClientSecretSource: string;
  metaAppIdUpdatedAt: string;
  metaAppSecretUpdatedAt: string;
  metaLoginConfigIdUpdatedAt: string;
  threadsClientIdUpdatedAt: string;
  threadsClientSecretUpdatedAt: string;
  adminSetupKeyConfigured: boolean;
  tokenEncryptionKeyConfigured: boolean;
}

function hasD1(env: Env): boolean {
  return typeof (env as Partial<Env>).DB?.prepare === "function";
}

function canEncryptSecrets(env: Env): boolean {
  return Boolean(env.TOKEN_ENCRYPTION_KEY && env.TOKEN_ENCRYPTION_KEY.length >= 24);
}

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

async function encryptionKey(secret: string, usage: "encrypt" | "decrypt"): Promise<CryptoKey> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(secret));
  return crypto.subtle.importKey("raw", digest, { name: "AES-GCM" }, false, [usage]);
}

async function encryptValue(env: Env, value: string): Promise<string> {
  const secret = env.TOKEN_ENCRYPTION_KEY;
  if (!secret || secret.length < 24) {
    throw new Error("TOKEN_ENCRYPTION_KEY must be configured before saving secrets.");
  }
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    await encryptionKey(secret, "encrypt"),
    new TextEncoder().encode(value),
  );
  return `${base64UrlEncode(iv)}.${base64UrlEncode(new Uint8Array(encrypted))}`;
}

async function decryptValue(env: Env, value: string): Promise<string> {
  if (!env.TOKEN_ENCRYPTION_KEY) return "";
  const [iv, encrypted] = value.split(".");
  if (!iv || !encrypted) return "";
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: base64UrlDecode(iv) },
    await encryptionKey(env.TOKEN_ENCRYPTION_KEY, "decrypt"),
    base64UrlDecode(encrypted),
  );
  return new TextDecoder().decode(decrypted);
}

async function secretSettingValue(env: Env, value: string): Promise<{ value: string; encrypted: boolean }> {
  if (!canEncryptSecrets(env)) return { value, encrypted: false };
  return { value: await encryptValue(env, value), encrypted: true };
}

async function ensureSettingsSchema(env: Env): Promise<void> {
  await env.DB.prepare(
    `
    create table if not exists app_settings (
      name text primary key,
      value text not null,
      encrypted integer not null default 0,
      updated_at text not null
    )
    `,
  ).run();
}

async function setSetting(env: Env, name: string, value: string, encrypted: boolean): Promise<void> {
  await env.DB.prepare(
    `
    insert into app_settings (name, value, encrypted, updated_at)
    values (?, ?, ?, ?)
    on conflict(name) do update set value = excluded.value, encrypted = excluded.encrypted, updated_at = excluded.updated_at
    `,
  )
    .bind(name, value, encrypted ? 1 : 0, new Date().toISOString())
    .run();
}

async function readSettings(env: Env): Promise<Record<string, SettingRow>> {
  if (!hasD1(env)) return {};
  await ensureSettingsSchema(env);
  const rows = await env.DB.prepare("select name, value, encrypted, updated_at from app_settings").all<SettingRow>();
  return Object.fromEntries((rows.results ?? []).map((row) => [row.name, row]));
}

export async function getRuntimeSettings(env: Env): Promise<RuntimeSettings> {
  const rows = await readSettings(env);
  const storedMetaAppId = rows.meta_app_id?.value ?? "";
  const storedMetaSecret = rows.meta_app_secret?.encrypted ? await decryptValue(env, rows.meta_app_secret.value).catch(() => "") : rows.meta_app_secret?.value ?? "";
  const storedMetaLoginConfigId = rows.meta_login_config_id?.value ?? "";
  const storedThreadsClientId = rows.threads_client_id?.value ?? "";
  const storedThreadsSecret = rows.threads_client_secret?.encrypted ? await decryptValue(env, rows.threads_client_secret.value).catch(() => "") : rows.threads_client_secret?.value ?? "";
  const metaAppId = storedMetaAppId || env.META_APP_ID || env.INSTAGRAM_CLIENT_ID || "";
  const metaAppSecret = storedMetaSecret || env.META_APP_SECRET || env.INSTAGRAM_CLIENT_SECRET || "";
  const metaLoginConfigId = storedMetaLoginConfigId || env.META_LOGIN_CONFIG_ID || "";
  const threadsClientId = storedThreadsClientId || env.THREADS_CLIENT_ID || "";
  const threadsClientSecret = storedThreadsSecret || env.THREADS_CLIENT_SECRET || "";
  return {
    metaAppId,
    metaAppSecret,
    metaLoginConfigId,
    threadsClientId,
    threadsClientSecret,
    metaAppIdSource: storedMetaAppId ? "admin_settings" : env.META_APP_ID ? "META_APP_ID" : env.INSTAGRAM_CLIENT_ID ? "INSTAGRAM_CLIENT_ID" : "",
    metaAppSecretSource: storedMetaSecret ? "admin_settings" : env.META_APP_SECRET ? "META_APP_SECRET" : env.INSTAGRAM_CLIENT_SECRET ? "INSTAGRAM_CLIENT_SECRET" : "",
    metaLoginConfigIdSource: storedMetaLoginConfigId ? "admin_settings" : env.META_LOGIN_CONFIG_ID ? "META_LOGIN_CONFIG_ID" : "",
    threadsClientIdSource: storedThreadsClientId ? "admin_settings" : env.THREADS_CLIENT_ID ? "THREADS_CLIENT_ID" : "",
    threadsClientSecretSource: storedThreadsSecret ? "admin_settings" : env.THREADS_CLIENT_SECRET ? "THREADS_CLIENT_SECRET" : "",
    metaAppIdUpdatedAt: storedMetaAppId ? rows.meta_app_id?.updated_at ?? "" : "",
    metaAppSecretUpdatedAt: storedMetaSecret ? rows.meta_app_secret?.updated_at ?? "" : "",
    metaLoginConfigIdUpdatedAt: storedMetaLoginConfigId ? rows.meta_login_config_id?.updated_at ?? "" : "",
    threadsClientIdUpdatedAt: storedThreadsClientId ? rows.threads_client_id?.updated_at ?? "" : "",
    threadsClientSecretUpdatedAt: storedThreadsSecret ? rows.threads_client_secret?.updated_at ?? "" : "",
    adminSetupKeyConfigured: Boolean(env.ADMIN_SETUP_KEY),
    tokenEncryptionKeyConfigured: canEncryptSecrets(env),
  };
}

export async function getAdminSettingsStatus(env: Env): Promise<Response> {
  const settings = await getRuntimeSettings(env);
  return jsonResponse({
    admin_setup_key_configured: settings.adminSetupKeyConfigured,
    token_encryption_key_configured: settings.tokenEncryptionKeyConfigured,
    meta_app_id_configured: Boolean(settings.metaAppId),
    meta_app_secret_configured: Boolean(settings.metaAppSecret),
    meta_login_config_id_configured: Boolean(settings.metaLoginConfigId),
    threads_client_id_configured: Boolean(settings.threadsClientId),
    threads_client_secret_configured: Boolean(settings.threadsClientSecret),
    meta_app_id_source: settings.metaAppIdSource,
    meta_app_id_updated_at: settings.metaAppIdUpdatedAt,
    meta_app_secret_source: settings.metaAppSecretSource,
    meta_app_secret_updated_at: settings.metaAppSecretUpdatedAt,
    meta_login_config_id_source: settings.metaLoginConfigIdSource,
    meta_login_config_id_updated_at: settings.metaLoginConfigIdUpdatedAt,
    threads_client_id_source: settings.threadsClientIdSource,
    threads_client_id_updated_at: settings.threadsClientIdUpdatedAt,
    threads_client_secret_source: settings.threadsClientSecretSource,
    threads_client_secret_updated_at: settings.threadsClientSecretUpdatedAt,
  });
}

export async function saveAdminSettings(request: Request, env: Env): Promise<Response> {
  if (!hasD1(env)) return serviceUnavailable("Cloudflare D1 binding DB is not configured.");
  const input = (await request.json().catch(() => ({}))) as {
    meta_app_id?: string;
    meta_app_secret?: string;
    meta_login_config_id?: string;
    threads_client_id?: string;
    threads_client_secret?: string;
  };

  const metaAppId = input.meta_app_id?.trim() ?? "";
  const metaAppSecret = input.meta_app_secret?.trim() ?? "";
  const metaLoginConfigId = input.meta_login_config_id?.trim() ?? "";
  const threadsClientId = input.threads_client_id?.trim() ?? "";
  const threadsClientSecret = input.threads_client_secret?.trim() ?? "";
  if (!metaAppId && !metaAppSecret && !metaLoginConfigId && !threadsClientId && !threadsClientSecret) return badRequest("At least one setting value is required.");
  if (metaAppId && !/^\d+$/.test(metaAppId)) return badRequest("Meta App ID must contain digits only.");
  if (metaLoginConfigId && !/^\d+$/.test(metaLoginConfigId)) return badRequest("Facebook Login Configuration ID must contain digits only.");
  if (threadsClientId && !/^\d+$/.test(threadsClientId)) return badRequest("Threads App ID must contain digits only.");

  await ensureSettingsSchema(env);
  if (metaAppId) await setSetting(env, "meta_app_id", metaAppId, false);
  if (metaAppSecret) {
    const secret = await secretSettingValue(env, metaAppSecret);
    await setSetting(env, "meta_app_secret", secret.value, secret.encrypted);
  }
  if (metaLoginConfigId) await setSetting(env, "meta_login_config_id", metaLoginConfigId, false);
  if (threadsClientId) await setSetting(env, "threads_client_id", threadsClientId, false);
  if (threadsClientSecret) {
    const secret = await secretSettingValue(env, threadsClientSecret);
    await setSetting(env, "threads_client_secret", secret.value, secret.encrypted);
  }

  const settings = await getRuntimeSettings(env);
  return jsonResponse({
    saved: true,
    meta_app_id_configured: Boolean(settings.metaAppId),
    meta_app_secret_configured: Boolean(settings.metaAppSecret),
    meta_login_config_id_configured: Boolean(settings.metaLoginConfigId),
    threads_client_id_configured: Boolean(settings.threadsClientId),
    threads_client_secret_configured: Boolean(settings.threadsClientSecret),
    meta_app_id_source: settings.metaAppIdSource,
    meta_app_id_updated_at: settings.metaAppIdUpdatedAt,
    meta_app_secret_source: settings.metaAppSecretSource,
    meta_app_secret_updated_at: settings.metaAppSecretUpdatedAt,
    meta_login_config_id_source: settings.metaLoginConfigIdSource,
    meta_login_config_id_updated_at: settings.metaLoginConfigIdUpdatedAt,
    threads_client_id_source: settings.threadsClientIdSource,
    threads_client_id_updated_at: settings.threadsClientIdUpdatedAt,
    threads_client_secret_source: settings.threadsClientSecretSource,
    threads_client_secret_updated_at: settings.threadsClientSecretUpdatedAt,
  });
}
