const API_BASE = window.API_BASE || "";

const form = document.querySelector("#postForm");
const jobsEl = document.querySelector("#jobs");
const refreshJobs = document.querySelector("#refreshJobs");
const runScheduler = document.querySelector("#runScheduler");
const imageFile = document.querySelector("#imageFile");
const imagePreview = document.querySelector("#imagePreview");
const accountConnections = document.querySelector("#accountConnections");
let previewUrl = "";
const setupInputs = document.querySelectorAll("[data-setup]");
const setupStateKey = "automatic-posting.setup";
const wizardEl = document.querySelector("#setupWizard");
const wizardStepKey = "automatic-posting.setup.step";
const wizardSteps = [
  {
    key: "ig-business",
    platform: "Instagram",
    title: "Business 계정 전환 확인",
    body: "Instagram 앱에서 계정 유형이 Business 계정으로 전환되어 있는지 확인합니다.",
    action: "Instagram 앱에서 확인",
    url: "https://help.instagram.com/502981923235522",
  },
  {
    key: "ig-page",
    platform: "Instagram",
    title: "Facebook Page 연결",
    body: "Instagram Business 계정이 Facebook Page와 연결되어 있어야 Graph API 게시가 가능합니다.",
    action: "Meta Business Suite 열기",
    url: "https://business.facebook.com/",
  },
  {
    key: "ig-meta-app",
    platform: "Instagram",
    title: "Meta Developer App 생성",
    body: "Meta for Developers에서 앱을 만들고 Instagram Graph API와 OAuth redirect URI를 설정합니다.",
    action: "Meta for Developers 열기",
    url: "https://developers.facebook.com/apps/",
  },
  {
    key: "threads-basic",
    platform: "Threads",
    title: "Threads 기본 권한 확인",
    body: "Meta 앱 권한 목록에서 threads_basic 권한을 사용할 수 있는지 확인합니다.",
    action: "권한 문서 열기",
    url: "https://developers.facebook.com/docs/threads/",
  },
  {
    key: "threads-publish",
    platform: "Threads",
    title: "Threads 게시 권한 확인",
    body: "threads_content_publish 권한을 확인합니다. 이 권한이 있어야 앱에서 Threads 게시를 실행할 수 있습니다.",
    action: "Threads API 열기",
    url: "https://developers.facebook.com/docs/threads/",
  },
  {
    key: "kakao-channel",
    platform: "Kakao",
    title: "공식 발송 경로 선택",
    body: "일반 채팅방 자동 발송은 제외하고 카카오톡 채널, 비즈메시지, 알림톡, 친구톡 중 하나를 선택합니다.",
    action: "Kakao Business 열기",
    url: "https://business.kakao.com/",
  },
  {
    key: "kakao-ad",
    platform: "Kakao",
    title: "광고성 메시지 여부 결정",
    body: "홍보성 메시지라면 광고 표기, 수신 동의, 수신 거부, 야간 발송 제한을 고려해야 합니다.",
    action: "Kakao Business 열기",
    url: "https://business.kakao.com/",
  },
];

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

function setupState() {
  return JSON.parse(localStorage.getItem(setupStateKey) || "{}");
}

function currentWizardIndex() {
  const index = Number(localStorage.getItem(wizardStepKey) || "0");
  return Number.isFinite(index) ? Math.min(Math.max(index, 0), wizardSteps.length - 1) : 0;
}

function setSetupDone(key, done) {
  const state = setupState();
  state[key] = done;
  localStorage.setItem(setupStateKey, JSON.stringify(state));
  loadSetupState();
  renderWizard();
}

function renderWizard() {
  if (!wizardEl) return;
  const index = currentWizardIndex();
  const step = wizardSteps[index];
  const state = setupState();
  const doneCount = wizardSteps.filter((item) => state[item.key]).length;
  const done = Boolean(state[step.key]);
  wizardEl.innerHTML = `
    <div class="wizardMeta">
      <strong>${step.platform}</strong>
      <span>${index + 1} / ${wizardSteps.length}</span>
      <span>${doneCount}개 완료</span>
    </div>
    <div class="wizardBar"><span style="width: ${Math.round((doneCount / wizardSteps.length) * 100)}%"></span></div>
    <h3>${step.title}</h3>
    <p>${step.body}</p>
    <div class="wizardActions">
      <button type="button" data-wizard-prev ${index === 0 ? "disabled" : ""}>이전</button>
      <a class="linkButton" href="${step.url}" target="_blank" rel="noreferrer">${step.action}</a>
      <button type="button" data-wizard-done>${done ? "완료 취소" : "완료 체크"}</button>
      <button type="button" data-wizard-next ${index === wizardSteps.length - 1 ? "disabled" : ""}>다음</button>
    </div>
  `;
}

setupInputs.forEach((input) => input.addEventListener("change", () => {
  saveSetupState();
  renderWizard();
}));
loadSetupState();
renderWizard();

wizardEl?.addEventListener("click", (event) => {
  const target = event.target.closest("button");
  if (!target) return;
  const index = currentWizardIndex();
  if (target.matches("[data-wizard-prev]")) {
    localStorage.setItem(wizardStepKey, String(Math.max(index - 1, 0)));
    renderWizard();
  }
  if (target.matches("[data-wizard-next]")) {
    localStorage.setItem(wizardStepKey, String(Math.min(index + 1, wizardSteps.length - 1)));
    renderWizard();
  }
  if (target.matches("[data-wizard-done]")) {
    const step = wizardSteps[index];
    setSetupDone(step.key, !setupState()[step.key]);
  }
});

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
  accountConnections.innerHTML = `
    <div class="connectionHint">
      <strong>OAuth Redirect URI</strong>
      <code>${escapeHtml(fallbackRedirectUri)}</code>
      <span>연결 상태를 확인하고 있습니다.</span>
    </div>
  `;
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
    <div class="connectionHint">
      <strong>OAuth Redirect URI</strong>
      <code>${escapeHtml(readiness.redirect_uri)}</code>
      <span>Meta Developer App에 이 주소가 등록되어 있어야 합니다.</span>
    </div>
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

loadJobs().catch((error) => {
  jobsEl.textContent = error.message;
});
