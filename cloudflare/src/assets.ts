import { badRequest, jsonResponse, notFound } from "./http";
import type { Env } from "./types";

const allowedImageTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const maxImageBytes = 10 * 1024 * 1024;

function extensionForType(contentType: string): string {
  return {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
  }[contentType] ?? "bin";
}

function cleanFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "-").replace(/-+/g, "-").slice(0, 80) || "image";
}

function publicUrl(request: Request, key: string, env: Env): string {
  const base = env.PUBLIC_BASE_URL || new URL(request.url).origin;
  const encodedKey = key.split("/").map(encodeURIComponent).join("/");
  return `${base.replace(/\/$/, "")}/api/assets/${encodedKey}`;
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
  if (image.size > maxImageBytes) return badRequest("image must be 10 MB or smaller");

  const extension = extensionForType(image.type);
  const originalName = cleanFileName(image.name);
  const key = `uploads/${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}-${originalName}.${extension}`;
  await env.ASSETS.put(key, image.stream(), {
    httpMetadata: {
      contentType: image.type,
      cacheControl: "public, max-age=31536000, immutable",
    },
    customMetadata: {
      originalName: image.name,
      uploadedAt: new Date().toISOString(),
    },
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
  const object = await env.ASSETS.get(key);
  if (!object) return notFound();

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);
  headers.set("cache-control", headers.get("cache-control") || "public, max-age=86400");
  headers.set("access-control-allow-origin", "*");

  if (request.method === "HEAD") return new Response(null, { headers });
  return new Response(object.body, { headers });
}
