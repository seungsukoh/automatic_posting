const API_BASE = window.API_BASE || "";

const form = document.querySelector("#postForm");
const jobsEl = document.querySelector("#jobs");
const refreshJobs = document.querySelector("#refreshJobs");
const runScheduler = document.querySelector("#runScheduler");
const imageFile = document.querySelector("#imageFile");
const imagePreview = document.querySelector("#imagePreview");
const accountConnections = document.querySelector("#accountConnections");
const systemReadiness = document.querySelector("#systemReadiness");
const adminSettingsForm = document.querySelector("#adminSettingsForm");
const adminSettingsStatus = document.querySelector("#adminSettingsStatus");
let previewUrl = "";
async function request(path, options = {}) {
  const headers = options.body instanceof FormData
    ? { ...(options.headers || {}) }
    : {
      "content-type": "application/json; charset=utf-8",
      ...(options.headers || {}),
    };
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });
  const text = await response.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    const contentType = response.headers.get("content-type") || "";
    const looksLikeHtml = contentType.includes("text/html") || text.trim().startsWith("<");
    throw new Error(looksLikeHtml ? "Cloudflare function is not returning JSON. Check deployment functions and bindings." : "Invalid API response.");
  }
  if (!response.ok) throw new Error(data.error || "request failed");
  return data;
}

function platformLabel(platform) {
  return {
    instagram: "Instagram Business",
    threads: "Threads",
    kakao: "Kakao",
  }[platform] || platform;
}

function missingLabel(key) {
  return {
    client_id: "App ID",
    client_secret: "App Secret",
    oauth_state_secret: "OAuth state secret",
    token_encryption_key: "Token encryption key",
  }[key] || key;
}

function renderConnectionCard(platform, readiness, account) {
  const configured = Boolean(readiness?.configured);
  const missing = readiness?.missing || [];
  const connected = account?.status === "connected";
  const statusText = connected
    ? `연결됨: ${escapeHtml(account.username || account.account_id)}`
    : configured
      ? "연결 준비 완료"
      : `설정 필요: ${missing.map(missingLabel).join(", ")}`;
  const action = connected
    ? `<button type="button" data-disconnect="${platform}">연결 해제</button>`
    : configured
      ? `<a class="linkButton primary" href="/api/auth/meta/start?platform=${platform}">연결하기</a>`
      : `<button type="button" disabled>설정값 필요</button>`;

  return `
    <article class="connectionCard">
      <div>
        <h3>${platformLabel(platform)}</h3>
        <p>${statusText}</p>
      </div>
      ${action}
    </article>
  `;
}

async function loadConnections() {
  if (!accountConnections) return;
  const fallbackRedirectUri = `${window.location.origin}/api/auth/meta/callback`;
  accountConnections.textContent = "연결 상태를 확인하고 있습니다.";
  const readiness = await request("/api/oauth/meta/readiness").catch(() => ({
    redirect_uri: fallbackRedirectUri,
    platforms: {
      instagram: { configured: false, missing: ["client_id", "client_secret", "oauth_state_secret", "token_encryption_key"] },
      threads: { configured: false, missing: ["client_id", "client_secret", "oauth_state_secret", "token_encryption_key"] },
    },
  }));
  const accountsData = await request("/api/social-accounts").catch((error) => ({
    accounts: [],
    error: error.message,
  }));
  const accounts = accountsData.accounts || [];
  const accountError = accountsData.error
    ? `<div class="connectionWarning">계정 상태 저장소 확인 필요: ${escapeHtml(accountsData.error)}</div>`
    : "";
  accountConnections.innerHTML = `
    ${accountError}
    <div class="connectionGrid">
      ${["instagram", "threads"].map((platform) => renderConnectionCard(
        platform,
        readiness.platforms?.[platform],
        accounts.find((account) => account.platform === platform && account.status !== "disconnected"),
      )).join("")}
    </div>
  `;
}

function renderAdminSettingsStatus(status) {
  if (!adminSettingsStatus) return;
  const rows = [
    ["관리자 설정 키", status.admin_setup_key_configured],
    ["토큰 암호화 키", status.token_encryption_key_configured],
    ["Meta App ID", status.meta_app_id_configured],
    ["Meta App Secret", status.meta_app_secret_configured],
  ];
  adminSettingsStatus.innerHTML = rows.map(([label, ok]) => `
    <span class="${ok ? "ok" : "missing"}">${label}: ${ok ? "설정됨" : "필요"}</span>
  `).join("");
}

async function loadAdminSettingsStatus() {
  if (!adminSettingsStatus) return;
  const status = await request("/api/admin/settings").catch((error) => ({
    admin_setup_key_configured: false,
    token_encryption_key_configured: false,
    meta_app_id_configured: false,
    meta_app_secret_configured: false,
    error: error.message,
  }));
  renderAdminSettingsStatus(status);
  if (status.error) {
    adminSettingsStatus.insertAdjacentHTML("beforeend", `<span class="missing">저장소 확인 필요: ${escapeHtml(status.error)}</span>`);
  }
}

function readinessItem(label, ok, detail = "") {
  return `
    <article class="readinessItem ${ok ? "ready" : "missing"}">
      <strong>${escapeHtml(label)}</strong>
      <span>${ok ? "준비됨" : "필요"}</span>
      ${detail ? `<small>${escapeHtml(detail)}</small>` : ""}
    </article>
  `;
}

async function loadSystemReadiness() {
  if (!systemReadiness) return;
  const status = await request("/api/system/readiness").catch((error) => ({ error: error.message }));
  if (status.error) {
    systemReadiness.innerHTML = readinessItem("시스템 상태", false, status.error);
    return;
  }
  const missingTables = Object.entries(status.d1?.tables || {})
    .filter(([, ok]) => !ok)
    .map(([name]) => name);
  systemReadiness.innerHTML = [
    readinessItem("D1 DB 바인딩", Boolean(status.d1?.bound), "Binding name: DB"),
    readinessItem("D1 스키마", Boolean(status.d1?.schema_ready), missingTables.length ? `누락 테이블: ${missingTables.join(", ")}` : "schema.sql 적용 완료"),
    readinessItem("R2 이미지 저장소", Boolean(status.r2?.bound), "Binding name: ASSETS"),
    readinessItem("관리자 설정 키", Boolean(status.secrets?.admin_setup_key), "ADMIN_SETUP_KEY"),
    readinessItem("토큰 암호화 키", Boolean(status.secrets?.token_encryption_key), "TOKEN_ENCRYPTION_KEY"),
  ].join("");
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

function clearImagePreview() {
  if (previewUrl) URL.revokeObjectURL(previewUrl);
  previewUrl = "";
  imagePreview.textContent = "선택된 이미지가 없습니다.";
  form.elements.image_key.value = "";
  form.elements.image_url.value = "";
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
  imagePreview.innerHTML = `
    <img src="${previewUrl}" alt="선택한 이미지 미리보기" />
    <div>
      <strong>${escapeHtml(file.name)}</strong>
      <span>${Math.ceil(file.size / 1024)} KB - 저장 전</span>
    </div>
  `;
});

async function uploadSelectedImage() {
  const file = imageFile.files?.[0];
  if (!file) return { image_key: "", image_url: "" };

  const uploadBody = new FormData();
  uploadBody.set("image", file);
  imagePreview.classList.add("uploading");
  let result;
  try {
    result = await request("/api/assets/upload", {
      method: "POST",
      body: uploadBody,
    });
  } finally {
    imagePreview.classList.remove("uploading");
  }
  form.elements.image_key.value = result.image_key;
  form.elements.image_url.value = result.image_url;
  imagePreview.innerHTML = `
    <img src="${previewUrl}" alt="선택한 이미지 미리보기" />
    <div>
      <strong>${escapeHtml(file.name)}</strong>
      <span>업로드 완료</span>
    </div>
  `;
  return result;
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

  const uploadedImage = await uploadSelectedImage();
  const post = await request("/api/posts", {
    method: "POST",
    body: JSON.stringify({
      title: data.get("title"),
      body: data.get("body"),
      link_url: data.get("link_url"),
      hashtags: data.get("hashtags"),
      image_key: uploadedImage.image_key,
      image_url: uploadedImage.image_url,
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

accountConnections?.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-disconnect]");
  if (!button) return;
  await request("/api/social-accounts/disconnect", {
    method: "POST",
    body: JSON.stringify({ platform: button.dataset.disconnect }),
  });
  await loadConnections();
});

adminSettingsForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = new FormData(adminSettingsForm);
  const payload = {
    admin_key: data.get("admin_key"),
    meta_app_id: data.get("meta_app_id"),
    meta_app_secret: data.get("meta_app_secret"),
  };
  try {
    const result = await request("/api/admin/settings", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    adminSettingsForm.reset();
    renderAdminSettingsStatus({
      admin_setup_key_configured: true,
      token_encryption_key_configured: true,
      meta_app_id_configured: result.meta_app_id_configured,
      meta_app_secret_configured: result.meta_app_secret_configured,
    });
    await loadConnections();
  } catch (error) {
    adminSettingsStatus.innerHTML = `<span class="missing">설정 저장 실패: ${escapeHtml(error.message)}</span>`;
  }
});

refreshJobs.addEventListener("click", loadJobs);
runScheduler.addEventListener("click", async () => {
  await request("/api/scheduler/run", { method: "POST", body: "{}" });
  await loadJobs();
});

const oauthResult = new URLSearchParams(window.location.search);
if (oauthResult.get("connected")) {
  history.replaceState({}, "", window.location.pathname);
}
if (oauthResult.get("oauth_error")) {
  alert(`계정 연결 실패: ${oauthResult.get("oauth_error")}`);
  history.replaceState({}, "", window.location.pathname);
}

loadConnections().catch((error) => {
  if (accountConnections) accountConnections.textContent = error.message;
});

loadSystemReadiness();
loadAdminSettingsStatus();

loadJobs().catch((error) => {
  jobsEl.textContent = error.message;
});
