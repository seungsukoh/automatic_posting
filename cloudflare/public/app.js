const API_BASE = window.API_BASE || import.meta.env.VITE_API_BASE || "";
const MAX_IMAGE_SIZE = 8 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const TEXT_CAPTION_EXTENSIONS = new Set(["txt", "md"]);
const CSV_CAPTION_EXTENSIONS = new Set(["csv"]);
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
const platformQuickPicker = document.querySelector("#platformQuickPicker");
const toast = document.querySelector("#toast");
const submitPost = document.querySelector("#submitPost");
const manualPostDetails = document.querySelector(".manualPostDetails");
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
const scheduleCalendar = document.querySelector("#scheduleCalendar");
const batchStatus = document.querySelector("#batchStatus");
const submitBatch = document.querySelector("#submitBatch");
const clearBatch = document.querySelector("#clearBatch");
const utmAuto = document.querySelector("#utmAuto");
const utmPreview = document.querySelector("#utmPreview");
const adminSettingsPanel = document.querySelector("#adminSettingsPanel");
const adminSettingsForm = document.querySelector("#adminSettingsForm");
const adminSettingsStatus = document.querySelector("#adminSettingsStatus");
const refreshAdminSettings = document.querySelector("#refreshAdminSettings");
const saveAdminSettings = document.querySelector("#saveAdminSettings");
const redirectUriValue = document.querySelector("#redirectUriValue");
const redirectUriMirrors = document.querySelectorAll(".redirectUriMirror");

let previewUrl = "";
let singlePostSubmitRequested = false;
let batchSubmitRequested = false;
const appState = {
  accounts: [],
  readiness: null,
  system: null,
  jobs: [],
  adminSettings: null,
  batchItems: [],
  batchSkipped: [],
  batchResults: {},
  batchDateGroups: {},
  batchSubmitting: false,
  platformSelectionInitialized: false,
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
    client_id: "앱 연결 준비",
    client_secret: "앱 연결 준비",
    oauth_state_secret: "앱 연결 준비",
    token_encryption_key: "앱 연결 준비",
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

function settingSourceLabel(source) {
  return {
    admin_settings: "관리자 설정",
    "Cloudflare secret": "Cloudflare secret",
    META_APP_ID: "Cloudflare META_APP_ID",
    META_APP_SECRET: "Cloudflare META_APP_SECRET",
    INSTAGRAM_CLIENT_ID: "Cloudflare INSTAGRAM_CLIENT_ID",
    INSTAGRAM_CLIENT_SECRET: "Cloudflare INSTAGRAM_CLIENT_SECRET",
    META_LOGIN_CONFIG_ID: "Cloudflare META_LOGIN_CONFIG_ID",
    THREADS_CLIENT_ID: "Cloudflare THREADS_CLIENT_ID",
    THREADS_CLIENT_SECRET: "Cloudflare THREADS_CLIENT_SECRET",
  }[source] || "미설정";
}

function settingStatusLabel(configured) {
  return configured ? "설정됨" : "미설정";
}

function dateKeyFromDate(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
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

function jpegFileName(name) {
  const clean = String(name || "image").replace(/\.[^.]+$/, "");
  return `${clean || "image"}.jpg`;
}

async function convertImageToJpeg(file) {
  const type = imageTypeForFile(file);
  const source = normalizedImageFile(file);
  if (type === "image/jpeg") return source;

  const bitmap = await createImageBitmap(source);
  try {
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas is not available.");
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, 0, 0);
    const blob = await new Promise((resolve, reject) => {
      canvas.toBlob((result) => {
        if (result) resolve(result);
        else reject(new Error("Image conversion failed."));
      }, "image/jpeg", 0.92);
    });
    return new File([blob], jpegFileName(file.name), { type: "image/jpeg" });
  } finally {
    bitmap.close?.();
  }
}

function formValue(name) {
  return String(form.elements[name]?.value || "").trim();
}

function campaignMetadata(sourceFile = "") {
  return {
    campaign_name: formValue("campaign_name"),
    campaign_tags: formValue("campaign_tags"),
    campaign_goal: formValue("campaign_goal"),
    source_file: sourceFile,
  };
}

function slugifyCampaign(value) {
  return String(value || "")
    .normalize("NFKC")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^\p{Letter}\p{Number}_-]+/gu, "")
    .replace(/-+/g, "-")
    .slice(0, 80) || "automatic-posting";
}

function applyAutoUtm(rawUrl, platforms, contentKey = "") {
  const cleanUrl = String(rawUrl || "").trim();
  if (!cleanUrl || !utmAuto?.checked) return cleanUrl;
  let url;
  try {
    url = new URL(cleanUrl);
  } catch {
    return cleanUrl;
  }
  const source = platforms.length === 1 ? platforms[0] : "social";
  const campaign = slugifyCampaign(formValue("campaign_name") || "automatic-posting");
  if (!url.searchParams.has("utm_source")) url.searchParams.set("utm_source", source);
  if (!url.searchParams.has("utm_medium")) url.searchParams.set("utm_medium", "social");
  if (!url.searchParams.has("utm_campaign")) url.searchParams.set("utm_campaign", campaign);
  if (contentKey && !url.searchParams.has("utm_content")) {
    url.searchParams.set("utm_content", slugifyCampaign(contentKey));
  }
  return url.toString();
}

function renderUtmPreview() {
  if (!utmPreview) return;
  const link = formValue("link_url");
  if (!link) {
    utmPreview.className = "utmPreview";
    utmPreview.textContent = "링크를 입력하면 UTM 미리보기가 표시됩니다.";
    return;
  }
  try {
    new URL(link);
  } catch {
    utmPreview.className = "utmPreview";
    utmPreview.textContent = "https://로 시작하는 올바른 링크를 입력하면 UTM을 붙일 수 있습니다.";
    return;
  }
  if (!utmAuto?.checked) {
    utmPreview.className = "utmPreview";
    utmPreview.textContent = "UTM 자동 추가가 꺼져 있습니다.";
    return;
  }
  utmPreview.className = "utmPreview ready";
  utmPreview.textContent = applyAutoUtm(link, selectedPlatforms(), "preview");
}

function normalizeCaptionPath(value) {
  return String(value || "")
    .replaceAll("\\", "/")
    .split("/")
    .filter(Boolean)
    .join("/")
    .toLowerCase();
}

function normalizeCaptionFileName(value) {
  const parts = normalizeCaptionPath(value).split("/");
  return parts[parts.length - 1] || "";
}

function captionSidecarKey(dateKey, segments, fileName) {
  const parent = segments.slice(0, -1).join("/").toLowerCase();
  return `${dateKey}::${parent}::${fileStem(fileName).toLowerCase()}`;
}

function csvCaptionKeys(dateKey, reference) {
  const path = normalizeCaptionPath(reference);
  const fileName = normalizeCaptionFileName(reference);
  const stem = fileStem(fileName).toLowerCase();
  const keys = [];
  if (dateKey) {
    keys.push(`date:${dateKey}:path:${path}`);
    keys.push(`date:${dateKey}:file:${fileName}`);
    keys.push(`date:${dateKey}:stem:${stem}`);
  } else {
    keys.push(`global:path:${path}`);
    keys.push(`global:file:${fileName}`);
    keys.push(`global:stem:${stem}`);
  }
  return keys;
}

function csvLookupKeys(item) {
  const path = normalizeCaptionPath(item.relativePath);
  const fileName = normalizeCaptionFileName(item.fileName);
  const stem = fileStem(fileName).toLowerCase();
  return [
    `date:${item.dateKey}:path:${path}`,
    `date:${item.dateKey}:file:${fileName}`,
    `date:${item.dateKey}:stem:${stem}`,
    `global:path:${path}`,
    `global:file:${fileName}`,
    `global:stem:${stem}`,
  ];
}

function normalizeCsvHeader(value) {
  return String(value || "")
    .replace(/^\uFEFF/, "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

function parseCsvRows(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  const input = String(text || "").replace(/^\uFEFF/, "");

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    if (quoted) {
      if (char === '"' && input[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (char !== "\r") {
      field += char;
    }
  }
  row.push(field);
  if (row.some((cell) => String(cell).trim())) rows.push(row);
  return rows;
}

function parseCaptionCsv(text) {
  const rows = parseCsvRows(text);
  if (rows.length < 2) return [];
  const headers = rows[0].map(normalizeCsvHeader);
  return rows.slice(1)
    .filter((row) => row.some((cell) => String(cell).trim()))
    .map((row) => Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ""])));
}

function firstRowValue(row, names) {
  for (const name of names) {
    const value = String(row[name] || "").trim();
    if (value) return value;
  }
  return "";
}

function captionData(fields, source) {
  const data = {
    title: String(fields.title || "").trim(),
    body: String(fields.body || "").trim(),
    hashtags: String(fields.hashtags || "").trim(),
    link: String(fields.link || "").trim(),
    source,
  };
  return data.title || data.body || data.hashtags || data.link ? data : null;
}

function captionFromCsvRow(row, source) {
  return captionData({
    title: firstRowValue(row, ["title", "post_title", "제목"]),
    body: firstRowValue(row, ["body", "caption", "content", "copy", "본문", "문구", "캡션"]),
    hashtags: firstRowValue(row, ["hashtags", "hashtag", "tags", "tag", "해시태그", "태그"]),
    link: firstRowValue(row, ["link_url", "link", "url", "landing_url", "링크", "랜딩"]),
  }, source);
}

function parseTextCaption(text, source) {
  const clean = String(text || "").replace(/^\uFEFF/, "").trim();
  if (!clean) return null;
  const fields = {};
  const bodyLines = [];
  let structured = false;

  for (const line of clean.split(/\r?\n/)) {
    const match = line.match(/^\s*(title|제목|body|본문|caption|캡션|hashtags|해시태그|link|url|링크)\s*[:=]\s*(.*)$/i);
    if (match) {
      structured = true;
      const key = match[1].toLowerCase();
      if (key === "title" || key === "제목") fields.title = match[2];
      else if (key === "hashtags" || key === "해시태그") fields.hashtags = match[2];
      else if (key === "link" || key === "url" || key === "링크") fields.link = match[2];
      else fields.body = [fields.body, match[2]].filter(Boolean).join("\n");
    } else {
      bodyLines.push(line);
    }
  }

  if (structured) {
    return captionData({
      ...fields,
      body: fields.body || bodyLines.join("\n").trim(),
    }, source);
  }

  const lines = clean.split(/\r?\n/);
  const firstLine = lines[0]?.trim() || "";
  if (firstLine.startsWith("# ")) {
    return captionData({
      title: firstLine.replace(/^#\s+/, ""),
      body: lines.slice(1).join("\n").trim(),
    }, source);
  }

  return captionData({ body: clean }, source);
}

function mergeCaptionData(...captions) {
  const merged = { title: "", body: "", hashtags: "", link: "", source: "" };
  const sources = [];
  for (const caption of captions.filter(Boolean)) {
    if (caption.title) merged.title = caption.title;
    if (caption.body) merged.body = caption.body;
    if (caption.hashtags) merged.hashtags = caption.hashtags;
    if (caption.link) merged.link = caption.link;
    if (caption.source) sources.push(caption.source);
  }
  merged.source = [...new Set(sources)].join(" + ");
  return merged.title || merged.body || merged.hashtags || merged.link ? merged : null;
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

function addBatchWarning(warnings, item, message) {
  const existing = warnings.get(item.relativePath) || [];
  if (!existing.includes(message)) existing.push(message);
  warnings.set(item.relativePath, existing);
}

function batchDuplicateState(items, platforms) {
  const itemWarnings = new Map();
  const fileGroups = new Map();
  const planSlots = new Map();
  const existingSlots = new Set();
  let fileConflictCount = 0;
  let planConflictCount = 0;
  let existingConflictCount = 0;

  for (const item of items) {
    const key = `${item.dateKey}::${normalizeCaptionFileName(item.fileName)}`;
    const group = fileGroups.get(key) || [];
    group.push(item);
    fileGroups.set(key, group);
  }
  for (const group of fileGroups.values()) {
    if (group.length < 2) continue;
    fileConflictCount += group.length;
    group.forEach((item) => addBatchWarning(itemWarnings, item, "같은 날짜에 같은 파일명이 있습니다."));
  }

  for (const item of items) {
    const scheduledTime = scheduledDateForBatchItem(item).getTime();
    if (!Number.isFinite(scheduledTime)) continue;
    for (const platform of platforms) {
      const key = `${platform}::${scheduledTime}`;
      const group = planSlots.get(key) || [];
      group.push(item);
      planSlots.set(key, group);
    }
  }
  for (const [key, group] of planSlots.entries()) {
    if (group.length < 2) continue;
    planConflictCount += group.length;
    const platform = key.split("::")[0];
    group.forEach((item) => addBatchWarning(itemWarnings, item, `${platformLabel(platform)} 같은 시간 예약 후보가 있습니다.`));
  }

  for (const job of appState.jobs) {
    if (job.status !== "scheduled" || !job.scheduled_at || !job.platform) continue;
    const date = new Date(job.scheduled_at);
    if (!Number.isFinite(date.getTime())) continue;
    existingSlots.add(`${job.platform}::${date.getTime()}`);
  }
  for (const item of items) {
    const scheduledTime = scheduledDateForBatchItem(item).getTime();
    if (!Number.isFinite(scheduledTime)) continue;
    for (const platform of platforms) {
      if (!existingSlots.has(`${platform}::${scheduledTime}`)) continue;
      existingConflictCount += 1;
      addBatchWarning(itemWarnings, item, `${platformLabel(platform)}에 이미 같은 시간 예약이 있습니다.`);
    }
  }

  return {
    itemWarnings,
    fileConflictCount,
    planConflictCount,
    existingConflictCount,
    warningCount: [...itemWarnings.values()].reduce((total, messages) => total + messages.length, 0),
  };
}

function selectedPlatforms() {
  return [...form.querySelectorAll("input[name='platforms']:checked")].map((input) => input.value);
}

function accountForPlatform(platform) {
  return appState.accounts.find((account) => account.platform === platform && account.status !== "disconnected") || null;
}

function platformStatus(platform) {
  const account = accountForPlatform(platform);
  const readiness = appState.readiness?.platforms?.[platform];
  const configured = Boolean(readiness?.configured);
  const connected = account?.status === "connected";
  const serviceReady = configured;

  if (platform === "threads") {
    if (!serviceReady) {
      return {
        selectable: false,
        connected: false,
        label: "연결 준비 필요",
        detail: "Threads 연결 설정이 아직 준비되지 않았습니다.",
        tone: "missing",
      };
    }
    if (!connected) {
      return {
        selectable: false,
        connected: false,
        label: "계정 연결 필요",
        detail: "Threads 연결하기를 눌러 글 전용 게시 계정을 승인하세요.",
        tone: "pending",
      };
    }
    return {
      selectable: true,
      connected,
      label: "글 게시 가능",
      detail: account.username || account.account_id || "연결된 Threads 계정",
      tone: "ok",
    };
  }
  if (platform === "kakao") {
    return {
      selectable: false,
      connected: false,
      label: "사용 불가",
      detail: "현재 Instagram 게시만 사용할 수 있습니다.",
      tone: "missing",
    };
  }
  if (!serviceReady) {
    return {
      selectable: false,
      connected: false,
      label: "사용 불가",
      detail: "현재 이 채널은 사용할 수 없습니다.",
      tone: "missing",
    };
  }
  if (!connected) {
    return {
      selectable: false,
      connected: false,
      label: "계정 연결 필요",
      detail: "Instagram 연결하기를 눌러 게시할 계정을 승인하세요.",
      tone: "pending",
    };
  }
  return {
    selectable: true,
    connected: true,
    label: "예약 가능",
    detail: account.username || account.account_id || "연결된 계정",
    tone: "ok",
  };
}

function validatePublishablePlatforms(platforms) {
  if (platforms.length === 0) return "먼저 게시할 계정을 연결하고 플랫폼을 선택하세요.";
  const blocked = platforms
    .map((platform) => ({ platform, status: platformStatus(platform) }))
    .filter(({ status }) => !status.selectable);
  if (blocked.length === 0) return "";
  const first = blocked[0];
  return `${platformLabel(first.platform)}: ${first.status.detail}`;
}

function syncPlatformPicker() {
  const inputs = [...form.querySelectorAll("input[name='platforms']")];
  const readyInputs = [];

  inputs.forEach((input) => {
    const status = platformStatus(input.value);
    const label = input.closest("label");
    input.disabled = !status.selectable;
    if (!status.selectable) input.checked = false;
    label?.classList.toggle("disabled", !status.selectable);
    label?.setAttribute("title", status.detail);
    if (status.selectable) readyInputs.push(input);
  });

  if (!appState.platformSelectionInitialized && selectedPlatforms().length === 0 && readyInputs.length === 1) {
    readyInputs[0].checked = true;
    appState.platformSelectionInitialized = true;
  }

  if (!appState.platformSelectionInitialized && selectedPlatforms().length === 0 && readyInputs.length > 1) {
    const preferred = imageFile.files?.[0]
      ? readyInputs.find((input) => input.value === "instagram")
      : readyInputs.find((input) => input.value === "threads") || readyInputs.find((input) => input.value === "instagram");
    if (preferred) preferred.checked = true;
    appState.platformSelectionInitialized = true;
  }

  if (platformQuickPicker) {
    const visibleInputs = inputs.filter((input) => platformStatus(input.value).selectable);
    platformQuickPicker.innerHTML = visibleInputs.length
      ? `
        <div class="quickPickerButtons">
          ${visibleInputs.map((input) => {
            const status = platformStatus(input.value);
            return `
              <button
                class="quickPlatformButton ${input.checked ? "selected" : ""}"
                type="button"
                data-platform-toggle="${escapeHtml(input.value)}"
                ${status.selectable ? "" : "disabled"}
                title="${escapeHtml(status.detail)}"
              >
                <span class="quickPlatformName">${platformLabel(input.value)}</span>
                <span class="quickPlatformState">${escapeHtml(status.label)}</span>
                <small>${escapeHtml(status.detail)}</small>
              </button>
            `;
          }).join("")}
        </div>
      `
      : `
        <div class="inlineNotice pending">
          <strong>게시 채널 대기</strong>
          <span>Step 1에서 Instagram 계정을 먼저 연결하세요.</span>
        </div>
      `;
  }

  renderPublishPreview();
  renderBatchQueue();
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
  const readiness = platformStatus(platform);
  if (!readiness.selectable) {
    return {
      label: readiness.label,
      tone: readiness.tone === "ok" ? "ok" : readiness.tone,
    };
  }
  if (platform === "instagram") {
    const file = imageFile.files?.[0];
    const hasImage = Boolean(file || form.elements.image_url.value);
    return {
      label: hasImage ? "이미지 포함" : "텍스트 이미지 자동 생성",
      tone: "ok",
    };
  }
  if (platform === "threads") return { label: "텍스트 게시", tone: "ok" };
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

function adminSettingRows(settings) {
  return [
    {
      label: "관리자 설정 키",
      configured: settings.admin_setup_key_configured,
      source: settings.admin_setup_key_configured ? "Cloudflare secret" : "",
    },
    {
      label: "Secret 암호화 키",
      configured: settings.token_encryption_key_configured,
      source: settings.token_encryption_key_configured ? "Cloudflare secret" : "",
    },
    {
      label: "Meta App ID",
      configured: settings.meta_app_id_configured,
      source: settings.meta_app_id_source,
      updatedAt: settings.meta_app_id_updated_at,
    },
    {
      label: "Meta App Secret",
      configured: settings.meta_app_secret_configured,
      source: settings.meta_app_secret_source,
      updatedAt: settings.meta_app_secret_updated_at,
    },
    {
      label: "Facebook Login Configuration ID",
      configured: settings.meta_login_config_id_configured,
      source: settings.meta_login_config_id_source,
      updatedAt: settings.meta_login_config_id_updated_at,
    },
    {
      label: "Threads App ID",
      configured: settings.threads_client_id_configured,
      source: settings.threads_client_id_source,
      updatedAt: settings.threads_client_id_updated_at,
    },
    {
      label: "Threads App Secret",
      configured: settings.threads_client_secret_configured,
      source: settings.threads_client_secret_source,
      updatedAt: settings.threads_client_secret_updated_at,
    },
  ];
}

function renderAdminSettingsStatus(settings) {
  if (!adminSettingsStatus) return;
  const rows = adminSettingRows(settings);
  const storesPlainSecrets = !settings.token_encryption_key_configured;
  const readyCount = rows.filter((row) => row.configured).length;
  adminSettingsStatus.innerHTML = `
    <div class="adminStatusSummary ${storesPlainSecrets ? "missing" : "ready"}">
      <strong>${readyCount}/${rows.length}개 설정됨</strong>
      <span>${storesPlainSecrets ? "암호화 키가 없어서 Secret은 입력값 그대로 저장됩니다." : "입력한 Secret은 암호화되어 저장됩니다."}</span>
    </div>
    <div class="adminStatusGrid">
      ${rows.map((row) => `
        <article class="adminStatusItem ${row.configured ? "ready" : "missing"}">
          <strong>${escapeHtml(row.label)}</strong>
          <span>${settingStatusLabel(row.configured)}</span>
          <small>${escapeHtml(settingSourceLabel(row.source))}${row.updatedAt ? ` · ${formatDateTime(row.updatedAt)}` : ""}</small>
        </article>
      `).join("")}
    </div>
  `;
}

async function loadAdminSettings() {
  if (!adminSettingsStatus) return;
  adminSettingsStatus.innerHTML = `<div class="skeletonBlock"></div>`;
  try {
    const settings = await request("/api/admin/settings");
    appState.adminSettings = settings;
    renderAdminSettingsStatus(settings);
  } catch (error) {
    adminSettingsStatus.innerHTML = `
      <div class="emptyState error">
        <strong>관리자 설정 상태를 불러오지 못했습니다.</strong>
        <span>${escapeHtml(error.message)}</span>
      </div>
    `;
    throw error;
  }
}

function adminSettingsPayload() {
  const fields = [
    "admin_key",
    "meta_app_id",
    "meta_app_secret",
    "meta_login_config_id",
    "threads_client_id",
    "threads_client_secret",
  ];
  return Object.fromEntries(fields.map((name) => [name, String(adminSettingsForm.elements[name]?.value || "").trim()]));
}

function hasAdminSettingValue(payload) {
  return [
    "meta_app_id",
    "meta_app_secret",
    "meta_login_config_id",
    "threads_client_id",
    "threads_client_secret",
  ].some((name) => Boolean(payload[name]));
}

function renderConnectionCard(platform, readiness, account) {
  const configured = Boolean(readiness?.configured);
  const missing = readiness?.missing || [];
  const connected = account?.status === "connected";
  const disconnected = account?.status === "disconnected";
  const badge = connected
    ? `<span class="statusBadge ok">연결됨</span>`
    : disconnected
      ? `<span class="statusBadge missing">재연결 필요</span>`
    : configured
      ? `<span class="statusBadge pending">승인 가능</span>`
      : `<span class="statusBadge missing">연결 준비 필요</span>`;
  const statusText = connected
    ? escapeHtml(account.username || account.account_id)
    : disconnected
      ? `${escapeHtml(account.username || account.account_id || platformLabel(platform))} 계정 토큰이 해제됐습니다. 다시 승인하세요.`
    : configured
      ? "계정 승인 대기"
      : missing.map(missingLabel).join(", ");
  const primaryAction = connected
    ? `<button class="secondaryButton" type="button" data-disconnect="${platform}">연결 해제</button>`
    : configured
      ? `<a class="linkButton primary" href="/api/auth/meta/start?platform=${platform}">${disconnected ? "재연결하기" : "연결하기"}</a>`
      : `<a class="linkButton secondaryButton" href="#adminSettingsPanel" data-open-settings>설정하기</a>`;
  const fallbackAction = platform === "instagram" && configured && !connected
    ? `<a class="secondaryButton" href="/api/auth/meta/start?platform=instagram&variant=basic">대체 연결 시도</a>`
    : "";
  const action = `<div class="connectionActions">${primaryAction}${fallbackAction}</div>`;

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
  syncPlatformPicker();

  const accountError = accountsData.error
    ? `<div class="connectionWarning">계정 상태 확인 필요: ${escapeHtml(accountsData.error)}</div>`
    : "";
  accountConnections.innerHTML = `
    ${accountError}
    <div class="connectionGrid">
      ${["instagram", "threads"].map((platform) => renderConnectionCard(
        platform,
        readiness.platforms?.[platform],
        accounts.find((account) => account.platform === platform),
      )).join("")}
    </div>
  `;
  syncPlatformPicker();
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
  renderUtmPreview();
}

async function buildBatchItems(fileList) {
  const groups = new Map();
  const skipped = [];
  const textCaptions = new Map();
  const csvFiles = [];
  const imageFiles = [];

  for (const file of [...(fileList || [])]) {
    const relativePath = file.webkitRelativePath || file.name;
    const segments = relativePath.split("/").filter(Boolean);
    const dateFolder = findDateFolder(segments);
    const extension = fileExtension(file.name);
    const detectedType = imageTypeForFile(file);

    if (TEXT_CAPTION_EXTENSIONS.has(extension)) {
      if (!dateFolder) continue;
      try {
        const caption = parseTextCaption(await file.text(), relativePath);
        if (caption) textCaptions.set(captionSidecarKey(dateFolder.key, segments, file.name), caption);
      } catch {
        skipped.push({ name: relativePath, reason: "캡션 파일 읽기 실패" });
      }
      continue;
    }

    if (CSV_CAPTION_EXTENSIONS.has(extension)) {
      csvFiles.push({ file, relativePath, dateKey: dateFolder?.key || "" });
      continue;
    }

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

    imageFiles.push({ file, relativePath, segments, dateFolder, detectedType });
  }

  const csvCaptions = new Map();
  for (const csv of csvFiles) {
    try {
      const rows = parseCaptionCsv(await csv.file.text());
      for (const row of rows) {
        const reference = firstRowValue(row, ["file", "filename", "file_name", "image", "image_file", "path", "파일", "파일명", "이미지"]);
        if (!reference) continue;
        const caption = captionFromCsvRow(row, csv.relativePath);
        if (!caption) continue;
        const rowDate = firstRowValue(row, ["date", "folder", "date_folder", "scheduled_date", "날짜", "폴더"]);
        const dateKey = parseDateFolderName(rowDate)?.key || csv.dateKey;
        for (const key of csvCaptionKeys(dateKey, reference)) csvCaptions.set(key, caption);
      }
    } catch {
      skipped.push({ name: csv.relativePath, reason: "CSV 읽기 실패" });
    }
  }

  for (const entry of imageFiles) {
    const { file, relativePath, segments, dateFolder, detectedType } = entry;
    const sidecarCaption = textCaptions.get(captionSidecarKey(dateFolder.key, segments, file.name));
    const csvCaption = csvLookupKeys({
      dateKey: dateFolder.key,
      fileName: file.name,
      relativePath,
    }).map((key) => csvCaptions.get(key)).find(Boolean);
    const caption = mergeCaptionData(csvCaption, sidecarCaption);
    const group = groups.get(dateFolder.key) || [];
    group.push({
      file,
      fileName: file.name,
      relativePath,
      dateKey: dateFolder.key,
      dateLabel: dateFolder.label,
      detectedType,
      captionTitle: caption?.title || "",
      captionBody: caption?.body || "",
      captionHashtags: caption?.hashtags || "",
      captionLink: caption?.link || "",
      captionSource: caption?.source || "",
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
  const defaultBody = formValue("body");
  const missingCaptionItems = items.filter((item) => !item.captionSource);
  const missingCopyItems = items.filter((item) => !item.captionSource && !defaultBody);
  const scheduledDates = items
    .map((item) => scheduledDateForBatchItem(item))
    .filter((date) => Number.isFinite(date.getTime()))
    .sort((a, b) => a.getTime() - b.getTime());
  const issues = items.map((item) => batchItemScheduleIssue(item));
  const duplicate = batchDuplicateState(items, platforms);
  const jpgBlockCount = 0;
  return {
    dateCount: new Set(items.map((item) => item.dateKey)).size,
    captionCount: items.filter((item) => item.captionSource).length,
    missingCaptionCount: missingCaptionItems.length,
    missingCopyCount: missingCopyItems.length,
    missingCopyPaths: new Set(missingCopyItems.map((item) => item.relativePath)),
    taskCount: items.length * platforms.length,
    firstDate: scheduledDates[0] || null,
    lastDate: scheduledDates[scheduledDates.length - 1] || null,
    noPlatforms: platforms.length === 0,
    hasKakao: platforms.includes("kakao"),
    hasThreads: platforms.includes("threads"),
    jpgBlockCount,
    pastCount: issues.filter((issue) => issue === "past").length,
    overflowCount: issues.filter((issue) => issue === "overflow").length,
    duplicate,
  };
}

function skippedFixFor(reason) {
  return {
    "날짜 폴더 없음": "YYYY-MM-DD 날짜 폴더 안에 넣기",
    "이미지 형식 제외": "JPG, PNG, WEBP로 저장",
    "빈 파일": "파일을 다시 저장",
    "8MB 초과": "8MB 이하로 압축",
    "캡션 파일 읽기 실패": "TXT/MD 인코딩 확인",
    "CSV 읽기 실패": "UTF-8 CSV 형식 확인",
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
        <span>날짜 폴더별 파일명 숫자순으로 예약됩니다. 001.txt 또는 captions.csv가 있으면 문구를 자동 매칭합니다.</span>
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
    state.duplicate.fileConflictCount ? `같은 날짜의 같은 파일명 ${state.duplicate.fileConflictCount}개를 확인하세요.` : "",
    state.duplicate.planConflictCount ? `이번 예약 목록 안에 같은 시간 중복 후보 ${state.duplicate.planConflictCount}개가 있습니다.` : "",
    state.duplicate.existingConflictCount ? `기존 예약과 시간이 겹치는 후보 ${state.duplicate.existingConflictCount}개가 있습니다.` : "",
    state.missingCaptionCount ? `캡션 파일이 없는 이미지 ${state.missingCaptionCount}개는 공통 문구를 사용합니다.` : "",
    state.missingCopyCount ? `본문 없이 예약될 이미지 ${state.missingCopyCount}개가 있습니다. 캡션 파일이나 기본 본문을 입력하세요.` : "",
    state.hasThreads ? "Threads는 글만 바로 게시할 때 사용하세요. 날짜 폴더 예약은 Instagram 이미지 예약만 지원합니다." : "",
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
      <span>캠페인: <strong>${formValue("campaign_name") || "미지정"}</strong>${utmAuto?.checked ? " · UTM 자동" : ""}</span>
      <span>캡션: <strong>${state.captionCount ? `${state.captionCount}개 파일 매칭` : "공통 문구 사용"}</strong>${state.missingCaptionCount ? ` · ${state.missingCaptionCount}개 미매칭` : ""}</span>
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

function renderScheduleCalendar() {
  if (!scheduleCalendar) return;
  const items = appState.batchItems;
  const platforms = selectedPlatforms();
  const duplicate = batchDuplicateState(items, platforms);
  const batchCounts = new Map();
  const existingCounts = new Map();
  const conflictDates = new Set();

  for (const item of items) {
    const key = dateKeyFromDate(scheduledDateForBatchItem(item));
    if (!key) continue;
    batchCounts.set(key, (batchCounts.get(key) || 0) + 1);
    if (duplicate.itemWarnings.has(item.relativePath)) conflictDates.add(key);
  }

  for (const job of appState.jobs) {
    if (job.status !== "scheduled" || !job.scheduled_at) continue;
    const key = dateKeyFromDate(job.scheduled_at);
    if (!key) continue;
    existingCounts.set(key, (existingCounts.get(key) || 0) + 1);
  }

  const keys = [...new Set([...batchCounts.keys(), ...existingCounts.keys()])].sort();
  if (keys.length === 0) {
    scheduleCalendar.innerHTML = `
      <div class="scheduleCalendarHeader">
        <strong>예약 캘린더</strong>
        <span>폴더를 선택하면 날짜별 예약량이 표시됩니다.</span>
      </div>
    `;
    return;
  }

  const [year, month] = keys[0].split("-").map(Number);
  const monthStart = new Date(year, month - 1, 1);
  const gridStart = new Date(monthStart);
  gridStart.setDate(monthStart.getDate() - monthStart.getDay());
  const monthLabel = new Intl.DateTimeFormat("ko-KR", { year: "numeric", month: "long" }).format(monthStart);
  const todayKey = dateKeyFromDate(new Date());
  const weekdays = ["일", "월", "화", "수", "목", "금", "토"];
  const days = Array.from({ length: 42 }, (_, index) => {
    const day = new Date(gridStart);
    day.setDate(gridStart.getDate() + index);
    const key = dateKeyFromDate(day);
    const batchCount = batchCounts.get(key) || 0;
    const existingCount = existingCounts.get(key) || 0;
    const hasConflict = conflictDates.has(key);
    const className = [
      "calendarDay",
      day.getMonth() !== monthStart.getMonth() ? "outside" : "",
      key === todayKey ? "today" : "",
      batchCount ? "hasBatch" : "",
      existingCount ? "hasExisting" : "",
      hasConflict ? "conflict" : "",
    ].filter(Boolean).join(" ");
    return `
      <div class="${className}">
        <strong>${day.getDate()}</strong>
        ${batchCount ? `<span>신규 ${batchCount}개</span>` : ""}
        ${existingCount ? `<span>기존 ${existingCount}개</span>` : ""}
        ${hasConflict ? "<span>중복 확인</span>" : ""}
      </div>
    `;
  }).join("");

  scheduleCalendar.innerHTML = `
    <div class="scheduleCalendarHeader">
      <strong>${escapeHtml(monthLabel)} 예약 캘린더</strong>
      <span>신규 ${items.length}개 · 기존 ${[...existingCounts.values()].reduce((sum, count) => sum + count, 0)}개</span>
    </div>
    <div class="calendarLegend">
      <span>신규 예약</span>
      <span class="existing">기존 예약</span>
      <span class="conflict">중복 확인</span>
    </div>
    <div class="calendarGrid">
      ${weekdays.map((day) => `<div class="calendarWeekday">${day}</div>`).join("")}
      ${days}
    </div>
  `;
}

function renderBatchQueue() {
  if (!batchQueue) return;
  const items = appState.batchItems;
  const skipped = appState.batchSkipped;
  const platforms = selectedPlatforms();
  const state = batchValidationState(items, platforms);
  const needsInstagramJpeg = false;
  const hasPastItems = state.pastCount > 0;
  const hasKakao = state.hasKakao;
  const hasOverflowItems = state.overflowCount > 0;
  const hasDuplicateWarnings = state.duplicate.warningCount > 0;
  const hasMissingCopy = state.missingCopyCount > 0;
  const hasBlockingIssue = needsInstagramJpeg || hasPastItems || hasKakao || state.hasThreads || hasOverflowItems || hasDuplicateWarnings || hasMissingCopy;
  const allSucceeded = items.length > 0 && items.every((item) => batchResultFor(item)?.status === "success");
  const remainingItems = items.filter((item) => batchResultFor(item)?.status !== "success");
  const remainingTaskCount = remainingItems.length * platforms.length;

  renderBatchPlan();
  renderScheduleCalendar();

  if (submitBatch) {
    submitBatch.disabled = appState.batchSubmitting || allSucceeded || items.length === 0 || platforms.length === 0 || hasBlockingIssue;
    submitBatch.textContent = appState.batchSubmitting
      ? "예약 생성 중"
      : allSucceeded
      ? "예약 완료"
      : hasBlockingIssue
      ? "예약 조건 확인 필요"
      : items.length && platforms.length
      ? `${remainingTaskCount || state.taskCount}개 예약 작업 만들기`
      : "예약 작업 만들기";
  }
  if (clearBatch) clearBatch.disabled = items.length === 0 && skipped.length === 0;

  if (items.length === 0) {
    batchQueue.className = "batchQueue emptyState compact";
    batchQueue.innerHTML = skipped.length
      ? `<strong>폴더를 받지 않았습니다.</strong><span>${skipped.length}개 파일의 위치나 형식이 맞지 않습니다. 아래 항목을 고친 뒤 다시 선택하세요.</span>${renderSkippedDetails(skipped)}`
      : `<strong>상위 폴더를 선택하세요.</strong><span>예: campaign / 2026-06-21 / 001.jpg</span>`;
    return;
  }

  const groups = new Map();
  for (const item of items) {
    const group = groups.get(item.dateKey) || [];
    group.push(item);
    groups.set(item.dateKey, group);
  }
  const dateKeys = new Set(groups.keys());
  for (const key of Object.keys(appState.batchDateGroups)) {
    if (!dateKeys.has(key)) delete appState.batchDateGroups[key];
  }

  const skippedNotice = renderSkippedDetails(skipped);
  const instagramNotice = needsInstagramJpeg
    ? `<div class="batchWarning">Instagram 예약은 JPG 이미지만 사용할 수 있습니다.</div>`
    : "";
  const pastNotice = hasPastItems
    ? `<div class="batchWarning">이미 지난 예약 시간이 포함되어 있습니다. 날짜 폴더나 시작 시간을 조정하세요.</div>`
    : "";
  const duplicateNotice = state.duplicate.warningCount
    ? `<div class="batchWarning">중복 가능성이 있는 예약 ${state.duplicate.warningCount}건이 있습니다. 같은 시간에 같은 채널로 나가는지 확인하세요.</div>`
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
    ${duplicateNotice}
    <div class="batchDateGroups">
      ${[...groups.entries()].map(([dateKey, group]) => {
        const groupHasBlockingIssue = group.some((item) => {
          const itemNeedsJpeg = false;
          const itemWarnings = state.duplicate.itemWarnings.get(item.relativePath) || [];
          return itemNeedsJpeg || batchItemScheduleIssue(item) || state.missingCopyPaths.has(item.relativePath) || itemWarnings.length;
        });
        const preferredOpen = appState.batchDateGroups[dateKey];
        const openGroup = (groupHasBlockingIssue || (typeof preferredOpen === "boolean" ? preferredOpen : groups.size <= 2 && group.length <= 6)) ? " open" : "";
        return `
        <details class="batchDateGroup" data-date-key="${escapeHtml(dateKey)}"${openGroup}>
          <summary class="batchDateHeader">
            <strong>${dateKey}</strong>
            <span>${group.length}개 이미지</span>
          </summary>
          ${group.map((item) => {
            const needsJpeg = false;
            const result = batchResultFor(item);
            const itemWarnings = state.duplicate.itemWarnings.get(item.relativePath) || [];
            const scheduleIssue = batchItemScheduleIssue(item);
            const missingCopy = state.missingCopyPaths.has(item.relativePath);
            const badgeLabel = needsJpeg
              ? "JPG 필요"
              : scheduleIssue === "past"
              ? "지난 시간"
              : scheduleIssue === "overflow"
              ? "다음날"
              : missingCopy
              ? "문구 필요"
              : itemWarnings.length
              ? "중복 확인"
              : batchItemTypeLabel(item);
            const captionPreview = truncateText(item.captionBody || item.captionTitle || item.captionHashtags || "", 96);
            return `
              <div class="batchFile">
                <span class="batchSequence">${item.indexWithinDate + 1}</span>
                <div class="batchFileMeta">
                  <strong>${escapeHtml(item.fileName)}</strong>
                  <small>${escapeHtml(item.relativePath)}</small>
                  ${item.captionSource ? `<span class="captionBadge">캡션 매칭: ${escapeHtml(item.captionSource)}</span>` : ""}
                  ${captionPreview ? `<span class="batchCaptionPreview">${escapeHtml(captionPreview)}</span>` : ""}
                  ${missingCopy ? `<span class="batchCaptionPreview">캡션 파일 또는 기본 본문이 필요합니다.</span>` : ""}
                  ${itemWarnings.map((warning) => `<span class="batchCaptionPreview">${escapeHtml(warning)}</span>`).join("")}
                </div>
                <div class="batchFileSchedule">
                  <strong>${escapeHtml(formatFullDateTime(scheduledDateForBatchItem(item)))}</strong>
                  <span class="batchBadge ${needsJpeg || scheduleIssue || missingCopy || itemWarnings.length ? "warning" : ""}">
                    ${badgeLabel}
                  </span>
                  ${result ? `<span class="batchProgress ${result.status}">${escapeHtml(result.label)}</span>` : ""}
                </div>
              </div>
            `;
          }).join("")}
        </details>
      `;
      }).join("")}
    </div>
  `;
}

function clearBatchQueue() {
  appState.batchItems = [];
  appState.batchSkipped = [];
  appState.batchResults = {};
  appState.batchDateGroups = {};
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

async function uploadImageFileToAssets(file, options = {}) {
  const uploadFile = options.forceJpeg ? await convertImageToJpeg(file) : normalizedImageFile(file);
  const uploadBody = new FormData();
  uploadBody.set("image", uploadFile);
  return request("/api/assets/upload", {
    method: "POST",
    body: uploadBody,
  });
}

function wrapCanvasText(context, text, maxWidth) {
  const words = String(text || "").replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
  const lines = [];
  let current = "";
  const pushLongWord = (word) => {
    let part = "";
    for (const char of word) {
      const test = `${part}${char}`;
      if (context.measureText(test).width <= maxWidth) {
        part = test;
        continue;
      }
      if (part) lines.push(part);
      part = char;
    }
    current = part;
  };
  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (context.measureText(test).width <= maxWidth) {
      current = test;
      continue;
    }
    if (current) lines.push(current);
    if (context.measureText(word).width > maxWidth) pushLongWord(word);
    else current = word;
  }
  if (current) lines.push(current);
  return lines;
}

async function generateTextPostImageFile() {
  const title = String(form.elements.title.value || "").trim();
  const body = String(form.elements.body.value || "").trim();
  const hashtags = String(form.elements.hashtags.value || "").trim();
  const canvas = document.createElement("canvas");
  canvas.width = 1080;
  canvas.height = 1080;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Text image generation is not available.");

  context.fillStyle = "#f7f8fb";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "#ffffff";
  context.fillRect(72, 72, 936, 936);
  context.strokeStyle = "#d8dee8";
  context.lineWidth = 2;
  context.strokeRect(72, 72, 936, 936);

  context.fillStyle = "#0f172a";
  context.textBaseline = "top";
  context.font = "700 62px Arial, sans-serif";
  const titleLines = wrapCanvasText(context, title || "Automatic Posting", 800).slice(0, 3);
  let y = 168;
  for (const line of titleLines) {
    context.fillText(line, 140, y);
    y += 78;
  }

  y += 24;
  context.fillStyle = "#334155";
  context.font = "400 38px Arial, sans-serif";
  const bodyLines = wrapCanvasText(context, body || hashtags || " ", 800).slice(0, 10);
  for (const line of bodyLines) {
    if (y > 820) break;
    context.fillText(line, 140, y);
    y += 52;
  }

  if (hashtags) {
    context.fillStyle = "#2563eb";
    context.font = "700 30px Arial, sans-serif";
    wrapCanvasText(context, hashtags, 800).slice(0, 2).forEach((line, index) => {
      context.fillText(line, 140, 890 + index * 40);
    });
  }

  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob((result) => {
      if (result) resolve(result);
      else reject(new Error("Text image generation failed."));
    }, "image/jpeg", 0.92);
  });
  return new File([blob], "text-post.jpg", { type: "image/jpeg" });
}

async function uploadSelectedImage(platforms = selectedPlatforms()) {
  const file = imageFile.files?.[0];
  const shouldGenerateTextImage = !file && platforms.includes("instagram");
  if (!file && !shouldGenerateTextImage) return { image_key: "", image_url: "" };
  const uploadSource = file || await generateTextPostImageFile();

  imagePreview.classList.add("uploading");
  formStatus.textContent = shouldGenerateTextImage ? "텍스트 이미지 생성 중" : "이미지 업로드 중";
  let result;
  try {
    result = await uploadImageFileToAssets(uploadSource, { forceJpeg: platforms.includes("instagram") });
  } finally {
    imagePreview.classList.remove("uploading");
  }
  form.elements.image_key.value = result.image_key;
  form.elements.image_url.value = result.image_url;
  imagePreview.innerHTML = `
    <img src="${shouldGenerateTextImage ? result.image_url : previewUrl}" alt="게시 이미지 미리보기" />
    <div>
      <strong>${escapeHtml(shouldGenerateTextImage ? "text-post.jpg" : uploadSource.name)}</strong>
      <span>${shouldGenerateTextImage ? "본문으로 자동 생성" : "업로드 완료"}</span>
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
  renderScheduleCalendar();
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
    const failureDetail = job.error_message
      ? `
        <details class="jobErrorDetail">
          <summary>실패 사유 보기</summary>
          <pre>${escapeHtml(job.error_message)}</pre>
        </details>
      `
      : "";
    return `
      <article class="job">
        <div class="platformMark" aria-hidden="true">${platformInitial(job.platform)}</div>
        <div>
          <strong>${platformLabel(job.platform)}</strong>
          <p>${escapeHtml(job.title || "제목 없음")}</p>
          ${job.campaign_name ? `<span class="jobCampaign">${escapeHtml(job.campaign_name)}</span>` : ""}
        </div>
        <span class="status ${escapeHtml(job.status)}">${statusLabel(job.status)}</span>
        <div class="jobMeta">
          <span>${formatDateTime(job.updated_at || job.created_at)}</span>
          ${failureDetail}
        </div>
        <div class="jobActions">${link}${retry}</div>
      </article>
    `;
  }).join("");
}

async function createScheduledBatchItem(item, platforms, onStage = () => {}) {
  onStage("uploading", "업로드 중");
  const uploadedImage = await uploadImageFileToAssets(item.file, { forceJpeg: platforms.includes("instagram") });
  const fallbackTitle = fileStem(item.fileName);
  const titleTemplate = item.captionTitle || formValue("title");
  const title = truncateText(titleTemplate || fallbackTitle, 120) || "image";
  const body = item.captionBody || formValue("body");
  const linkUrl = applyAutoUtm(item.captionLink || formValue("link_url"), platforms, fallbackTitle);
  const hashtags = item.captionHashtags || formValue("hashtags");
  onStage("creating", "게시글 생성 중");
  const post = await request("/api/posts", {
    method: "POST",
    body: JSON.stringify({
      title,
      body,
      link_url: linkUrl,
      hashtags,
      image_key: uploadedImage.image_key,
      image_url: uploadedImage.image_url,
      platforms,
      ...campaignMetadata(item.relativePath),
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

function requestSinglePostSubmit() {
  singlePostSubmitRequested = true;
  form.requestSubmit();
  window.setTimeout(() => {
    singlePostSubmitRequested = false;
  }, 0);
}

function requestBatchSubmit() {
  batchSubmitRequested = true;
  batchScheduleForm.requestSubmit();
  window.setTimeout(() => {
    batchSubmitRequested = false;
  }, 0);
}

function singlePostConfirmationMessage(data, platforms) {
  const mode = data.get("mode");
  const lines = [
    "게시 작업을 만들까요?",
    "",
    `채널: ${platforms.map(platformLabel).join(", ")}`,
    `제목: ${String(data.get("title") || "제목 없음").trim()}`,
    `방식: ${mode === "scheduled" ? "예약 발행" : "즉시 발행"}`,
  ];
  if (mode === "scheduled") {
    lines.push(`예약 시간: ${formatFullDateTime(data.get("scheduled_at"))}`);
  }
  lines.push(`이미지: ${imageFile.files?.[0] ? imageFile.files[0].name : platforms.includes("instagram") ? "본문 기반 자동 생성" : "없음"}`);
  const campaignName = String(data.get("campaign_name") || "").trim();
  if (campaignName) lines.push(`캠페인: ${campaignName}`);
  return lines.join("\n");
}

form.addEventListener("input", () => {
  updateFormMeta();
  resetBatchResultsForPlanChange();
  renderBatchQueue();
});
form.addEventListener("change", (event) => {
  if (event.target?.name === "platforms") appState.platformSelectionInitialized = true;
  updateFormMeta();
  resetBatchResultsForPlanChange();
  renderBatchQueue();
});

platformQuickPicker?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-platform-toggle]");
  if (!button || button.disabled) return;
  const input = form.querySelector(`input[name="platforms"][value="${button.dataset.platformToggle}"]`);
  if (!input || input.disabled) return;
  input.checked = !input.checked;
  appState.platformSelectionInitialized = true;
  updateFormMeta();
  resetBatchResultsForPlanChange();
  syncPlatformPicker();
});

document.addEventListener("click", (event) => {
  const target = event.target.closest("[data-open-settings]");
  if (!target || !adminSettingsPanel) return;
  adminSettingsPanel.open = true;
  loadAdminSettings().catch(() => {});
});

adminSettingsPanel?.addEventListener("toggle", () => {
  if (adminSettingsPanel.open) loadAdminSettings().catch(() => {});
});

refreshAdminSettings?.addEventListener("click", async () => {
  setBusy(refreshAdminSettings, true, "확인 중");
  try {
    await loadAdminSettings();
    showToast("관리자 설정 상태를 새로고침했습니다.");
  } catch (error) {
    showToast(error.message, "error");
  } finally {
    setBusy(refreshAdminSettings, false, "설정 상태 새로고침");
  }
});

adminSettingsForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const payload = adminSettingsPayload();
  if (appState.adminSettings?.admin_setup_key_configured && !payload.admin_key) {
    showToast("관리자 설정 키를 입력하세요.", "error");
    return;
  }
  if (!hasAdminSettingValue(payload)) {
    showToast("저장할 Meta 또는 Threads 설정값을 하나 이상 입력하세요.", "error");
    return;
  }

  setBusy(saveAdminSettings, true, "저장 중");
  try {
    await request("/api/admin/settings", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    adminSettingsForm.elements.meta_app_secret.value = "";
    adminSettingsForm.elements.threads_client_secret.value = "";
    showToast("관리자 설정을 저장했습니다.");
    await Promise.all([loadAdminSettings(), loadConnections()]);
  } catch (error) {
    showToast(error.message, "error");
  } finally {
    setBusy(saveAdminSettings, false, "관리자 설정 저장");
  }
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const explicitSinglePostSubmit = singlePostSubmitRequested;
  singlePostSubmitRequested = false;
  if (!explicitSinglePostSubmit) {
    if (manualPostDetails) manualPostDetails.open = true;
    formStatus.textContent = "단건 게시 확인 필요";
    showToast("단건 게시 옵션을 열고 게시 버튼을 눌러야 발행됩니다.", "error");
    submitPost?.focus({ preventScroll: true });
    return;
  }
  const data = new FormData(form);
  const platforms = selectedPlatforms();
  if (platforms.length === 0) {
    showToast(validatePublishablePlatforms(platforms), "error");
    return;
  }
  const platformError = validatePublishablePlatforms(platforms);
  if (platformError) {
    showToast(platformError, "error");
    syncPlatformPicker();
    return;
  }
  if (!window.confirm(singlePostConfirmationMessage(data, platforms))) {
    formStatus.textContent = "대기 중";
    return;
  }
  setBusy(submitPost, true, "처리 중");
  formStatus.textContent = "발행 요청 중";
  try {
    const uploadedImage = await uploadSelectedImage(platforms);
    const post = await request("/api/posts", {
      method: "POST",
      body: JSON.stringify({
        title: data.get("title"),
        body: data.get("body"),
        link_url: applyAutoUtm(data.get("link_url"), platforms, data.get("title")),
        hashtags: data.get("hashtags"),
        image_key: uploadedImage.image_key,
        image_url: uploadedImage.image_url,
        platforms,
        ...campaignMetadata(imageFile.files?.[0]?.name || ""),
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
    setBusy(submitPost, false, "게시 작업 만들기");
  }
});

submitPost?.addEventListener("click", requestSinglePostSubmit);

batchFolderInput?.addEventListener("change", async () => {
  if (batchStatus) batchStatus.textContent = "폴더 읽는 중";
  const { items, skipped } = await buildBatchItems(batchFolderInput.files);
  const rejected = skipped.length > 0;
  appState.batchItems = rejected ? [] : items;
  appState.batchSkipped = skipped;
  appState.batchResults = {};
  appState.batchDateGroups = {};
  if (batchStatus) {
    batchStatus.textContent = rejected
      ? "폴더 수정 필요"
      : items.length
      ? `${items.length}개 준비`
      : "대기 중";
  }
  if (rejected) {
    showToast("폴더 구조나 파일 형식이 맞지 않아 예약 목록을 받지 않았습니다.", "error");
  }
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
submitBatch?.addEventListener("click", requestBatchSubmit);

batchQueue?.addEventListener("toggle", (event) => {
  const group = event.target?.closest?.(".batchDateGroup");
  if (!group || !batchQueue.contains(group)) return;
  const dateKey = group.dataset.dateKey;
  if (dateKey) appState.batchDateGroups[dateKey] = group.open;
}, true);

batchScheduleForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const explicitBatchSubmit = batchSubmitRequested;
  batchSubmitRequested = false;
  if (!explicitBatchSubmit) {
    showToast("예약 작업 만들기 버튼을 눌러야 대량 예약이 생성됩니다.", "error");
    return;
  }
  const items = appState.batchItems;
  const platforms = selectedPlatforms();
  const state = batchValidationState(items, platforms);
  if (items.length === 0) {
    showToast("예약할 이미지가 없습니다.", "error");
    return;
  }
  if (platforms.length === 0) {
    showToast(validatePublishablePlatforms(platforms), "error");
    return;
  }
  const platformError = validatePublishablePlatforms(platforms);
  if (platformError) {
    showToast(platformError, "error");
    syncPlatformPicker();
    return;
  }
  if (state.hasKakao) {
    showToast("Kakao는 아직 배치 예약 발송 경로가 구성되지 않았습니다.", "error");
    renderBatchQueue();
    return;
  }
  if (state.hasThreads) {
    showToast("Threads는 글만 바로 게시할 때 사용하세요. 날짜 폴더 예약은 Instagram 이미지 예약만 지원합니다.", "error");
    renderBatchQueue();
    return;
  }
  if (state.pastCount > 0) {
    showToast("지난 예약 시간이 포함되어 있습니다. 날짜 폴더나 시작 시간을 조정하세요.", "error");
    renderBatchQueue();
    return;
  }
  if (state.overflowCount > 0) {
    showToast("다음날로 넘어가는 예약이 있습니다. 날짜 폴더나 간격을 조정하세요.", "error");
    renderBatchQueue();
    return;
  }
  if (state.duplicate.warningCount > 0) {
    showToast("중복 가능성이 있는 예약 시간이 있습니다. 파일명과 예약 시간을 조정하세요.", "error");
    renderBatchQueue();
    return;
  }
  if (state.missingCopyCount > 0) {
    showToast("본문 없이 예약될 이미지가 있습니다. 캡션 파일이나 기본 본문을 입력하세요.", "error");
    renderBatchQueue();
    return;
  }

  const pendingItems = items.filter((item) => batchResultFor(item)?.status !== "success");
  if (pendingItems.length === 0) {
    showToast("이미 모든 예약 작업이 완료되었습니다.");
    renderBatchQueue();
    return;
  }
  const taskCount = pendingItems.length * platforms.length;
  const confirmed = window.confirm([
    `${taskCount}개 예약 작업을 만들까요?`,
    `기간: ${state.firstDate ? formatFullDateTime(state.firstDate) : "-"} ~ ${state.lastDate ? formatFullDateTime(state.lastDate) : "-"}`,
    `채널: ${platforms.map(platformLabel).join(", ")}`,
    `캠페인: ${formValue("campaign_name") || "미지정"}`,
  ].join("\n"));
  if (!confirmed) return;

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

refreshJobs.addEventListener("click", async () => {
  setBusy(refreshJobs, true, "새로고침 중");
  try {
    await Promise.all([loadJobs(), loadConnections()]);
    showToast("상태를 새로고침했습니다.");
  } catch (error) {
    showToast(error.message, "error");
  } finally {
    setBusy(refreshJobs, false, "작업 새로고침");
  }
});

runScheduler.addEventListener("click", async () => {
  const confirmed = window.confirm("자동 실행이 지연된 예약 작업을 지금 확인합니다. 계속할까요?");
  if (!confirmed) return;
  setBusy(runScheduler, true, "실행 중");
  try {
    const result = await request("/api/scheduler/run", { method: "POST", body: "{}" });
    showToast(`${result.processed?.length || 0}개 예약 작업을 확인했습니다.`);
    await loadJobs();
  } catch (error) {
    showToast(error.message, "error");
  } finally {
    setBusy(runScheduler, false, "예약 작업 수동 확인");
  }
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
syncPlatformPicker();
const redirectUri = `${window.location.origin}/api/auth/meta/callback`;
if (redirectUriValue) redirectUriValue.textContent = redirectUri;
redirectUriMirrors.forEach((element) => {
  element.textContent = redirectUri;
});
loadConnections().catch((error) => {
  if (accountConnections) accountConnections.textContent = error.message;
});
loadAdminSettings().catch(() => {});
loadJobs().catch((error) => {
  jobsEl.innerHTML = `<div class="emptyState error"><strong>작업을 불러오지 못했습니다.</strong><span>${escapeHtml(error.message)}</span></div>`;
});
