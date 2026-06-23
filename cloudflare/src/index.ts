import { hasConfiguredMediaStore, serveAsset, uploadAsset } from "./assets";
import { audit, createPost, createPublishJobs, ensurePostSchema, getPublishPayload, listPosts } from "./db";
import { badRequest, internalError, isDue, jsonResponse, notFound, readJson, serviceUnavailable, utcNow } from "./http";
import { disconnectConnectedAccount, handleMetaCallback, listConnectedAccounts, oauthReadiness, startMetaOAuth } from "./oauth";
import { publishToPlatform } from "./publishers";
import { getAdminSettingsStatus, saveAdminSettings } from "./settings";
import type { CreatePostRequest, Env, Platform, PublishRequest, PublishQueueMessage } from "./types";

const supportedPlatforms = ["instagram", "threads", "kakao"] as const satisfies readonly Platform[];

function hasD1(env: Env): boolean {
  return typeof (env as Partial<Env>).DB?.prepare === "function";
}

function hasR2(env: Env): boolean {
  return typeof (env as Partial<Env>).MEDIA_BUCKET?.put === "function";
}

async function systemReadiness(env: Env): Promise<Response> {
  const requiredTables = ["posts", "post_targets", "publish_jobs", "social_accounts", "app_settings", "audit_logs"];
  let tables: Record<string, boolean> = Object.fromEntries(requiredTables.map((name) => [name, false]));
  let databaseReady = false;

  if (hasD1(env)) {
    const rows = await env.DB.prepare(
      `select name from sqlite_master where type = 'table' and name in (${requiredTables.map(() => "?").join(",")})`,
    )
      .bind(...requiredTables)
      .all<{ name: string }>();
    const existing = new Set((rows.results ?? []).map((row) => row.name));
    tables = Object.fromEntries(requiredTables.map((name) => [name, existing.has(name)]));
    databaseReady = requiredTables.every((name) => existing.has(name));
  }

  return jsonResponse({
    d1: { bound: hasD1(env), schema_ready: databaseReady, tables },
    r2: { bound: hasR2(env) },
    media: { bound: hasConfiguredMediaStore(env), storage: env.MEDIA_BUCKET ? "r2" : env.MEDIA_KV ? "kv" : "none" },
    secrets: {
      admin_setup_key: Boolean(env.ADMIN_SETUP_KEY),
      token_encryption_key: Boolean(env.TOKEN_ENCRYPTION_KEY),
    },
  });
}

async function executeJob(env: Env, jobId: number): Promise<Record<string, unknown>> {
  const job = await getPublishPayload(env, jobId);
  if (!job) return { job_id: jobId, status: "missing" };

  const started = utcNow();
  await env.DB.prepare("update publish_jobs set status = 'running', started_at = ?, updated_at = ? where id = ?")
    .bind(started, started, jobId)
    .run();

  const result = await publishToPlatform(env, job.platform, job.payload);
  const finished = utcNow();
  await env.DB.prepare(
    "update publish_jobs set status = ?, finished_at = ?, error_message = ?, external_post_url = ?, updated_at = ? where id = ?",
  )
    .bind(result.status, finished, result.error_message, result.external_post_url, finished, jobId)
    .run();
  await audit(env, "job.executed", "publish_job", jobId, result);
  return { job_id: jobId, platform: job.platform, ...result };
}

async function handleRequest(request: Request, env: Env): Promise<Response> {
  if (request.method === "OPTIONS") return jsonResponse({});

  const url = new URL(request.url);
  const path = url.pathname;

  if (request.method === "GET" && path === "/api/health") {
    return jsonResponse({ status: "ok", time: utcNow() });
  }

  if (request.method === "GET" && path === "/api/system/readiness") {
    return systemReadiness(env);
  }

  if (request.method === "POST" && path === "/api/assets/upload") {
    if (!hasConfiguredMediaStore(env)) return serviceUnavailable("Media storage binding MEDIA_KV or MEDIA_BUCKET is not configured.");
    return uploadAsset(request, env);
  }

  const assetMatch = path.match(/^\/api\/assets\/(.+)$/);
  if ((request.method === "GET" || request.method === "HEAD") && assetMatch) {
    if (!hasConfiguredMediaStore(env)) return serviceUnavailable("Media storage binding MEDIA_KV or MEDIA_BUCKET is not configured.");
    return serveAsset(request, env, decodeURIComponent(assetMatch[1]));
  }

  if (request.method === "GET" && path === "/api/oauth/meta/readiness") {
    return oauthReadiness(request, env);
  }

  if (request.method === "GET" && path === "/api/admin/settings") {
    if (!hasD1(env)) return serviceUnavailable("Cloudflare D1 binding DB is not configured.");
    return getAdminSettingsStatus(env);
  }

  if (request.method === "POST" && path === "/api/admin/settings") {
    if (!hasD1(env)) return serviceUnavailable("Cloudflare D1 binding DB is not configured.");
    return saveAdminSettings(request, env);
  }

  if (request.method === "GET" && path === "/api/social-accounts") {
    if (!hasD1(env)) return serviceUnavailable("Cloudflare D1 binding DB is not configured.");
    return listConnectedAccounts(env);
  }

  if (request.method === "POST" && path === "/api/social-accounts/disconnect") {
    if (!hasD1(env)) return serviceUnavailable("Cloudflare D1 binding DB is not configured.");
    return disconnectConnectedAccount(request, env);
  }

  if (request.method === "GET" && path === "/api/auth/meta/start") {
    return startMetaOAuth(request, env);
  }

  if (request.method === "GET" && path === "/api/auth/meta/callback") {
    return handleMetaCallback(request, env);
  }

  if (request.method === "GET" && path === "/api/posts") {
    if (!hasD1(env)) return serviceUnavailable("Cloudflare D1 binding DB is not configured.");
    return jsonResponse({ posts: await listPosts(env) });
  }

  if (request.method === "GET" && path === "/api/jobs") {
    if (!hasD1(env)) return serviceUnavailable("Cloudflare D1 binding DB is not configured.");
    await ensurePostSchema(env);
    const jobs = await env.DB.prepare(
      `
      select j.*, p.title, p.image_key, p.image_url, p.link_url, p.campaign_name, p.campaign_tags, p.source_file
      from publish_jobs j
      join post_targets t on t.id = j.post_target_id
      join posts p on p.id = t.post_id
      order by j.id desc
      `,
    ).all();
    return jsonResponse({ jobs: jobs.results ?? [] });
  }

  if (request.method === "POST" && path === "/api/posts") {
    if (!hasD1(env)) return serviceUnavailable("Cloudflare D1 binding DB is not configured.");
    const input = await readJson<CreatePostRequest>(request);
    if (!input.title?.trim()) return badRequest("title is required");
    if (!Array.isArray(input.platforms) || input.platforms.length === 0) return badRequest("at least one platform is required");
    if (input.platforms.some((platform) => !supportedPlatforms.includes(platform))) {
      return badRequest("platform must be instagram, threads, or kakao");
    }
    const platforms = [...new Set(input.platforms)];
    if (platforms.length !== 1) return badRequest("select exactly one platform");
    input.platforms = platforms;
    const postId = await createPost(env, input);
    return jsonResponse({ post_id: postId }, 201);
  }

  const publishMatch = path.match(/^\/api\/posts\/(\d+)\/publish$/);
  if (request.method === "POST" && publishMatch) {
    if (!hasD1(env)) return serviceUnavailable("Cloudflare D1 binding DB is not configured.");
    const postId = Number(publishMatch[1]);
    const input = await readJson<PublishRequest>(request);
    if (input.mode === "scheduled" && !input.scheduled_at) return badRequest("scheduled_at is required for scheduled mode");
    const jobs = await createPublishJobs(env, postId, input);
    if (jobs.length === 0) return notFound();

    if ((input.mode ?? "now") !== "scheduled") {
      const executed = [];
      for (const job of jobs) {
        if (env.PUBLISH_QUEUE) await env.PUBLISH_QUEUE.send({ jobId: job.job_id });
        else executed.push(await executeJob(env, job.job_id));
      }
      if (!env.PUBLISH_QUEUE) return jsonResponse({ jobs: executed }, 201);
    }
    return jsonResponse({ jobs }, 201);
  }

  const retryMatch = path.match(/^\/api\/jobs\/(\d+)\/retry$/);
  if (request.method === "POST" && retryMatch) {
    if (!hasD1(env)) return serviceUnavailable("Cloudflare D1 binding DB is not configured.");
    const jobId = Number(retryMatch[1]);
    await env.DB.prepare("update publish_jobs set status = 'queued', retry_count = retry_count + 1, error_message = null, updated_at = ? where id = ?")
      .bind(utcNow(), jobId)
      .run();
    return jsonResponse(await executeJob(env, jobId));
  }

  if (request.method === "POST" && path === "/api/scheduler/run") {
    if (!hasD1(env)) return serviceUnavailable("Cloudflare D1 binding DB is not configured.");
    const rows = await env.DB.prepare("select id, scheduled_at from publish_jobs where status = 'scheduled'").all<Record<string, string | number | null>>();
    const processed = [];
    for (const row of rows.results ?? []) {
      if (isDue(String(row.scheduled_at ?? ""))) processed.push(await executeJob(env, Number(row.id)));
    }
    return jsonResponse({ processed });
  }

  return notFound();
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    try {
      return await handleRequest(request, env);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unexpected server error.";
      return internalError(message);
    }
  },
  async queue(batch: MessageBatch<PublishQueueMessage>, env: Env): Promise<void> {
    for (const message of batch.messages) {
      await executeJob(env, message.body.jobId);
      message.ack();
    }
  },
  async scheduled(_event: ScheduledEvent, env: Env): Promise<void> {
    const rows = await env.DB.prepare("select id, scheduled_at from publish_jobs where status = 'scheduled'").all<Record<string, string | number | null>>();
    for (const row of rows.results ?? []) {
      if (isDue(String(row.scheduled_at ?? ""))) await executeJob(env, Number(row.id));
    }
  },
};
