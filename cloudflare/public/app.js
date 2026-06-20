const API_BASE = window.API_BASE || "";

const form = document.querySelector("#postForm");
const jobsEl = document.querySelector("#jobs");
const refreshJobs = document.querySelector("#refreshJobs");
const runScheduler = document.querySelector("#runScheduler");

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...(options.headers || {}),
    },
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "request failed");
  return data;
}

function selectedPlatforms() {
  return [...form.querySelectorAll("input[name='platforms']:checked")].map((input) => input.value);
}

async function loadJobs() {
  const data = await request("/api/jobs");
  jobsEl.innerHTML = "";
  for (const job of data.jobs) {
    const item = document.createElement("div");
    item.className = "job";
    const retry = job.status === "failed" || job.status === "queued"
      ? `<button data-retry="${job.id}" type="button">재시도</button>`
      : "";
    item.innerHTML = `
      <strong>${job.platform}</strong>
      <span class="status ${job.status}">${job.status}</span>
      <span>${job.title || ""}${job.error_message ? ` - ${job.error_message}` : ""}</span>
      ${retry}
    `;
    jobsEl.appendChild(item);
  }
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = new FormData(form);
  const platforms = selectedPlatforms();
  if (platforms.length === 0) {
    alert("플랫폼을 하나 이상 선택하세요.");
    return;
  }

  const post = await request("/api/posts", {
    method: "POST",
    body: JSON.stringify({
      title: data.get("title"),
      body: data.get("body"),
      link_url: data.get("link_url"),
      hashtags: data.get("hashtags"),
      image_key: data.get("image_key"),
      platforms,
    }),
  });

  const mode = data.get("mode");
  await request(`/api/posts/${post.post_id}/publish`, {
    method: "POST",
    body: JSON.stringify({
      mode,
      scheduled_at: mode === "scheduled" ? data.get("scheduled_at") : undefined,
    }),
  });

  form.reset();
  await loadJobs();
});

jobsEl.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-retry]");
  if (!button) return;
  await request(`/api/jobs/${button.dataset.retry}/retry`, { method: "POST", body: "{}" });
  await loadJobs();
});

refreshJobs.addEventListener("click", loadJobs);
runScheduler.addEventListener("click", async () => {
  await request("/api/scheduler/run", { method: "POST", body: "{}" });
  await loadJobs();
});

loadJobs().catch((error) => {
  jobsEl.textContent = error.message;
});
