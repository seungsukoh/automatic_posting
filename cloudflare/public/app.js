const API_BASE = window.API_BASE || "";

const form = document.querySelector("#postForm");
const jobsEl = document.querySelector("#jobs");
const refreshJobs = document.querySelector("#refreshJobs");
const runScheduler = document.querySelector("#runScheduler");
const imageFile = document.querySelector("#imageFile");
const imagePreview = document.querySelector("#imagePreview");
let previewUrl = "";
const setupInputs = document.querySelectorAll("[data-setup]");
const setupStateKey = "automatic-posting.setup";

function loadSetupState() {
  const saved = JSON.parse(localStorage.getItem(setupStateKey) || "{}");
  setupInputs.forEach((input) => {
    input.checked = Boolean(saved[input.dataset.setup]);
  });
}

function saveSetupState() {
  const state = {};
  setupInputs.forEach((input) => {
    state[input.dataset.setup] = input.checked;
  });
  localStorage.setItem(setupStateKey, JSON.stringify(state));
}

setupInputs.forEach((input) => input.addEventListener("change", saveSetupState));
loadSetupState();

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

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function safeImageKey(file) {
  const cleaned = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
  return `uploads/${Date.now()}-${cleaned}`;
}

function clearImagePreview() {
  if (previewUrl) URL.revokeObjectURL(previewUrl);
  previewUrl = "";
  imagePreview.textContent = "선택된 이미지가 없습니다.";
  form.elements.image_key.value = "";
}

imageFile.addEventListener("change", () => {
  const file = imageFile.files?.[0];
  clearImagePreview();
  if (!file) return;
  if (!file.type.startsWith("image/")) {
    alert("이미지 파일만 선택할 수 있습니다.");
    imageFile.value = "";
    return;
  }

  previewUrl = URL.createObjectURL(file);
  form.elements.image_key.value = safeImageKey(file);
  imagePreview.innerHTML = `
    <img src="${previewUrl}" alt="선택한 이미지 미리보기" />
    <div>
      <strong>${escapeHtml(file.name)}</strong>
      <span>${Math.ceil(file.size / 1024)} KB</span>
    </div>
  `;
});

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
  clearImagePreview();
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
