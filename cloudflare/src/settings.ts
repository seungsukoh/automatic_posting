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
  metaAppIdSource: string;
  metaAppSecretSource: string;
  metaAppIdUpdatedAt: string;
  metaAppSecretUpdatedAt: string;
  adminSetupKeyConfigured: boolean;
  tokenEncryptionKeyConfigured: boolean;
}

function hasD1(env: Env): boolean {
  return typeof (env as Partial<Env>).DB?.prepare === "function";
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
  if (!env.TOKEN_ENCRYPTION_KEY || env.TOKEN_ENCRYPTION_KEY.length < 24) {
    throw new Error("TOKEN_ENCRYPTION_KEY must be configured before saving secrets.");
  }
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    await encryptionKey(env.TOKEN_ENCRYPTION_KEY, "encrypt"),
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
  const metaAppId = storedMetaAppId || env.META_APP_ID || env.INSTAGRAM_CLIENT_ID || "";
  const metaAppSecret = storedMetaSecret || env.META_APP_SECRET || env.INSTAGRAM_CLIENT_SECRET || "";
  return {
    metaAppId,
    metaAppSecret,
    metaAppIdSource: storedMetaAppId ? "admin_settings" : env.META_APP_ID ? "META_APP_ID" : env.INSTAGRAM_CLIENT_ID ? "INSTAGRAM_CLIENT_ID" : "",
    metaAppSecretSource: storedMetaSecret ? "admin_settings" : env.META_APP_SECRET ? "META_APP_SECRET" : env.INSTAGRAM_CLIENT_SECRET ? "INSTAGRAM_CLIENT_SECRET" : "",
    metaAppIdUpdatedAt: storedMetaAppId ? rows.meta_app_id?.updated_at ?? "" : "",
    metaAppSecretUpdatedAt: storedMetaSecret ? rows.meta_app_secret?.updated_at ?? "" : "",
    adminSetupKeyConfigured: Boolean(env.ADMIN_SETUP_KEY),
    tokenEncryptionKeyConfigured: Boolean(env.TOKEN_ENCRYPTION_KEY),
  };
}

export async function getAdminSettingsStatus(env: Env): Promise<Response> {
  const settings = await getRuntimeSettings(env);
  return jsonResponse({
    admin_setup_key_configured: settings.adminSetupKeyConfigured,
    token_encryption_key_configured: settings.tokenEncryptionKeyConfigured,
    meta_app_id_configured: Boolean(settings.metaAppId),
    meta_app_secret_configured: Boolean(settings.metaAppSecret),
    meta_app_id_value: settings.metaAppId,
    meta_app_id_source: settings.metaAppIdSource,
    meta_app_id_updated_at: settings.metaAppIdUpdatedAt,
    meta_app_secret_source: settings.metaAppSecretSource,
    meta_app_secret_updated_at: settings.metaAppSecretUpdatedAt,
  });
}

export async function saveAdminSettings(request: Request, env: Env): Promise<Response> {
  if (!hasD1(env)) return serviceUnavailable("Cloudflare D1 binding DB is not configured.");
  if (!env.ADMIN_SETUP_KEY) return serviceUnavailable("ADMIN_SETUP_KEY is not configured.");
  const input = (await request.json().catch(() => ({}))) as {
    admin_key?: string;
    meta_app_id?: string;
    meta_app_secret?: string;
  };

  if (input.admin_key?.trim() !== env.ADMIN_SETUP_KEY) return badRequest("Admin setup key is invalid.");
  const metaAppId = input.meta_app_id?.trim() ?? "";
  const metaAppSecret = input.meta_app_secret?.trim() ?? "";
  if (!metaAppId && !metaAppSecret) return badRequest("At least one setting value is required.");
  if (metaAppId && !/^\d+$/.test(metaAppId)) return badRequest("Instagram App ID must contain digits only.");

  await ensureSettingsSchema(env);
  if (metaAppId) await setSetting(env, "meta_app_id", metaAppId, false);
  if (metaAppSecret) await setSetting(env, "meta_app_secret", await encryptValue(env, metaAppSecret), true);

  const settings = await getRuntimeSettings(env);
  return jsonResponse({
    saved: true,
    meta_app_id_configured: Boolean(settings.metaAppId),
    meta_app_secret_configured: Boolean(settings.metaAppSecret),
    meta_app_id_value: settings.metaAppId,
    meta_app_id_source: settings.metaAppIdSource,
    meta_app_id_updated_at: settings.metaAppIdUpdatedAt,
    meta_app_secret_source: settings.metaAppSecretSource,
    meta_app_secret_updated_at: settings.metaAppSecretUpdatedAt,
  });
}
