import { utcNow } from "./http";
import type { CreatePostRequest, Env, Platform, PublishPayload, PublishRequest } from "./types";

export async function audit(env: Env, action: string, targetType: string, targetId: number | null, metadata: unknown): Promise<void> {
  await env.DB.prepare(
    "insert into audit_logs (action, target_type, target_id, metadata, created_at) values (?, ?, ?, ?, ?)",
  )
    .bind(action, targetType, targetId, JSON.stringify(metadata), utcNow())
    .run();
}

let postColumnsReady = false;
const postColumns = [
  "image_url text",
  "campaign_name text",
  "campaign_tags text",
  "campaign_goal text",
  "source_file text",
];

export async function ensurePostSchema(env: Env): Promise<void> {
  if (postColumnsReady) return;
  for (const column of postColumns) {
    try {
      await env.DB.prepare(`alter table posts add column ${column}`).run();
    } catch {
      // Existing deployments may already have the column.
    }
  }
  postColumnsReady = true;
}

export async function createPost(env: Env, input: CreatePostRequest): Promise<number> {
  await ensurePostSchema(env);
  const now = utcNow();
  const result = await env.DB.prepare(
    "insert into posts (title, body, link_url, hashtags, image_key, image_url, campaign_name, campaign_tags, campaign_goal, source_file, created_at, updated_at) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
  )
    .bind(
      input.title.trim(),
      input.body?.trim() ?? "",
      input.link_url ?? "",
      input.hashtags ?? "",
      input.image_key ?? "",
      input.image_url ?? "",
      input.campaign_name?.trim() ?? "",
      input.campaign_tags?.trim() ?? "",
      input.campaign_goal?.trim() ?? "",
      input.source_file?.trim() ?? "",
      now,
      now,
    )
    .run();

  const postId = Number(result.meta.last_row_id);
  for (const platform of input.platforms) {
    await env.DB.prepare(
      "insert into post_targets (post_id, platform, body_override, status, created_at, updated_at) values (?, ?, ?, 'draft', ?, ?)",
    )
      .bind(postId, platform, input.platform_bodies?.[platform] ?? "", now, now)
      .run();
  }
  await audit(env, "post.created", "post", postId, { platforms: input.platforms });
  return postId;
}

export async function listPosts(env: Env): Promise<unknown[]> {
  await ensurePostSchema(env);
  const posts = await env.DB.prepare("select * from posts order by id desc").all<Record<string, unknown>>();
  const rows = posts.results ?? [];
  for (const post of rows) {
    const targets = await env.DB.prepare("select * from post_targets where post_id = ? order by id")
      .bind(post.id)
      .all();
    post.targets = targets.results ?? [];
  }
  return rows;
}

export async function createPublishJobs(env: Env, postId: number, request: PublishRequest): Promise<Array<{ job_id: number; platform: string; status: string }>> {
  const mode = request.mode ?? "now";
  const status = mode === "scheduled" ? "scheduled" : "queued";
  const scheduledAt = mode === "scheduled" ? request.scheduled_at ?? null : null;
  const now = utcNow();
  const targets = await env.DB.prepare("select * from post_targets where post_id = ? order by id").bind(postId).all<Record<string, unknown>>();
  const jobs: Array<{ job_id: number; platform: string; status: string }> = [];

  for (const target of targets.results ?? []) {
    const result = await env.DB.prepare(
      "insert into publish_jobs (post_target_id, platform, scheduled_at, status, created_at, updated_at) values (?, ?, ?, ?, ?, ?)",
    )
      .bind(target.id, target.platform, scheduledAt, status, now, now)
      .run();
    jobs.push({ job_id: Number(result.meta.last_row_id), platform: String(target.platform), status });
  }
  await audit(env, "post.publish_requested", "post", postId, { mode, scheduled_at: scheduledAt });
  return jobs;
}

export async function getPublishPayload(env: Env, jobId: number): Promise<{ platform: string; payload: PublishPayload } | null> {
  await ensurePostSchema(env);
  const row = await env.DB.prepare(
    `
    select j.platform, p.title, p.body, p.link_url, p.hashtags, p.image_key, p.image_url, t.body_override
    from publish_jobs j
    join post_targets t on t.id = j.post_target_id
    join posts p on p.id = t.post_id
    where j.id = ?
    `,
  )
    .bind(jobId)
    .first<Record<string, string | null>>();

  if (!row) return null;
  return {
    platform: row.platform ?? "",
    payload: {
      title: row.title ?? "",
      body: row.body ?? "",
      linkUrl: row.link_url ?? "",
      hashtags: row.hashtags ?? "",
      imageKey: row.image_key ?? "",
      imageUrl: row.image_url ?? "",
      platformBody: row.body_override ?? "",
    },
  };
}

const socialAccountColumns = [
  "provider_user_id text",
  "access_token_ciphertext text",
  "scopes text",
  "token_expires_at text",
  "last_error text",
];

let socialAccountColumnsReady = false;

export async function ensureSocialAccountSchema(env: Env): Promise<void> {
  if (socialAccountColumnsReady) return;
  for (const column of socialAccountColumns) {
    try {
      await env.DB.prepare(`alter table social_accounts add column ${column}`).run();
    } catch {
      // Existing deployments may already have the column.
    }
  }
  socialAccountColumnsReady = true;
}

export interface UpsertSocialAccountInput {
  platform: Platform;
  accountId: string;
  providerUserId: string;
  username: string;
  accessTokenCiphertext: string;
  scopes: string[];
  tokenExpiresAt: string;
  status: "connected" | "needs_reconnect" | "failed";
  lastError?: string;
}

export async function upsertSocialAccount(env: Env, input: UpsertSocialAccountInput): Promise<number> {
  await ensureSocialAccountSchema(env);
  const now = utcNow();
  const existing = await env.DB.prepare("select id from social_accounts where platform = ? and account_id = ?")
    .bind(input.platform, input.accountId)
    .first<{ id: number }>();

  if (existing) {
    await env.DB.prepare(
      `
      update social_accounts
      set provider_user_id = ?, username = ?, access_token_ciphertext = ?, scopes = ?,
          token_expires_at = ?, status = ?, last_error = ?, updated_at = ?
      where id = ?
      `,
    )
      .bind(
        input.providerUserId,
        input.username,
        input.accessTokenCiphertext,
        input.scopes.join(" "),
        input.tokenExpiresAt,
        input.status,
        input.lastError ?? "",
        now,
        existing.id,
      )
      .run();
    await audit(env, "social_account.updated", "social_account", existing.id, { platform: input.platform, status: input.status });
    return existing.id;
  }

  const result = await env.DB.prepare(
    `
    insert into social_accounts
      (platform, account_id, provider_user_id, username, token_ref, access_token_ciphertext, scopes, token_expires_at, status, last_error, created_at, updated_at)
    values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
  )
    .bind(
      input.platform,
      input.accountId,
      input.providerUserId,
      input.username,
      "",
      input.accessTokenCiphertext,
      input.scopes.join(" "),
      input.tokenExpiresAt,
      input.status,
      input.lastError ?? "",
      now,
      now,
    )
    .run();

  const accountId = Number(result.meta.last_row_id);
  await audit(env, "social_account.connected", "social_account", accountId, { platform: input.platform, status: input.status });
  return accountId;
}

export async function listSocialAccounts(env: Env): Promise<unknown[]> {
  await ensureSocialAccountSchema(env);
  const rows = await env.DB.prepare(
    `
    select id, platform, account_id, provider_user_id, username, scopes, token_expires_at, status, last_error, created_at, updated_at
    from social_accounts
    order by platform, id
    `,
  ).all<Record<string, unknown>>();
  return rows.results ?? [];
}

export async function disconnectSocialAccount(env: Env, platform: Platform): Promise<boolean> {
  await ensureSocialAccountSchema(env);
  const now = utcNow();
  const result = await env.DB.prepare(
    `
    update social_accounts
    set status = 'disconnected', access_token_ciphertext = '', last_error = '', updated_at = ?
    where platform = ? and status != 'disconnected'
    `,
  )
    .bind(now, platform)
    .run();
  await audit(env, "social_account.disconnected", "social_account", null, { platform });
  return (result.meta.changes ?? 0) > 0;
}

export interface PublishingSocialAccount {
  platform: Platform;
  accountId: string;
  username: string;
  accessTokenCiphertext: string;
}

export async function getPublishingSocialAccount(env: Env, platform: Platform): Promise<PublishingSocialAccount | null> {
  await ensureSocialAccountSchema(env);
  const row = await env.DB.prepare(
    `
    select platform, account_id, username, access_token_ciphertext
    from social_accounts
    where platform = ? and status = 'connected' and access_token_ciphertext is not null and access_token_ciphertext != ''
    order by updated_at desc
    limit 1
    `,
  )
    .bind(platform)
    .first<Record<string, string | null>>();

  if (!row?.account_id || !row.access_token_ciphertext) return null;
  return {
    platform,
    accountId: row.account_id,
    username: row.username ?? "",
    accessTokenCiphertext: row.access_token_ciphertext,
  };
}
