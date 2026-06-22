export type Platform = "instagram" | "threads" | "kakao";

export interface Env {
  DB: D1Database;
  MEDIA_BUCKET?: R2Bucket;
  MEDIA_KV?: KVNamespace;
  ASSETS?: Fetcher;
  PUBLISH_QUEUE?: Queue<PublishQueueMessage>;
  META_APP_ID?: string;
  META_APP_SECRET?: string;
  OAUTH_STATE_SECRET?: string;
  TOKEN_ENCRYPTION_KEY?: string;
  ADMIN_SETUP_KEY?: string;
  INSTAGRAM_CLIENT_ID?: string;
  INSTAGRAM_CLIENT_SECRET?: string;
  THREADS_CLIENT_ID?: string;
  THREADS_CLIENT_SECRET?: string;
  KAKAO_CLIENT_ID?: string;
  KAKAO_CLIENT_SECRET?: string;
  PUBLIC_BASE_URL?: string;
}

export interface CreatePostRequest {
  title: string;
  body?: string;
  link_url?: string;
  hashtags?: string;
  image_key?: string;
  image_url?: string;
  campaign_name?: string;
  campaign_tags?: string;
  campaign_goal?: string;
  source_file?: string;
  platforms: Platform[];
  platform_bodies?: Partial<Record<Platform, string>>;
}

export interface PublishRequest {
  mode?: "now" | "scheduled";
  scheduled_at?: string;
}

export interface PublishPayload {
  title: string;
  body: string;
  linkUrl: string;
  hashtags: string;
  imageKey: string;
  imageUrl: string;
  platformBody: string;
}

export interface PublishResult {
  status: "success" | "failed";
  error_message: string;
  external_post_url: string;
}

export interface PublishQueueMessage {
  jobId: number;
}
