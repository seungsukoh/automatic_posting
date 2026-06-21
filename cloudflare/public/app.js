const API_BASE = window.API_BASE || "";
const MAX_IMAGE_SIZE = 8 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const IMAGE_TYPE_BY_EXTENSION = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};
const fileNameCollator = new Intl.Collator("ko-KR", { numeric: true, sensitivity: "base" });

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
const publishPreview = document.querySelector("#publishPreview");
const batchScheduleForm = document.querySelector("#batchScheduleForm");
const batchFolderInput = document.querySelector("#batchFolderInput");
const batchStartTime = document.querySelector("#batchStartTime");
const batchInterval = document.querySelector("#batchInterval");
const batchPlan = document.querySelector("#batchPlan");
const batchQueue = document.querySelector("#batchQueue");
const batchStatus = document.querySelector("#batchStatus");
const submitBatch = document.querySelector("#submitBatch");
const clearBatch = document.querySelector("#clearBatch");
const redirectUriValue = document.querySelector("#redirectUriValue");
const redirectUriMirrors = document.querySelectorAll(".redirectUriMirror");

let previewUrl = "";
const appState = {
  accounts: [],
  readiness: null,
  system: null,
  jobs: [],
  batchItems: [],
  batchSkipped: [],
  batchResults: {},
  batchSubmitting: false,
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

function formatFullDateTime(value) {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(date);
}

function localTimezoneLabel() {
  return new Intl.DateTimeFormat("ko-KR", { timeZoneName: "short" })
    .formatToParts(new Date())
    .find((part) => part.type === "timeZoneName")?.value || "브라우저 시간";
}

function fileExtension(name) {
  return String(name || "").split(".").pop()?.toLowerCase() || "";
}

function fileStem(name) {
  return String(name || "image").replace(/\.[^.]+$/, "") || "image";
}

function truncateText(value, maxLength) {
  const text = String(value || "").trim();
  if (text.length <= maxLength) return text;
  return `${text.slice(0, Math.max(0, maxLength - 3)).trimEnd()}...`;
}

function imageTypeForFile(file) {
  return file.type || IMAGE_TYPE_BY_EXTENSION[fileExtension(file.name)] || "";
}

function normalizedImageFile(file) {
  const type = imageTypeForFile(file);
  if (!type || file.type === type) return file;
  return new File([file], file.name, { type });
}

function parseDateFolderName(segment) {
  const match = String(segment || "").match(/^(\d{4})[-._]?(\d{2})[-._]?(\d{2})$/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
  return {
    key: `${match[1]}-${match[2]}-${match[3]}`,
    label: segment,
  };
}

function findDateFolder(segments) {
  for (const segment of segments.slice(0, -1)) {
    const parsed = parseDateFolderName(segment);
    if (parsed) return parsed;
  }
  return null;
}

function batchIntervalMinutes() {
  const value = Number(batchInterval?.value);
  if (!Number.isFinite(value) || value < 1) return 30;
  return Math.min(value, 1440);
}

function scheduledDateForBatchItem(item) {
  const [year, month, day] = item.dateKey.split("-").map(Number);
  const [rawHour, rawMinute] = String(batchStartTime?.value || "09:00").split(":").map(Number);
  const hour = Number.isFinite(rawHour) ? rawHour : 9;
  const minute = Number.isFinite(rawMinute) ? rawMinute : 0;
  return new Date(year, month - 1, day, hour, minute + item.indexWithinDate * batchIntervalMinutes(), 0, 0);
}

function scheduledAtForBatchItem(item) {
  return scheduledDateForBatchItem(item).toISOString();
}

function batchItemScheduleIssue(item) {
  const scheduledDate = scheduledDateForBatchItem(item);
  const [year, month, day] = item.dateKey.split("-").map(Number);
  const crossesDate = scheduledDate.getFullYear() !== year
    || scheduledDate.getMonth() !== month - 1
    || scheduledDate.getDate() !== day;
  if (scheduledDate.getTime() <= Date.now()) return "past";
  if (crossesDate) return "overflow";
  return "";
}

function batchItemTypeLabel(item) {
  return {
    "image/jpeg": "JPG",
    "image/png": "PNG",
    "image/webp": "WEBP",
  }[item.detectedType] || "이미지";
}

function batchResultFor(item) {
  return appState.batchResults[item.relativePath] || null;
}

function selectedPlatforms() {
  return [...form.querySelectorAll("input[name='platforms']:checked")].map((input) => input.value);
}

function formatPublishTextFromForm() {
  return [
    form.elements.title.value || "",
    form.elements.body.value || "",
    form.elements.link_url.value || "",
    form.elements.hashtags.value || "",
  ]
    .map((part) => String(part).trim())
    .filter(Boolean)
    .join("\n\n");
}

function previewStatusFor(platform) {
  if (platform === "instagram") {
    const file = imageFile.files?.[0];
    const hasImage = Boolean(file || form.elements.image_url.value);
    if (file && imageTypeForFile(file) !== "image/jpeg") {
      return {
        label: "JPG 필요",
        tone: "missing",
      };
    }
    return {
      label: hasImage ? "이미지 포함" : "이미지 필요",
      tone: hasImage ? "ok" : "missing",
    };
  }
  if (platform === "threads") return { label: "Mock 게시", tone: "pending" };
  if (platform === "kakao") return { label: "경로 미구성", tone: "missing" };
  return { label: "확인 필요", tone: "pending" };
}

function renderPublishPreview() {
  if (!publishPreview) return;
  const platforms = selectedPlatforms();
  const text = formatPublishTextFromForm();
  if (platforms.length === 0) {
    publishPreview.innerHTML = `
      <div class="emptyState compact">
        <strong>선택된 플랫폼이 없습니다.</strong>
        <span>플랫폼을 선택하면 최종 문구가 표시됩니다.</span>
      </div>
    `;
    return;
  }

  publishPreview.innerHTML = platforms.map((platform) => {
    const status = previewStatusFor(platform);
    const previewBody = text
      ? escapeHtml(text)
      : `<span class="previewEmpty">입력 대기</span>`;
    return `
      <article class="publishPreviewCard">
        <div class="previewHeader">
          <div>
            <strong>${platformLabel(platform)}</strong>
            <span>${text.length}자</span>
          </div>
          <span class="previewStatus ${status.tone}">${status.label}</span>
        </div>
        <pre class="previewText">${previewBody}</pre>
      </article>
    `;
  }).join("");
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
  renderPublishPreview();
}

function updateFormMeta() {
  const title = form.elements.title.value || "";
  const body = form.elements.body.value || "";
  const mode = form.elements.mode.value;
  titleCount.textContent = `${title.length} / 120`;
  bodyCount.textContent = `${body.length}자`;
  scheduledAtGroup.classList.toggle("isHidden", mode !== "scheduled");
  form.elements.scheduled_at.required = mode === "scheduled";
  renderPublishPreview();
}

function buildBatchItems(fileList) {
  const groups = new Map();
  const skipped = [];

  for (const file of [...(fileList || [])]) {
    const relativePath = file.webkitRelativePath || file.name;
    const segments = relativePath.split("/").filter(Boolean);
    const dateFolder = findDateFolder(segments);
    const detectedType = imageTypeForFile(file);

    if (!dateFolder) {
      skipped.push({ name: relativePath, reason: "날짜 폴더 없음" });
      continue;
    }
    if (!ALLOWED_IMAGE_TYPES.has(detectedType)) {
      skipped.push({ name: relativePath, reason: "이미지 형식 제외" });
      continue;
    }
    if (file.size <= 0) {
      skipped.push({ name: relativePath, reason: "빈 파일" });
      continue;
    }
    if (file.size > MAX_IMAGE_SIZE) {
      skipped.push({ name: relativePath, reason: "8MB 초과" });
      continue;
    }

    const group = groups.get(dateFolder.key) || [];
    group.push({
      file,
      fileName: file.name,
      relativePath,
      dateKey: dateFolder.key,
      dateLabel: dateFolder.label,
      detectedType,
    });
    groups.set(dateFolder.key, group);
  }

  const items = [];
  for (const dateKey of [...groups.keys()].sort()) {
    const group = groups.get(dateKey).sort((a, b) => fileNameCollator.compare(a.fileName, b.fileName));
    group.forEach((item, indexWithinDate) => {
      items.push({ ...item, indexWithinDate });
    });
  }

  return { items, skipped };
}

function batchValidationState(items, platforms) {
  const scheduledDates = items
    .map((item) => scheduledDateForBatchItem(item))
    .filter((date) => Number.isFinite(date.getTime()))
    .sort((a, b) => a.getTime() - b.getTime());
  const issues = items.map((item) => batchItemScheduleIssue(item));
  const jpgBlockCount = platforms.includes("instagram")
    ? items.filter((item) => item.detectedType !== "image/jpeg").length
    : 0;
  return {
    dateCount: new Set(items.map((item) => item.dateKey)).size,
    taskCount: items.length * platforms.length,
    firstDate: scheduledDates[0] || null,
    lastDate: scheduledDates[scheduledDates.length - 1] || null,
    noPlatforms: platforms.length === 0,
    hasKakao: platforms.includes("kakao"),
    hasThreads: platforms.includes("threads"),
    jpgBlockCount,
    pastCount: issues.filter((issue) => issue === "past").length,
    overflowCount: issues.filter((issue) => issue === "overflow").length,
  };
}

function skippedFixFor(reason) {
  return {
    "날짜 폴더 없음": "YYYY-MM-DD 날짜 폴더 안에 넣기",
    "이미지 형식 제외": "JPG, PNG, WEBP로 저장",
    "빈 파일": "파일을 다시 저장",
    "8MB 초과": "8MB 이하로 압축",
  }[reason] || "파일 확인";
}

function renderSkippedDetails(skipped) {
  if (!skipped.length) return "";
  return `
    <details class="batchSkipped">
      <summary>${skipped.length}개 파일 제외</summary>
      <div>
        ${skipped.slice(0, 12).map((entry) => `
          <article>
            <strong>${escapeHtml(entry.name)}</strong>
            <span>${escapeHtml(entry.reason)} · ${escapeHtml(skippedFixFor(entry.reason))}</span>
          </article>
        `).join("")}
        ${skipped.length > 12 ? `<small>외 ${skipped.length - 12}개</small>` : ""}
      </div>
    </details>
  `;
}

function renderBatchPlan() {
  if (!batchPlan) return;
  const items = appState.batchItems;
  const platforms = selectedPlatforms();
  const state = batchValidationState(items, platforms);
  const timeZone = localTimezoneLabel();

  if (items.length === 0) {
    batchPlan.innerHTML = `
      <div class="batchPlanEmpty">
        <strong>폴더 구조</strong>
        <span>상위폴더 / 2026-06-21 / 001.jpg</span>
        <span>날짜 폴더별 파일명 숫자순으로 예약됩니다.</span>
      </div>
    `;
    return;
  }

  const warnings = [
    state.noPlatforms ? "플랫폼을 하나 이상 선택하세요." : "",
    state.hasKakao ? "Kakao는 발송 경로가 아직 구성되지 않아 배치 예약에서 제외해야 합니다." : "",
    state.jpgBlockCount ? `Instagram 선택 시 JPG가 아닌 이미지 ${state.jpgBlockCount}개를 교체해야 합니다.` : "",
    state.pastCount ? `이미 지난 예약 시간 ${state.pastCount}개가 있습니다.` : "",
    state.overflowCount ? `간격 때문에 날짜 폴더 다음 날로 넘어가는 이미지 ${state.overflowCount}개가 있습니다.` : "",
    state.hasThreads ? "Threads는 현재 mock 게시 상태입니다." : "",
  ].filter(Boolean);

  const titleTemplate = String(form.elements.title.value || "").trim();
  const body = String(form.elements.body.value || "").trim();
  const link = String(form.elements.link_url.value || "").trim();
  const hashtags = String(form.elements.hashtags.value || "").trim();

  batchPlan.innerHTML = `
    <div class="batchMetricGrid">
      <article>
        <span>이미지</span>
        <strong>${items.length}개</strong>
      </article>
      <article>
        <span>날짜 폴더</span>
        <strong>${state.dateCount}일</strong>
      </article>
      <article>
        <span>예약 작업</span>
        <strong>${state.taskCount}개</strong>
      </article>
      <article>
        <span>시간대</span>
        <strong>${escapeHtml(timeZone)}</strong>
      </article>
    </div>
    <div class="batchRuleSummary">
      <span>첫 예약: <strong>${state.firstDate ? escapeHtml(formatFullDateTime(state.firstDate)) : "-"}</strong></span>
      <span>마지막 예약: <strong>${state.lastDate ? escapeHtml(formatFullDateTime(state.lastDate)) : "-"}</strong></span>
      <span>채널: <strong>${platforms.length ? platforms.map(platformLabel).join(", ") : "선택 필요"}</strong></span>
      <span>문구: <strong>${titleTemplate ? "작성 제목 사용" : "파일명 제목 사용"}</strong>${body || link || hashtags ? " · 본문/링크/해시태그 적용" : ""}</span>
    </div>
    ${warnings.length ? `
      <div class="batchChecks">
        ${warnings.map((warning) => `<span>${escapeHtml(warning)}</span>`).join("")}
      </div>
    ` : `
      <div class="batchChecks ok">
        <span>${state.taskCount}개 예약 작업을 만들 준비가 됐습니다.</span>
      </div>
    `}
  `;
}

function renderBatchQueue() {
  if (!batchQueue) return;
  const items = appState.batchItems;
  const skipped = appState.batchSkipped;
  const platforms = selectedPlatforms();
  const state = batchValidationState(items, platforms);
  const needsInstagramJpeg = platforms.includes("instagram") && items.some((item) => item.detectedType !== "image/jpeg");
  const hasPastItems = state.pastCount > 0;
  const hasKakao = state.hasKakao;
  const allSucceeded = items.length > 0 && items.every((item) => batchResultFor(item)?.status === "success");
  const remainingItems = items.filter((item) => batchResultFor(item)?.status !== "success");
  const remainingTaskCount = remainingItems.length * platforms.length;

  renderBatchPlan();

  if (submitBatch) {
    submitBatch.disabled = appState.batchSubmitting || allSucceeded || items.length === 0 || platforms.length === 0 || needsInstagramJpeg || hasPastItems || hasKakao;
    submitBatch.textContent = appState.batchSubmitting
      ? "예약 생성 중"
      : allSucceeded
      ? "예약 완료"
      : items.length && platforms.length
      ? `${remainingTaskCount || state.taskCount}개 예약 작업 만들기`
      : "예약 작업 만들기";
  }
  if (clearBatch) clearBatch.disabled = items.length === 0 && skipped.length === 0;

  if (items.length === 0) {
    batchQueue.className = "batchQueue emptyState compact";
    batchQueue.innerHTML = skipped.length
      ? `<strong>${skipped.length}개 파일이 제외되었습니다.</strong><span>날짜 폴더와 이미지 형식을 확인하세요.</span>${renderSkippedDetails(skipped)}`
      : `<strong>상위 폴더를 선택하세요.</strong><span>예: campaign / 2026-06-21 / 001.jpg</span>`;
    return;
  }

  const groups = new Map();
  for (const item of items) {
    const group = groups.get(item.dateKey) || [];
    group.push(item);
    groups.set(item.dateKey, group);
  }

  const skippedNotice = renderSkippedDetails(skipped);
  const instagramNotice = needsInstagramJpeg
    ? `<div class="batchWarning">Instagram 예약은 JPG 이미지만 사용할 수 있습니다.</div>`
    : "";
  const pastNotice = hasPastItems
    ? `<div class="batchWarning">이미 지난 예약 시간이 포함되어 있습니다. 날짜 폴더나 시작 시간을 조정하세요.</div>`
    : "";

  batchQueue.className = "batchQueue";
  batchQueue.innerHTML = `
    <div class="batchSummary">
      <strong>${items.length}개 예약 후보</strong>
      <span>${groups.size}일 · ${platforms.length || 0}개 채널 · ${state.taskCount}개 작업</span>
    </div>
    ${skippedNotice}
    ${instagramNotice}
    ${pastNotice}
    <div class="batchDateGroups">
      ${[...groups.entries()].map(([dateKey, group]) => `
        <section class="batchDateGroup">
          <div class="batchDateHeader">
            <strong>${dateKey}</strong>
            <span>${group.length}개</span>
          </div>
          ${group.map((item) => {
            const needsJpeg = platforms.includes("instagram") && item.detectedType !== "image/jpeg";
            const result = batchResultFor(item);
            return `
              <div class="batchFile">
                <span class="batchSequence">${item.indexWithinDate + 1}</span>
                <div class="batchFileMeta">
                  <strong>${escapeHtml(item.fileName)}</strong>
                  <small>${escapeHtml(item.relativePath)}</small>
                </div>
                <div class="batchFileSchedule">
                  <strong>${escapeHtml(formatFullDateTime(scheduledDateForBatchItem(item)))}</strong>
                  <span class="batchBadge ${needsJpeg || batchItemScheduleIssue(item) ? "warning" : ""}">
                    ${needsJpeg ? "JPG 필요" : batchItemScheduleIssue(item) === "past" ? "지난 시간" : batchItemScheduleIssue(item) === "overflow" ? "다음날" : batchItemTypeLabel(item)}
                  </span>
                  ${result ? `<span class="batchProgress ${result.status}">${escapeHtml(result.label)}</span>` : ""}
                </div>
              </div>
            `;
          }).join("")}
        </section>
      `).join("")}
    </div>
  `;
}

function clearBatchQueue() {
  appState.batchItems = [];
  appState.batchSkipped = [];
  appState.batchResults = {};
  if (batchFolderInput) batchFolderInput.value = "";
  if (batchStatus) batchStatus.textContent = "대기 중";
  renderBatchQueue();
}

function resetBatchResultsForPlanChange() {
  if (appState.batchSubmitting || Object.keys(appState.batchResults).length === 0) return;
  appState.batchResults = {};
  if (batchStatus && appState.batchItems.length) batchStatus.textContent = `${appState.batchItems.length}개 준비`;
}

imageFile.addEventListener("change", () => {
  const file = imageFile.files?.[0];
  clearImagePreview();
  if (!file) return;
  if (!ALLOWED_IMAGE_TYPES.has(imageTypeForFile(file))) {
    showToast("PNG, JPG, WEBP 이미지만 선택할 수 있습니다.", "error");
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
  renderPublishPreview();
});

clearImage.addEventListener("click", () => {
  imageFile.value = "";
  clearImagePreview();
});

async function uploadImageFileToAssets(file) {
  const uploadBody = new FormData();
  uploadBody.set("image", normalizedImageFile(file));
  return request("/api/assets/upload", {
    method: "POST",
    body: uploadBody,
  });
}

async function uploadSelectedImage() {
  const file = imageFile.files?.[0];
  if (!file) return { image_key: "", image_url: "" };

  imagePreview.classList.add("uploading");
  formStatus.textContent = "이미지 업로드 중";
  let result;
  try {
    result = await uploadImageFileToAssets(file);
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

async function createScheduledBatchItem(item, platforms, onStage = () => {}) {
  onStage("uploading", "업로드 중");
  const uploadedImage = await uploadImageFileToAssets(item.file);
  const fallbackTitle = fileStem(item.fileName);
  const titleTemplate = String(form.elements.title.value || "").trim();
  const title = truncateText(titleTemplate || fallbackTitle, 120) || "image";
  const body = String(form.elements.body.value || "").trim();
  onStage("creating", "게시글 생성 중");
  const post = await request("/api/posts", {
    method: "POST",
    body: JSON.stringify({
      title,
      body,
      link_url: form.elements.link_url.value,
      hashtags: form.elements.hashtags.value,
      image_key: uploadedImage.image_key,
      image_url: uploadedImage.image_url,
      platforms,
    }),
  });

  onStage("scheduling", "예약 등록 중");
  await request(`/api/posts/${post.post_id}/publish`, {
    method: "POST",
    body: JSON.stringify({
      mode: "scheduled",
      scheduled_at: scheduledAtForBatchItem(item),
    }),
  });
  onStage("success", "예약 완료");
}

form.addEventListener("input", () => {
  updateFormMeta();
  resetBatchResultsForPlanChange();
  renderBatchQueue();
});
form.addEventListener("change", () => {
  updateFormMeta();
  resetBatchResultsForPlanChange();
  renderBatchQueue();
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = new FormData(form);
  const platforms = selectedPlatforms();
  if (platforms.length === 0) {
    showToast("플랫폼을 하나 이상 선택하세요.", "error");
    return;
  }
  const selectedImage = imageFile.files?.[0];
  if (platforms.includes("instagram") && !selectedImage && !form.elements.image_url.value) {
    showToast("Instagram 발행에는 JPG 이미지가 필요합니다.", "error");
    return;
  }
  if (platforms.includes("instagram") && selectedImage && imageTypeForFile(selectedImage) !== "image/jpeg") {
    showToast("Instagram 게시 테스트는 JPG 이미지를 선택하세요.", "error");
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

batchFolderInput?.addEventListener("change", () => {
  const { items, skipped } = buildBatchItems(batchFolderInput.files);
  appState.batchItems = items;
  appState.batchSkipped = skipped;
  appState.batchResults = {};
  if (batchStatus) batchStatus.textContent = items.length ? `${items.length}개 준비` : "대기 중";
  renderBatchQueue();
});

batchStartTime?.addEventListener("input", () => {
  resetBatchResultsForPlanChange();
  renderBatchQueue();
});
batchInterval?.addEventListener("input", () => {
  resetBatchResultsForPlanChange();
  renderBatchQueue();
});
clearBatch?.addEventListener("click", clearBatchQueue);

batchScheduleForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const items = appState.batchItems;
  const platforms = selectedPlatforms();
  const state = batchValidationState(items, platforms);
  if (items.length === 0) {
    showToast("예약할 이미지가 없습니다.", "error");
    return;
  }
  if (platforms.length === 0) {
    showToast("플랫폼을 하나 이상 선택하세요.", "error");
    return;
  }
  if (state.hasKakao) {
    showToast("Kakao는 아직 배치 예약 발송 경로가 구성되지 않았습니다.", "error");
    renderBatchQueue();
    return;
  }
  if (state.pastCount > 0) {
    showToast("지난 예약 시간이 포함되어 있습니다. 날짜 폴더나 시작 시간을 조정하세요.", "error");
    renderBatchQueue();
    return;
  }
  if (state.jpgBlockCount > 0) {
    showToast("Instagram 예약은 JPG 이미지만 사용할 수 있습니다.", "error");
    renderBatchQueue();
    return;
  }

  const pendingItems = items.filter((item) => batchResultFor(item)?.status !== "success");
  if (pendingItems.length === 0) {
    showToast("이미 모든 예약 작업이 완료되었습니다.");
    renderBatchQueue();
    return;
  }

  appState.batchSubmitting = true;
  setBusy(submitBatch, true, "예약 생성 중");
  if (clearBatch) clearBatch.disabled = true;
  let created = 0;
  const failed = [];
  try {
    for (const item of pendingItems) {
      appState.batchResults[item.relativePath] = { status: "running", label: "대기 중" };
    }
    renderBatchQueue();

    for (const item of pendingItems) {
      const key = item.relativePath;
      if (batchStatus) batchStatus.textContent = `${created + failed.length + 1}/${pendingItems.length} 처리 중`;
      try {
        await createScheduledBatchItem(item, platforms, (status, label) => {
          appState.batchResults[key] = { status, label };
          renderBatchQueue();
        });
        created += 1;
      } catch (error) {
        const message = error instanceof Error ? error.message : "예약 생성 실패";
        appState.batchResults[key] = { status: "failed", label: "실패" };
        failed.push({
          item,
          message,
        });
        renderBatchQueue();
      }
    }

    if (created > 0) await loadJobs();
    if (failed.length > 0) {
      if (batchStatus) batchStatus.textContent = `${created}개 완료 / ${failed.length}개 실패`;
      showToast(`${failed.length}개 예약 실패: ${failed[0].message}`, "error");
    } else {
      if (batchStatus) batchStatus.textContent = "완료";
      showToast(`${created}개 예약 작업을 만들었습니다.`);
    }
  } finally {
    appState.batchSubmitting = false;
    setBusy(submitBatch, false, "예약 작업 만들기");
    renderBatchQueue();
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
renderBatchQueue();
const redirectUri = `${window.location.origin}/api/auth/meta/callback`;
if (redirectUriValue) redirectUriValue.textContent = redirectUri;
redirectUriMirrors.forEach((element) => {
  element.textContent = redirectUri;
});
loadConnections().catch((error) => {
  if (accountConnections) accountConnections.textContent = error.message;
});
loadSystemReadiness();
loadAdminSettingsStatus();
loadJobs().catch((error) => {
  jobsEl.innerHTML = `<div class="emptyState error"><strong>작업을 불러오지 못했습니다.</strong><span>${escapeHtml(error.message)}</span></div>`;
});
