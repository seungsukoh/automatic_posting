import { getPublishingSocialAccount } from "./db";
import { formatPublishText } from "./publishText";
import type { Env, Platform, PublishPayload, PublishResult } from "./types";

export interface Publisher {
  publish(env: Env, payload: PublishPayload): Promise<PublishResult>;
}

interface GraphError {
  error?: {
    message?: string;
    type?: string;
    code?: number;
    error_subcode?: number;
  };
}

interface InstagramContainerResponse extends GraphError {
  id?: string;
}

interface InstagramPublishResponse extends GraphError {
  id?: string;
}

interface InstagramMediaResponse extends GraphError {
  id?: string;
  permalink?: string;
}

interface ThreadsContainerResponse extends GraphError {
  id?: string;
}

interface ThreadsPublishResponse extends GraphError {
  id?: string;
}

interface ThreadsMediaResponse extends GraphError {
  id?: string;
  permalink?: string;
}

interface MediaContainerStatusResponse extends GraphError {
  status_code?: string;
  status?: string;
  error_message?: string;
}

const facebookGraphBaseUrl = "https://graph.facebook.com/v25.0";
const threadsGraphBaseUrl = "https://graph.threads.net/v1.0";
const graphFetchTimeoutMs = 25000;

function base64UrlDecode(value: string): Uint8Array {
  const normalized = value.replaceAll("-", "+").replaceAll("_", "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function encryptionKey(secret: string): Promise<CryptoKey> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(secret));
  return crypto.subtle.importKey("raw", digest, { name: "AES-GCM" }, false, ["decrypt"]);
}

async function decryptToken(env: Env, ciphertext: string): Promise<string> {
  if (!env.TOKEN_ENCRYPTION_KEY) throw new Error("TOKEN_ENCRYPTION_KEY is not configured.");
  const [iv, encrypted] = ciphertext.split(".");
  if (!iv || !encrypted) throw new Error("Stored access token is invalid.");
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: base64UrlDecode(iv) },
    await encryptionKey(env.TOKEN_ENCRYPTION_KEY),
    base64UrlDecode(encrypted),
  );
  return new TextDecoder().decode(decrypted);
}

function hasJpegImage(payload: PublishPayload): boolean {
  return /\.(jpe?g)(?:$|[?#\s])/i.test(`${payload.imageKey} ${payload.imageUrl}`);
}

function isVideoPayload(payload: PublishPayload): boolean {
  return payload.mediaType.startsWith("video/") || /\.(mp4|mov)(?:$|[?#\s])/i.test(`${payload.imageKey} ${payload.imageUrl}`);
}

function graphError(data: GraphError, fallback: string): string {
  const error = data.error;
  if (!error) return fallback;
  const code = error.code ? ` code=${error.code}` : "";
  const subcode = error.error_subcode ? ` subcode=${error.error_subcode}` : "";
  return `${error.message ?? fallback}${code}${subcode}`;
}

async function readJsonResponse<T extends GraphError>(response: Response, fallback: string): Promise<T> {
  const data = (await response.json().catch(() => ({}))) as T;
  if (!response.ok) throw new Error(graphError(data, fallback));
  return data;
}

async function fetchGraph(url: URL, init: RequestInit = {}): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), graphFetchTimeoutMs);
  try {
    return await fetch(url.toString(), { ...init, signal: controller.signal });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("Meta API request timed out.");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForContainerReady(baseUrl: string, containerId: string, accessToken: string, fallback: string): Promise<void> {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const url = new URL(`${baseUrl}/${containerId}`);
    url.searchParams.set("fields", "status_code,status,error_message");
    url.searchParams.set("access_token", accessToken);
    const data = await readJsonResponse<MediaContainerStatusResponse>(await fetchGraph(url), fallback);
    const status = String(data.status_code || data.status || "").toUpperCase();
    if (status === "FINISHED" || status === "PUBLISHED") return;
    if (status === "ERROR" || status === "FAILED") throw new Error(data.error_message || fallback);
    await sleep(2500);
  }
  throw new Error(fallback);
}

class InstagramPublisher implements Publisher {
  async publish(env: Env, payload: PublishPayload): Promise<PublishResult> {
    try {
      if (!payload.imageUrl) {
        return {
          status: "failed",
          error_message: "Instagram publishing requires an uploaded image or video.",
          external_post_url: "",
        };
      }
      const isVideo = isVideoPayload(payload);
      if (!isVideo && !hasJpegImage(payload)) {
        return {
          status: "failed",
          error_message: "Instagram publishing requires a JPG image.",
          external_post_url: "",
        };
      }

      const account = await getPublishingSocialAccount(env, "instagram");
      if (!account) {
        return {
          status: "failed",
          error_message: "Instagram account is not connected.",
          external_post_url: "",
        };
      }

      const accessToken = await decryptToken(env, account.accessTokenCiphertext);
      const createUrl = new URL(`${facebookGraphBaseUrl}/${account.accountId}/media`);
      if (isVideo) {
        createUrl.searchParams.set("media_type", "REELS");
        createUrl.searchParams.set("video_url", payload.imageUrl);
        createUrl.searchParams.set("share_to_feed", "true");
      } else {
        createUrl.searchParams.set("image_url", payload.imageUrl);
      }
      createUrl.searchParams.set("caption", formatPublishText(payload));
      createUrl.searchParams.set("access_token", accessToken);

      const container = await readJsonResponse<InstagramContainerResponse>(
        await fetchGraph(createUrl, { method: "POST" }),
        "Instagram media container creation failed.",
      );
      if (!container.id) throw new Error("Instagram did not return a media container id.");
      if (isVideo) {
        await waitForContainerReady(facebookGraphBaseUrl, container.id, accessToken, "Instagram video processing failed.");
      }

      const publishUrl = new URL(`${facebookGraphBaseUrl}/${account.accountId}/media_publish`);
      publishUrl.searchParams.set("creation_id", container.id);
      publishUrl.searchParams.set("access_token", accessToken);
      const published = await readJsonResponse<InstagramPublishResponse>(
        await fetchGraph(publishUrl, { method: "POST" }),
        "Instagram media publish failed.",
      );
      if (!published.id) throw new Error("Instagram did not return a published media id.");

      const mediaUrl = new URL(`${facebookGraphBaseUrl}/${published.id}`);
      mediaUrl.searchParams.set("fields", "id,permalink");
      mediaUrl.searchParams.set("access_token", accessToken);
      const media = await readJsonResponse<InstagramMediaResponse>(
        await fetchGraph(mediaUrl),
        "Instagram permalink lookup failed.",
      );

      return {
        status: "success",
        error_message: "",
        external_post_url: media.permalink ?? `https://www.instagram.com/p/${published.id}/`,
      };
    } catch (error) {
      return {
        status: "failed",
        error_message: error instanceof Error ? error.message : "Instagram publishing failed.",
        external_post_url: "",
      };
    }
  }
}

class ThreadsPublisher implements Publisher {
  async publish(env: Env, payload: PublishPayload): Promise<PublishResult> {
    try {
      const text = formatPublishText(payload);
      if (!text) {
        return {
          status: "failed",
          error_message: "Threads publishing requires text.",
          external_post_url: "",
        };
      }

      const account = await getPublishingSocialAccount(env, "threads");
      if (!account) {
        return {
          status: "failed",
          error_message: "Threads account is not connected.",
          external_post_url: "",
        };
      }

      const accessToken = await decryptToken(env, account.accessTokenCiphertext);
      const isVideo = isVideoPayload(payload);
      const createUrl = new URL(`${threadsGraphBaseUrl}/${account.accountId}/threads`);
      createUrl.searchParams.set("text", text);
      if (payload.imageUrl) {
        createUrl.searchParams.set("media_type", isVideo ? "VIDEO" : "IMAGE");
        createUrl.searchParams.set(isVideo ? "video_url" : "image_url", payload.imageUrl);
      } else {
        createUrl.searchParams.set("media_type", "TEXT");
      }
      createUrl.searchParams.set("access_token", accessToken);

      const container = await readJsonResponse<ThreadsContainerResponse>(
        await fetchGraph(createUrl, { method: "POST" }),
        "Threads media container creation failed.",
      );
      if (!container.id) throw new Error("Threads did not return a media container id.");
      if (isVideo) {
        await waitForContainerReady(threadsGraphBaseUrl, container.id, accessToken, "Threads video processing failed.");
      }

      const publishUrl = new URL(`${threadsGraphBaseUrl}/${account.accountId}/threads_publish`);
      publishUrl.searchParams.set("creation_id", container.id);
      publishUrl.searchParams.set("access_token", accessToken);
      const published = await readJsonResponse<ThreadsPublishResponse>(
        await fetchGraph(publishUrl, { method: "POST" }),
        "Threads publish failed.",
      );
      if (!published.id) throw new Error("Threads did not return a published media id.");

      const mediaUrl = new URL(`${threadsGraphBaseUrl}/${published.id}`);
      mediaUrl.searchParams.set("fields", "id,permalink");
      mediaUrl.searchParams.set("access_token", accessToken);
      const media = await readJsonResponse<ThreadsMediaResponse>(
        await fetchGraph(mediaUrl),
        "Threads permalink lookup failed.",
      );

      return {
        status: "success",
        error_message: "",
        external_post_url: media.permalink ?? `https://www.threads.net/@${account.username}/post/${published.id}`,
      };
    } catch (error) {
      return {
        status: "failed",
        error_message: error instanceof Error ? error.message : "Threads publishing failed.",
        external_post_url: "",
      };
    }
  }
}

class KakaoPublisher implements Publisher {
  async publish(_env: Env, _payload: PublishPayload): Promise<PublishResult> {
    return {
      status: "failed",
      error_message: "Kakao official sending route is not configured.",
      external_post_url: "",
    };
  }
}

const publishers: Record<Platform, Publisher> = {
  instagram: new InstagramPublisher(),
  threads: new ThreadsPublisher(),
  kakao: new KakaoPublisher(),
};

export async function publishToPlatform(env: Env, platform: string, payload: PublishPayload): Promise<PublishResult> {
  const publisher = publishers[platform.toLowerCase() as Platform];
  if (!publisher) {
    return {
      status: "failed",
      error_message: `Unsupported platform: ${platform}`,
      external_post_url: "",
    };
  }
  return publisher.publish(env, payload);
}
