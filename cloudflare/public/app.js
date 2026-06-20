const API_BASE = window.API_BASE || "";
const MAX_IMAGE_SIZE = 8 * 1024 * 1024;

const form = document.querySelector("#postForm");
const jobsEl = document.querySelector("#jobs");
const refreshJobs = document.querySelector("#refreshJobs");
const runScheduler = document.querySelector("#runScheduler");
const imageFile = document.querySelector("#imageFile");
const imagePreview = document.querySelector("#imagePreview");
const clearImage = document.querySelector("#clearImage");
const accountConnections = document.querySelector("#accountConnections");
const systemReadiness = document.querySelector("#systemReadiness");
const adminSettingsForm = document.querySelector("#adminSettingsForm");
const adminSettingsStatus = document.querySelector("#adminSettingsStatus");
const adminSettingsSummary = document.querySelector("#adminSettingsSummary");
const adminSettingsDialog = document.querySelector("#adminSettingsDialog");
const openAdminSettings = document.querySelector("#openAdminSettings");
const openAdminSettingsSide = document.querySelector("#openAdminSettingsSide");
const closeAdminSettings = document.querySelector("#closeAdminSettings");
const cancelAdminSettings = document.querySelector("#cancelAdminSettings");
const workspaceSummary = document.querySelector("#workspaceSummary");
const toast = document.querySelector("#toast");
const submitPost = document.querySelector("#submitPost");
const formStatus = document.querySelector("#formStatus");
const titleCount = document.querySelector("#titleCount");
const bodyCount = document.querySelector("#bodyCount");
const scheduledAtGroup = document.querySelector("#scheduledAtGroup");

let previewUrl = "";
const appState = {
  accounts: [],
  readiness: null,
  system: null,
  jobs: [],
};

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
    throw new Error(looksLikeHtml ? "Cloudflare 함수가 JSON을 반환하지 않습니다." : "API 응답을 해석할 수 없습니다.");
  }
  if (!response.ok) throw new Error(data.error || "요청을 처리하지 못했습니다.");
  return data;
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function showToast(message, tone = "success") {
  if (!toast) return;
  toast.textContent = message;
  toast.className = `toast show ${tone}`;
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => {
    toast.className = "toast";
  }, 3200);
}

function setBusy(button, busy, label) {
  if (!button) return;
  button.disabled = busy;
  if (label) button.textContent = label;
}

function openSettingsDialog() {
  if (!adminSettingsDialog) return;
  if (typeof adminSettingsDialog.showModal === "function") {
    adminSettingsDialog.showModal();
  } else {
    adminSettingsDialog.setAttribute("open", "");
  }
}

function closeSettingsDialog() {
  if (!adminSettingsDialog) return;
  if (typeof adminSettingsDialog.close === "function") {
    adminSettingsDialog.close();
  } else {
    adminSettingsDialog.removeAttribute("open");
  }
}

function platformLabel(platform) {
  return {
    instagram: "Instagram Business",
    threads: "Threads",
    kakao: "Kakao",
  }[platform] || platform;
}

function platformInitial(platform) {
  return {
    instagram: "IG",
    threads: "TH",
    kakao: "KA",
  }[platform] || platform.slice(0, 2).toUpperCase();
}

function missingLabel(key) {
  return {
    client_id: "App ID",
    client_secret: "App Secret",
    oauth_state_secret: "OAuth state secret",
    token_encryption_key: "Token encryption key",
  }[key] || key;
}

function statusLabel(status) {
  return {
    queued: "대기",
    running: "발행 중",
    scheduled: "예약",
    success: "성공",
    failed: "실패",
    missing: "없음",
  }[status] || status || "알 수 없음";
}

function formatDateTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function selectedPlatforms() {
  return [...form.querySelectorAll("input[name='platforms']:checked")].map((input) => input.value);
}

function updateSummary() {
  if (!workspaceSummary) return;
  const connectedCount = appState.accounts.filter((account) => account.status === "connected").length;
  const systemOk = Boolean(
    appState.system?.d1?.bound
    && appState.system?.d1?.schema_ready
    && appState.system?.r2?.bound
    && appState.system?.secrets?.admin_setup_key
    && appState.system?.secrets?.token_encryption_key,
  );
  const failedCount = appState.jobs.filter((job) => job.status === "failed").length;
  const activeCount = appState.jobs.filter((job) => ["queued", "running", "scheduled"].includes(job.status)).length;

  workspaceSummary.innerHTML = `
    <article class="summaryItem ${connectedCount ? "ready" : "missing"}">
      <span class="summaryIcon" aria-hidden="true">A</span>
      <div>
        <strong>계정</strong>
        <p>${connectedCount ? `${connectedCount}개 연결됨` : "연결 대기"}</p>
      </div>
    </article>
    <article class="summaryItem ${systemOk ? "ready" : "missing"}">
      <span class="summaryIcon" aria-hidden="true">S</span>
      <div>
        <strong>시스템</strong>
        <p>${systemOk ? "정상" : "확인 필요"}</p>
      </div>
    </article>
    <article class="summaryItem ${failedCount ? "missing" : "ready"}">
      <span class="summaryIcon" aria-hidden="true">J</span>
      <div>
        <strong>작업</strong>
        <p>${failedCount ? `${failedCount}개 실패` : `${activeCount}개 진행`}</p>
      </div>
    </article>
  `;
}

function renderConnectionCard(platform, readiness, account) {
  const configured = Boolean(readiness?.configured);
  const missing = readiness?.missing || [];
  const connected = account?.status === "connected";
  const badge = connected
    ? `<span class="statusBadge ok">연결됨</span>`
    : configured
      ? `<span class="statusBadge pending">승인 가능</span>`
      : `<span class="statusBadge missing">설정 필요</span>`;
  const statusText = connected
    ? escapeHtml(account.username || account.account_id)
    : configured
      ? "계정 승인 대기"
      : missing.map(missingLabel).join(", ");
  const action = connected
    ? `<button class="secondaryButton" type="button" data-disconnect="${platform}">연결 해제</button>`
    : configured
      ? `<a class="linkButton primary" href="/api/auth/meta/start?platform=${platform}">연결하기</a>`
      : `<button class="secondaryButton" type="button" data-open-admin>설정 열기</button>`;

  return `
    <article class="connectionCard ${connected ? "connected" : ""}">
      <div class="platformMark" aria-hidden="true">${platformInitial(platform)}</div>
      <div class="connectionBody">
        <div class="cardTitleRow">
          <h3>${platformLabel(platform)}</h3>
          ${badge}
        </div>
        <p>${statusText || "확인 필요"}</p>
      </div>
      ${action}
    </article>
  `;
}

async function loadConnections() {
  if (!accountConnections) return;
  accountConnections.innerHTML = `<div class="skeletonBlock"></div>`;
  const readiness = await request("/api/oauth/meta/readiness").catch(() => ({
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
  appState.accounts = accounts;
  appState.readiness = readiness;
  updateSummary();

  const accountError = accountsData.error
    ? `<div class="connectionWarning">계정 상태 확인 필요: ${escapeHtml(accountsData.error)}</div>`
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
    ["관리자 키", status.admin_setup_key_configured],
    ["암호화 키", status.token_encryption_key_configured],
    ["Meta App ID", status.meta_app_id_configured],
    ["Meta Secret", status.meta_app_secret_configured],
  ];
  adminSettingsStatus.innerHTML = rows.map(([label, ok]) => `
    <span class="${ok ? "ok" : "missing"}">${label}: ${ok ? "설정됨" : "필요"}</span>
  `).join("");
}

function renderAdminSettingsSummary(status) {
  if (!adminSettingsSummary) return;
  const metaReady = Boolean(status.meta_app_id_configured && status.meta_app_secret_configured);
  const secureReady = Boolean(status.admin_setup_key_configured && status.token_encryption_key_configured);
  adminSettingsSummary.innerHTML = `
    <span class="${secureReady ? "ok" : "missing"}">보안 키: ${secureReady ? "정상" : "확인 필요"}</span>
    <span class="${metaReady ? "ok" : "missing"}">Meta App: ${metaReady ? "설정됨" : "입력 필요"}</span>
  `;
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
  renderAdminSettingsSummary(status);
  if (status.error) {
    adminSettingsStatus.insertAdjacentHTML("beforeend", `<span class="missing">저장소 확인 필요: ${escapeHtml(status.error)}</span>`);
    adminSettingsSummary?.insertAdjacentHTML("beforeend", `<span class="missing">확인 실패</span>`);
  }
}

function readinessItem(label, ok, detail = "") {
  return `
    <article class="readinessItem ${ok ? "ready" : "missing"}">
      <strong>${escapeHtml(label)}</strong>
      <span>${ok ? "정상" : "필요"}</span>
      ${detail ? `<small>${escapeHtml(detail)}</small>` : ""}
    </article>
  `;
}

async function loadSystemReadiness() {
  if (!systemReadiness) return;
  systemReadiness.innerHTML = `<div class="skeletonBlock"></div>`;
  const status = await request("/api/system/readiness").catch((error) => ({ error: error.message }));
  if (status.error) {
    systemReadiness.innerHTML = readinessItem("시스템 상태", false, status.error);
    appState.system = null;
    updateSummary();
    return;
  }
  appState.system = status;
  updateSummary();
  const missingTables = Object.entries(status.d1?.tables || {})
    .filter(([, ok]) => !ok)
    .map(([name]) => name);
  systemReadiness.innerHTML = [
    readinessItem("D1 DB", Boolean(status.d1?.bound), "DB"),
    readinessItem("스키마", Boolean(status.d1?.schema_ready), missingTables.length ? `누락: ${missingTables.join(", ")}` : "적용 완료"),
    readinessItem("R2 이미지", Boolean(status.r2?.bound), "ASSETS"),
    readinessItem("관리자 키", Boolean(status.secrets?.admin_setup_key), "ADMIN_SETUP_KEY"),
    readinessItem("암호화 키", Boolean(status.secrets?.token_encryption_key), "TOKEN_ENCRYPTION_KEY"),
  ].join("");
}

function clearImagePreview() {
  if (previewUrl) URL.revokeObjectURL(previewUrl);
  previewUrl = "";
  imagePreview.textContent = "선택된 이미지가 없습니다.";
  clearImage.disabled = true;
  form.elements.image_key.value = "";
  form.elements.image_url.value = "";
}

function updateFormMeta() {
  const title = form.elements.title.value || "";
  const body = form.elements.body.value || "";
  const mode = form.elements.mode.value;
  titleCount.textContent = `${title.length} / 120`;
  bodyCount.textContent = `${body.length}자`;
  scheduledAtGroup.classList.toggle("isHidden", mode !== "scheduled");
  form.elements.scheduled_at.required = mode === "scheduled";
}

imageFile.addEventListener("change", () => {
  const file = imageFile.files?.[0];
  clearImagePreview();
  if (!file) return;
  if (!file.type.startsWith("image/")) {
    showToast("이미지 파일만 선택할 수 있습니다.", "error");
    imageFile.value = "";
    return;
  }
  if (file.size > MAX_IMAGE_SIZE) {
    showToast("이미지는 8MB 이하로 선택해 주세요.", "error");
    imageFile.value = "";
    return;
  }

  previewUrl = URL.createObjectURL(file);
  clearImage.disabled = false;
  imagePreview.innerHTML = `
    <img src="${previewUrl}" alt="선택한 이미지 미리보기" />
    <div>
      <strong>${escapeHtml(file.name)}</strong>
      <span>${Math.ceil(file.size / 1024)} KB · 업로드 전</span>
    </div>
  `;
});

clearImage.addEventListener("click", () => {
  imageFile.value = "";
  clearImagePreview();
});

async function uploadSelectedImage() {
  const file = imageFile.files?.[0];
  if (!file) return { image_key: "", image_url: "" };

  const uploadBody = new FormData();
  uploadBody.set("image", file);
  imagePreview.classList.add("uploading");
  formStatus.textContent = "이미지 업로드 중";
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

function renderEmptyJobs() {
  jobsEl.innerHTML = `
    <div class="emptyState">
      <strong>아직 발행 작업이 없습니다.</strong>
      <span>게시글을 저장하고 발행하면 이곳에 작업 상태가 표시됩니다.</span>
    </div>
  `;
}

async function loadJobs() {
  if (!jobsEl) return;
  jobsEl.innerHTML = `<div class="skeletonBlock"></div>`;
  const data = await request("/api/jobs");
  const jobs = data.jobs || [];
  appState.jobs = jobs;
  updateSummary();
  if (jobs.length === 0) {
    renderEmptyJobs();
    return;
  }
  jobsEl.innerHTML = jobs.map((job) => {
    const retry = job.status === "failed" || job.status === "queued"
      ? `<button class="secondaryButton" data-retry="${job.id}" type="button">재시도</button>`
      : "";
    const link = job.external_post_url
      ? `<a class="jobLink" href="${escapeHtml(job.external_post_url)}" target="_blank" rel="noreferrer">게시물 열기</a>`
      : "";
    return `
      <article class="job">
        <div class="platformMark" aria-hidden="true">${platformInitial(job.platform)}</div>
        <div>
          <strong>${platformLabel(job.platform)}</strong>
          <p>${escapeHtml(job.title || "제목 없음")}</p>
        </div>
        <span class="status ${escapeHtml(job.status)}">${statusLabel(job.status)}</span>
        <div class="jobMeta">
          <span>${formatDateTime(job.updated_at || job.created_at)}</span>
          ${job.error_message ? `<small>${escapeHtml(job.error_message)}</small>` : ""}
        </div>
        <div class="jobActions">${link}${retry}</div>
      </article>
    `;
  }).join("");
}

form.addEventListener("input", updateFormMeta);
form.addEventListener("change", updateFormMeta);

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = new FormData(form);
  const platforms = selectedPlatforms();
  if (platforms.length === 0) {
    showToast("플랫폼을 하나 이상 선택하세요.", "error");
    return;
  }

  setBusy(submitPost, true, "처리 중");
  formStatus.textContent = "발행 요청 중";
  try {
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
    updateFormMeta();
    formStatus.textContent = "완료";
    showToast(mode === "scheduled" ? "예약 작업을 만들었습니다." : "발행 작업을 만들었습니다.");
    await loadJobs();
  } catch (error) {
    formStatus.textContent = "실패";
    showToast(error.message, "error");
  } finally {
    setBusy(submitPost, false, "게시글 저장 및 발행");
  }
});

jobsEl.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-retry]");
  if (!button) return;
  setBusy(button, true, "재시도 중");
  try {
    await request(`/api/jobs/${button.dataset.retry}/retry`, { method: "POST", body: "{}" });
    showToast("작업을 다시 실행했습니다.");
    await loadJobs();
  } catch (error) {
    showToast(error.message, "error");
    setBusy(button, false, "재시도");
  }
});

accountConnections?.addEventListener("click", async (event) => {
  const setupButton = event.target.closest("[data-open-admin]");
  if (setupButton) {
    openSettingsDialog();
    return;
  }

  const button = event.target.closest("[data-disconnect]");
  if (!button) return;
  setBusy(button, true, "해제 중");
  try {
    await request("/api/social-accounts/disconnect", {
      method: "POST",
      body: JSON.stringify({ platform: button.dataset.disconnect }),
    });
    showToast("계정 연결을 해제했습니다.");
    await loadConnections();
  } catch (error) {
    showToast(error.message, "error");
    setBusy(button, false, "연결 해제");
  }
});

adminSettingsForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const submitButton = adminSettingsForm.querySelector("button[type='submit']");
  const data = new FormData(adminSettingsForm);
  const payload = {
    admin_key: data.get("admin_key"),
    meta_app_id: data.get("meta_app_id"),
    meta_app_secret: data.get("meta_app_secret"),
  };
  setBusy(submitButton, true, "저장 중");
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
    renderAdminSettingsSummary({
      admin_setup_key_configured: true,
      token_encryption_key_configured: true,
      meta_app_id_configured: result.meta_app_id_configured,
      meta_app_secret_configured: result.meta_app_secret_configured,
    });
    showToast("관리자 설정을 저장했습니다.");
    closeSettingsDialog();
    await loadConnections();
  } catch (error) {
    adminSettingsStatus.innerHTML = `<span class="missing">설정 저장 실패: ${escapeHtml(error.message)}</span>`;
    showToast(error.message, "error");
  } finally {
    setBusy(submitButton, false, "설정 저장");
  }
});

refreshJobs.addEventListener("click", async () => {
  setBusy(refreshJobs, true, "새로고침 중");
  try {
    await Promise.all([loadJobs(), loadConnections(), loadSystemReadiness(), loadAdminSettingsStatus()]);
    showToast("상태를 새로고침했습니다.");
  } catch (error) {
    showToast(error.message, "error");
  } finally {
    setBusy(refreshJobs, false, "작업 새로고침");
  }
});

runScheduler.addEventListener("click", async () => {
  setBusy(runScheduler, true, "실행 중");
  try {
    const result = await request("/api/scheduler/run", { method: "POST", body: "{}" });
    showToast(`${result.processed?.length || 0}개 예약 작업을 확인했습니다.`);
    await loadJobs();
  } catch (error) {
    showToast(error.message, "error");
  } finally {
    setBusy(runScheduler, false, "예약 작업 실행");
  }
});

openAdminSettings?.addEventListener("click", openSettingsDialog);
openAdminSettingsSide?.addEventListener("click", openSettingsDialog);
closeAdminSettings?.addEventListener("click", closeSettingsDialog);
cancelAdminSettings?.addEventListener("click", closeSettingsDialog);
adminSettingsDialog?.addEventListener("click", (event) => {
  if (event.target === adminSettingsDialog) closeSettingsDialog();
});

const oauthResult = new URLSearchParams(window.location.search);
if (oauthResult.get("connected")) {
  showToast("계정 연결이 완료됐습니다.");
  history.replaceState({}, "", window.location.pathname);
}
if (oauthResult.get("oauth_error")) {
  showToast(`계정 연결 실패: ${oauthResult.get("oauth_error")}`, "error");
  history.replaceState({}, "", window.location.pathname);
}

updateFormMeta();
loadConnections().catch((error) => {
  if (accountConnections) accountConnections.textContent = error.message;
});
loadSystemReadiness();
loadAdminSettingsStatus();
loadJobs().catch((error) => {
  jobsEl.innerHTML = `<div class="emptyState error"><strong>작업을 불러오지 못했습니다.</strong><span>${escapeHtml(error.message)}</span></div>`;
});
