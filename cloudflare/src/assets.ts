import { badRequest, jsonResponse, notFound } from "./http";
import type { Env } from "./types";

const allowedImageTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const maxImageBytes = 8 * 1024 * 1024;

interface StoredImageMetadata {
  contentType?: string;
  cacheControl?: string;
  originalName?: string;
  uploadedAt?: string;
}

function extensionForType(contentType: string): string {
  return {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
  }[contentType] ?? "bin";
}

function cleanFileName(name: string): string {
  const withoutExtension = name.replace(/\.[^.]+$/, "");
  return withoutExtension.replace(/[^a-zA-Z0-9._-]/g, "-").replace(/-+/g, "-").slice(0, 80) || "image";
}

function publicUrl(request: Request, key: string, env: Env): string {
  const base = env.PUBLIC_BASE_URL || new URL(request.url).origin;
  const encodedKey = key.split("/").map(encodeURIComponent).join("/");
  return `${base.replace(/\/$/, "")}/api/assets/${encodedKey}`;
}

function hasMediaStore(env: Env): boolean {
  return Boolean(env.MEDIA_BUCKET || env.MEDIA_KV);
}

export function hasConfiguredMediaStore(env: Env): boolean {
  return hasMediaStore(env);
}

async function putMedia(env: Env, key: string, data: ArrayBuffer, metadata: StoredImageMetadata): Promise<void> {
  if (env.MEDIA_BUCKET) {
    await env.MEDIA_BUCKET.put(key, data, {
      httpMetadata: {
        contentType: metadata.contentType,
        cacheControl: metadata.cacheControl,
      },
      customMetadata: {
        originalName: metadata.originalName ?? "",
        uploadedAt: metadata.uploadedAt ?? "",
      },
    });
    return;
  }
  if (env.MEDIA_KV) {
    await env.MEDIA_KV.put(key, data, { metadata });
    return;
  }
  throw new Error("Media storage binding MEDIA_KV or MEDIA_BUCKET is not configured.");
}

async function getMedia(env: Env, key: string): Promise<{
  body: ReadableStream | ArrayBuffer | null;
  metadata: StoredImageMetadata;
  etag?: string;
} | null> {
  if (env.MEDIA_BUCKET) {
    const object = await env.MEDIA_BUCKET.get(key);
    if (!object) return null;
    const headers = new Headers();
    object.writeHttpMetadata(headers);
    return {
      body: object.body,
      metadata: {
        contentType: headers.get("content-type") ?? undefined,
        cacheControl: headers.get("cache-control") ?? undefined,
      },
      etag: object.httpEtag,
    };
  }
  if (env.MEDIA_KV) {
    const result = await env.MEDIA_KV.getWithMetadata<StoredImageMetadata>(key, "stream");
    if (!result.value) return null;
    return {
      body: result.value,
      metadata: result.metadata ?? {},
    };
  }
  throw new Error("Media storage binding MEDIA_KV or MEDIA_BUCKET is not configured.");
}

export async function uploadAsset(request: Request, env: Env): Promise<Response> {
  const form = await request.formData();
  const entry = form.get("image");
  if (!entry || typeof entry === "string" || typeof entry !== "object" || !("stream" in entry)) {
    return badRequest("image file is required");
  }
  const image = entry as File;
  if (!allowedImageTypes.has(image.type)) return badRequest("image must be jpeg, png, or webp");
  if (image.size <= 0) return badRequest("image file is empty");
  if (image.size > maxImageBytes) return badRequest("image must be 8 MB or smaller");

  const extension = extensionForType(image.type);
  const originalName = cleanFileName(image.name);
  const key = `uploads/${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}-${originalName}.${extension}`;
  await putMedia(env, key, await image.arrayBuffer(), {
    contentType: image.type,
    cacheControl: "public, max-age=31536000, immutable",
    originalName: image.name,
    uploadedAt: new Date().toISOString(),
  });

  return jsonResponse({
    image_key: key,
    image_url: publicUrl(request, key, env),
    content_type: image.type,
    size: image.size,
  }, 201);
}

export async function serveAsset(request: Request, env: Env, key: string): Promise<Response> {
  if (!key || key.includes("..")) return notFound();
  const object = await getMedia(env, key);
  if (!object?.body) return notFound();

  const headers = new Headers();
  if (object.metadata.contentType) headers.set("content-type", object.metadata.contentType);
  if (object.etag) headers.set("etag", object.etag);
  headers.set("cache-control", object.metadata.cacheControl || "public, max-age=86400");
  headers.set("access-control-allow-origin", "*");

  if (request.method === "HEAD") return new Response(null, { headers });
  return new Response(object.body, { headers });
}
