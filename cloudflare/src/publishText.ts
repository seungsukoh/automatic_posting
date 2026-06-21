import type { PublishPayload } from "./types";

export function formatPublishText(payload: Pick<PublishPayload, "title" | "body" | "linkUrl" | "hashtags" | "platformBody">): string {
  return [
    payload.title,
    payload.platformBody || payload.body,
    payload.linkUrl,
    payload.hashtags,
  ]
    .map((part) => part.trim())
    .filter(Boolean)
    .join("\n\n");
}
