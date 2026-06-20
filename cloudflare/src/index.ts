import { serveAsset, uploadAsset } from "./assets";
import { audit, createPost, createPublishJobs, getPublishPayload, listPosts } from "./db";
import { badRequest, isDue, jsonResponse, notFound, readJson, utcNow } from "./http";
import { disconnectConnectedAccount, handleMetaCallback, listConnectedAccounts, oauthReadiness, startMetaOAuth } from "./oauth";
import { publishToPlatform } from "./publishers";
import type { CreatePostRequest, Env, PublishRequest, PublishQueueMessage } from "./types";

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

  if (request.method === "POST" && path === "/api/assets/upload") {
    return uploadAsset(request, env);
  }

  const assetMatch = path.match(/^\/api\/assets\/(.+)$/);
  if ((request.method === "GET" || request.method === "HEAD") && assetMatch) {
    return serveAsset(request, env, decodeURIComponent(assetMatch[1]));
  }

  if (request.method === "GET" && path === "/api/oauth/meta/readiness") {
    return oauthReadiness(request, env);
  }

  if (request.method === "GET" && path === "/api/social-accounts") {
    return listConnectedAccounts(env);
  }

  if (request.method === "POST" && path === "/api/social-accounts/disconnect") {
    return disconnectConnectedAccount(request, env);
  }

  if (request.method === "GET" && path === "/api/auth/meta/start") {
    return startMetaOAuth(request, env);
  }

  if (request.method === "GET" && path === "/api/auth/meta/callback") {
    return handleMetaCallback(request, env);
  }

  if (request.method === "GET" && path === "/api/posts") {
    return jsonResponse({ posts: await listPosts(env) });
  }

  if (request.method === "GET" && path === "/api/jobs") {
    const jobs = await env.DB.prepare(
      `
      select j.*, p.title
      from publish_jobs j
      join post_targets t on t.id = j.post_target_id
      join posts p on p.id = t.post_id
      order by j.id desc
      `,
    ).all();
    return jsonResponse({ jobs: jobs.results ?? [] });
  }

  if (request.method === "POST" && path === "/api/posts") {
    const input = await readJson<CreatePostRequest>(request);
    if (!input.title?.trim() || !input.body?.trim()) return badRequest("title and body are required");
    if (!Array.isArray(input.platforms) || input.platforms.length === 0) return badRequest("at least one platform is required");
    const postId = await createPost(env, input);
    return jsonResponse({ post_id: postId }, 201);
  }

  const publishMatch = path.match(/^\/api\/posts\/(\d+)\/publish$/);
  if (request.method === "POST" && publishMatch) {
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
    const jobId = Number(retryMatch[1]);
    await env.DB.prepare("update publish_jobs set status = 'queued', retry_count = retry_count + 1, error_message = null, updated_at = ? where id = ?")
      .bind(utcNow(), jobId)
      .run();
    return jsonResponse(await executeJob(env, jobId));
  }

  if (request.method === "POST" && path === "/api/scheduler/run") {
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
  fetch: handleRequest,
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
