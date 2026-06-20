const form = document.querySelector("#postForm");
const jobsEl = document.querySelector("#jobs");
const toast = document.querySelector("#toast");

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  window.setTimeout(() => toast.classList.remove("show"), 2200);
}

function formData() {
  const data = new FormData(form);
  const platforms = Array.from(form.querySelectorAll("input[name='platforms']:checked")).map((el) => el.value);
  return {
    title: data.get("title"),
    body: data.get("body"),
    link_url: data.get("link_url"),
    hashtags: data.get("hashtags"),
    image_name: data.get("image_name"),
    platforms
  };
}

async function request(path, options = {}) {
  const response = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...options
  });
  const body = await response.json();
  if (!response.ok) {
    throw new Error(body.error || "요청 처리 실패");
  }
  return body;
}

async function loadJobs() {
  const data = await request("/api/jobs");
  if (!data.jobs.length) {
    jobsEl.textContent = "아직 작업이 없습니다.";
    return;
  }

  jobsEl.innerHTML = data.jobs.map((job) => `
    <article class="job">
      <div>
        <div class="job-title">${escapeHtml(job.title)} / ${escapeHtml(job.platform)}</div>
        <div class="job-meta">
          #${job.id} · ${escapeHtml(job.created_at)}${job.error_message ? " · " + escapeHtml(job.error_message) : ""}
          ${job.external_post_url ? ` · <a href="${escapeHtml(job.external_post_url)}" target="_blank">mock url</a>` : ""}
        </div>
      </div>
      <div class="actions">
        <span class="badge ${escapeHtml(job.status)}">${escapeHtml(job.status)}</span>
        ${job.status === "failed" ? `<button class="secondary" data-retry="${job.id}">재시도</button>` : ""}
      </div>
    </article>
  `).join("");
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const post = formData();
  if (!post.platforms.length) {
    showToast("플랫폼을 하나 이상 선택하세요.");
    return;
  }

  try {
    const created = await request("/api/posts", {
      method: "POST",
      body: JSON.stringify(post)
    });

    const mode = form.elements.mode.value;
    const scheduledAt = form.elements.scheduled_at.value;
    await request(`/api/posts/${created.post_id}/publish`, {
      method: "POST",
      body: JSON.stringify({
        mode,
        scheduled_at: scheduledAt ? new Date(scheduledAt).toISOString() : null
      })
    });

    showToast(mode === "scheduled" ? "예약 발행 작업을 만들었습니다." : "즉시 발행 작업을 실행했습니다.");
    await loadJobs();
  } catch (error) {
    showToast(error.message);
  }
});

jobsEl.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-retry]");
  if (!button) return;
  try {
    await request(`/api/jobs/${button.dataset.retry}/retry`, { method: "POST", body: "{}" });
    showToast("재시도했습니다.");
    await loadJobs();
  } catch (error) {
    showToast(error.message);
  }
});

document.querySelector("#refreshJobs").addEventListener("click", loadJobs);
document.querySelector("#runScheduler").addEventListener("click", async () => {
  try {
    const result = await request("/api/scheduler/run", { method: "POST", body: "{}" });
    showToast(`예약 작업 ${result.processed.length}건 처리`);
    await loadJobs();
  } catch (error) {
    showToast(error.message);
  }
});

loadJobs();
