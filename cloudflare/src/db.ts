import { utcNow } from "./http";
import type { CreatePostRequest, Env, PublishPayload, PublishRequest } from "./types";

export async function audit(env: Env, action: string, targetType: string, targetId: number | null, metadata: unknown): Promise<void> {
  await env.DB.prepare(
    "insert into audit_logs (action, target_type, target_id, metadata, created_at) values (?, ?, ?, ?, ?)",
  )
    .bind(action, targetType, targetId, JSON.stringify(metadata), utcNow())
    .run();
}

export async function createPost(env: Env, input: CreatePostRequest): Promise<number> {
  const now = utcNow();
  const result = await env.DB.prepare(
    "insert into posts (title, body, link_url, hashtags, image_key, created_at, updated_at) values (?, ?, ?, ?, ?, ?, ?)",
  )
    .bind(input.title.trim(), input.body.trim(), input.link_url ?? "", input.hashtags ?? "", input.image_key ?? "", now, now)
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
  const row = await env.DB.prepare(
    `
    select j.platform, p.title, p.body, p.link_url, p.hashtags, p.image_key, t.body_override
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
      platformBody: row.body_override ?? "",
    },
  };
}
