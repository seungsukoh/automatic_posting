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
    throw new Error(looksLikeHtml ? "Cloudflare í•¨ìˆ˜ê°€ JSONì„ ë°˜í™˜í•˜ì§€ ì•ŠìŠµë‹ˆë‹¤." : "API ì‘ë‹µì„ í•´ì„í•  ìˆ˜ ì—†ìŠµë‹ˆë‹¤.");
  }
  if (!response.ok) throw new Error(data.error || "ìš”ì²­ì„ ì²˜ë¦¬í•˜ì§€ ëª»í–ˆìŠµë‹ˆë‹¤.");
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
    client_id: "ì•± ì—°ê²° ì¤€ë¹„",
    client_secret: "ì•± ì—°ê²° ì¤€ë¹„",
    oauth_state_secret: "ì•± ì—°ê²° ì¤€ë¹„",
    token_encryption_key: "ì•± ì—°ê²° ì¤€ë¹„",
  }[key] || key;
}

function statusLabel(status) {
  return {
    queued: "ëŒ€ê¸°",
    running: "ë°œí–‰ ì¤‘",
    scheduled: "ì˜ˆì•½",
    success: "ì„±ê³µ",
    failed: "ì‹¤íŒ¨",
    missing: "ì—†ìŒ",
  }[status] || status || "ì•Œ ìˆ˜ ì—†ìŒ";
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
    .find((part) => part.type === "timeZoneName")?.value || "ë¸Œë¼ìš°ì € ì‹œê°„";
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
    utmPreview.textContent = "ë§í¬ë¥¼ ìž…ë ¥í•˜ë©´ UTM ë¯¸ë¦¬ë³´ê¸°ê°€ í‘œì‹œë©ë‹ˆë‹¤.";
    return;
  }
  try {
    new URL(link);
  } catch {
    utmPreview.className = "utmPreview";
    utmPreview.textContent = "https://ë¡œ ì‹œìž‘í•˜ëŠ” ì˜¬ë°”ë¥¸ ë§í¬ë¥¼ ìž…ë ¥í•˜ë©´ UTMì„ ë¶™ì¼ ìˆ˜ ìžˆìŠµë‹ˆë‹¤.";
    return;
  }
  if (!utmAuto?.checked) {
    utmPreview.className = "utmPreview";
    utmPreview.textContent = "UTM ìžë™ ì¶”ê°€ê°€ êº¼ì ¸ ìžˆìŠµë‹ˆë‹¤.";
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
    title: firstRowValue(row, ["title", "post_title", "ì œëª©"]),
    body: firstRowValue(row, ["body", "caption", "content", "copy", "ë³¸ë¬¸", "ë¬¸êµ¬", "ìº¡ì…˜"]),
    hashtags: firstRowValue(row, ["hashtags", "hashtag", "tags", "tag", "í•´ì‹œíƒœê·¸", "íƒœê·¸"]),
    link: firstRowValue(row, ["link_url", "link", "url", "landing_url", "ë§í¬", "ëžœë”©"]),
  }, source);
}

function parseTextCaption(text, source) {
  const clean = String(text || "").replace(/^\uFEFF/, "").trim();
  if (!clean) return null;
  const fields = {};
  const bodyLines = [];
  let structured = false;

  for (const line of clean.split(/\r?\n/)) {
    const match = line.match(/^\s*(title|ì œëª©|body|ë³¸ë¬¸|caption|ìº¡ì…˜|hashtags|í•´ì‹œíƒœê·¸|link|url|ë§í¬)\s*[:=]\s*(.*)$/i);
    if (match) {
      structured = true;
      const key = match[1].toLowerCase();
      if (key === "title" || key === "ì œëª©") fields.title = match[2];
      else if (key === "hashtags" || key === "í•´ì‹œíƒœê·¸") fields.hashtags = match[2];
      else if (key === "link" || key === "url" || key === "ë§í¬") fields.link = match[2];
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
  }[item.detectedType] || "ì´ë¯¸ì§€";
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
    group.forEach((item) => addBatchWarning(itemWarnings, item, "ê°™ì€ ë‚ ì§œì— ê°™ì€ íŒŒì¼ëª…ì´ ìžˆìŠµë‹ˆë‹¤."));
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
    group.forEach((item) => addBatchWarning(itemWarnings, item, `${platformLabel(platform)} ê°™ì€ ì‹œê°„ ì˜ˆì•½ í›„ë³´ê°€ ìžˆìŠµë‹ˆë‹¤.`));
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
      addBatchWarning(itemWarnings, item, `${platformLabel(platform)}ì— ì´ë¯¸ ê°™ì€ ì‹œê°„ ì˜ˆì•½ì´ ìžˆìŠµë‹ˆë‹¤.`);
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
    return {
      selectable: false,
      connected,
      label: "ì‚¬ìš© ë¶ˆê°€",
      detail: "í˜„ìž¬ Instagram ê²Œì‹œë§Œ ì‚¬ìš©í•  ìˆ˜ ìžˆìŠµë‹ˆë‹¤.",
      tone: "pending",
    };
  }
  if (platform === "kakao") {
    return {
      selectable: false,
      connected: false,
      label: "ì‚¬ìš© ë¶ˆê°€",
      detail: "í˜„ìž¬ Instagram ê²Œì‹œë§Œ ì‚¬ìš©í•  ìˆ˜ ìžˆìŠµë‹ˆë‹¤.",
      tone: "missing",
    };
  }
  if (!serviceReady) {
    return {
      selectable: false,
      connected: false,
      label: "ì‚¬ìš© ë¶ˆê°€",
      detail: "í˜„ìž¬ ì´ ì±„ë„ì€ ì‚¬ìš©í•  ìˆ˜ ì—†ìŠµë‹ˆë‹¤.",
      tone: "missing",
    };
  }
  if (!connected) {
    return {
      selectable: false,
      connected: false,
      label: "ê³„ì • ì—°ê²° í•„ìš”",
      detail: "Instagram ì—°ê²°í•˜ê¸°ë¥¼ ëˆŒëŸ¬ ê²Œì‹œí•  ê³„ì •ì„ ìŠ¹ì¸í•˜ì„¸ìš”.",
      tone: "pending",
    };
  }
  return {
    selectable: true,
    connected: true,
    label: "ì˜ˆì•½ ê°€ëŠ¥",
    detail: account.username || account.account_id || "ì—°ê²°ëœ ê³„ì •",
    tone: "ok",
  };
}

function validatePublishablePlatforms(platforms) {
  if (platforms.length === 0) return "ë¨¼ì € ê²Œì‹œí•  ê³„ì •ì„ ì—°ê²°í•˜ê³  í”Œëž«í¼ì„ ì„ íƒí•˜ì„¸ìš”.";
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

  if (platformQuickPicker) {
    const visibleInputs = inputs.filter((input) => platformStatus(input.value).selectable);
    platformQuickPicker.innerHTML = `
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
      label: hasImage ? "ì´ë¯¸ì§€ í¬í•¨" : "í…ìŠ¤íŠ¸ ì´ë¯¸ì§€ ìžë™ ìƒì„±",
      tone: "ok",
    };
  }
  if (platform === "threads") return { label: "Mock ê²Œì‹œ", tone: "pending" };
  if (platform === "kakao") return { label: "ê²½ë¡œ ë¯¸êµ¬ì„±", tone: "missing" };
  return { label: "í™•ì¸ í•„ìš”", tone: "pending" };
}

function renderPublishPreview() {
  if (!publishPreview) return;
  const platforms = selectedPlatforms();
  const text = formatPublishTextFromForm();
  if (platforms.length === 0) {
    publishPreview.innerHTML = `
      <div class="emptyState compact">
        <strong>ì„ íƒëœ í”Œëž«í¼ì´ ì—†ìŠµë‹ˆë‹¤.</strong>
        <span>í”Œëž«í¼ì„ ì„ íƒí•˜ë©´ ìµœì¢… ë¬¸êµ¬ê°€ í‘œì‹œë©ë‹ˆë‹¤.</span>
      </div>
    `;
    return;
  }

  publishPreview.innerHTML = platforms.map((platform) => {
    const status = previewStatusFor(platform);
    const previewBody = text
      ? escapeHtml(text)
      : `<span class="previewEmpty">ìž…ë ¥ ëŒ€ê¸°</span>`;
    return `
      <article class="publishPreviewCard">
        <div class="previewHeader">
          <div>
            <strong>${platformLabel(platform)}</strong>
            <span>${text.length}ìž</span>
          </div>
          <span class="previewStatus ${status.tone}">${status.label}</span>
        </div>
        <pre class="previewText">${previewBody}</pre>
      </article>
    `;
  }).join("");
}

function renderConnectionCard(platform, readiness, account) {
  const configured = Boolean(readiness?.configured);
  const missing = readiness?.missing || [];
  const connected = account?.status === "connected";
  const disconnected = account?.status === "disconnected";
  const badge = connected
    ? `<span class="statusBadge ok">ì—°ê²°ë¨</span>`
    : disconnected
      ? `<span class="statusBadge missing">ìž¬ì—°ê²° í•„ìš”</span>`
    : platform === "threads"
      ? `<span class="statusBadge pending">ì¤€ë¹„ ì¤‘</span>`
    : configured
      ? `<span class="statusBadge pending">ìŠ¹ì¸ ê°€ëŠ¥</span>`
      : `<span class="statusBadge missing">ì„¤ì • í•„ìš”</span>`;
  const statusText = connected
    ? escapeHtml(account.username || account.account_id)
    : disconnected
      ? `${escapeHtml(account.username || account.account_id || platformLabel(platform))} ê³„ì • í† í°ì´ í•´ì œëìŠµë‹ˆë‹¤. ë‹¤ì‹œ ìŠ¹ì¸í•˜ì„¸ìš”.`
    : platform === "threads"
      ? "ì‹¤ì œ ë°œí–‰ ì¤€ë¹„ ì¤‘"
    : configured
      ? "ê³„ì • ìŠ¹ì¸ ëŒ€ê¸°"
      : missing.map(missingLabel).join(", ");
  const primaryAction = platform === "threads" && !connected
    ? `<button class="secondaryButton" type="button" disabled>ì¤€ë¹„ ì¤‘</button>`
    : connected
    ? `<button class="secondaryButton" type="button" data-disconnect="${platform}">ì—°ê²° í•´ì œ</button>`
    : configured
      ? `<a class="linkButton primary" href="/api/auth/meta/start?platform=${platform}">${disconnected ? "ìž¬ì—°ê²°í•˜ê¸°" : "ì—°ê²°í•˜ê¸°"}</a>`
      : `<button class="secondaryButton" type="button" disabled>ì‚¬ìš© ë¶ˆê°€</button>`;
  const fallbackAction = platform === "instagram" && configured && !connected
    ? `<a class="secondaryButton" href="/api/auth/meta/start?platform=instagram&variant=basic">ëŒ€ì²´ ì—°ê²° ì‹œë„</a>`
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
        <p>${statusText || "í™•ì¸ í•„ìš”"}</p>
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
    ? `<div class="connectionWarning">ê³„ì • ìƒíƒœ í™•ì¸ í•„ìš”: ${escapeHtml(accountsData.error)}</div>`
    : "";
  accountConnections.innerHTML = `
    ${accountError}
    <div class="connectionGrid">
      ${["instagram"].map((platform) => renderConnectionCard(
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
  imagePreview.textContent = "ì„ íƒëœ ì´ë¯¸ì§€ê°€ ì—†ìŠµë‹ˆë‹¤.";
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
  bodyCount.textContent = `${body.length}ìž`;
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
        skipped.push({ name: relativePath, reason: "ìº¡ì…˜ íŒŒì¼ ì½ê¸° ì‹¤íŒ¨" });
      }
      continue;
    }

    if (CSV_CAPTION_EXTENSIONS.has(extension)) {
      csvFiles.push({ file, relativePath, dateKey: dateFolder?.key || "" });
      continue;
    }

    if (!dateFolder) {
      skipped.push({ name: relativePath, reason: "ë‚ ì§œ í´ë” ì—†ìŒ" });
      continue;
    }
    if (!ALLOWED_IMAGE_TYPES.has(detectedType)) {
      skipped.push({ name: relativePath, reason: "ì´ë¯¸ì§€ í˜•ì‹ ì œì™¸" });
      continue;
    }
    if (file.size <= 0) {
      skipped.push({ name: relativePath, reason: "ë¹ˆ íŒŒì¼" });
      continue;
    }
    if (file.size > MAX_IMAGE_SIZE) {
      skipped.push({ name: relativePath, reason: "8MB ì´ˆê³¼" });
      continue;
    }

    imageFiles.push({ file, relativePath, segments, dateFolder, detectedType });
  }

  const csvCaptions = new Map();
  for (const csv of csvFiles) {
    try {
      const rows = parseCaptionCsv(await csv.file.text());
      for (const row of rows) {
        const reference = firstRowValue(row, ["file", "filename", "file_name", "image", "image_file", "path", "íŒŒì¼", "íŒŒì¼ëª…", "ì´ë¯¸ì§€"]);
        if (!reference) continue;
        const caption = captionFromCsvRow(row, csv.relativePath);
        if (!caption) continue;
        const rowDate = firstRowValue(row, ["date", "folder", "date_folder", "scheduled_date", "ë‚ ì§œ", "í´ë”"]);
        const dateKey = parseDateFolderName(rowDate)?.key || csv.dateKey;
        for (const key of csvCaptionKeys(dateKey, reference)) csvCaptions.set(key, caption);
      }
    } catch {
      skipped.push({ name: csv.relativePath, reason: "CSV ì½ê¸° ì‹¤íŒ¨" });
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
    "ë‚ ì§œ í´ë” ì—†ìŒ": "YYYY-MM-DD ë‚ ì§œ í´ë” ì•ˆì— ë„£ê¸°",
    "ì´ë¯¸ì§€ í˜•ì‹ ì œì™¸": "JPG, PNG, WEBPë¡œ ì €ìž¥",
    "ë¹ˆ íŒŒì¼": "íŒŒì¼ì„ ë‹¤ì‹œ ì €ìž¥",
    "8MB ì´ˆê³¼": "8MB ì´í•˜ë¡œ ì••ì¶•",
    "ìº¡ì…˜ íŒŒì¼ ì½ê¸° ì‹¤íŒ¨": "TXT/MD ì¸ì½”ë”© í™•ì¸",
    "CSV ì½ê¸° ì‹¤íŒ¨": "UTF-8 CSV í˜•ì‹ í™•ì¸",
  }[reason] || "íŒŒì¼ í™•ì¸";
}

function renderSkippedDetails(skipped) {
  if (!skipped.length) return "";
  return `
    <details class="batchSkipped">
      <summary>${skipped.length}ê°œ íŒŒì¼ ì œì™¸</summary>
      <div>
        ${skipped.slice(0, 12).map((entry) => `
          <article>
            <strong>${escapeHtml(entry.name)}</strong>
            <span>${escapeHtml(entry.reason)} Â· ${escapeHtml(skippedFixFor(entry.reason))}</span>
          </article>
        `).join("")}
        ${skipped.length > 12 ? `<small>ì™¸ ${skipped.length - 12}ê°œ</small>` : ""}
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
        <strong>í´ë” êµ¬ì¡°</strong>
        <span>ìƒìœ„í´ë” / 2026-06-21 / 001.jpg</span>
        <span>ë‚ ì§œ í´ë”ë³„ íŒŒì¼ëª… ìˆ«ìžìˆœìœ¼ë¡œ ì˜ˆì•½ë©ë‹ˆë‹¤. 001.txt ë˜ëŠ” captions.csvê°€ ìžˆìœ¼ë©´ ë¬¸êµ¬ë¥¼ ìžë™ ë§¤ì¹­í•©ë‹ˆë‹¤.</span>
      </div>
    `;
    return;
  }

  const warnings = [
    state.noPlatforms ? "í”Œëž«í¼ì„ í•˜ë‚˜ ì´ìƒ ì„ íƒí•˜ì„¸ìš”." : "",
    state.hasKakao ? "KakaoëŠ” ë°œì†¡ ê²½ë¡œê°€ ì•„ì§ êµ¬ì„±ë˜ì§€ ì•Šì•„ ë°°ì¹˜ ì˜ˆì•½ì—ì„œ ì œì™¸í•´ì•¼ í•©ë‹ˆë‹¤." : "",
    state.jpgBlockCount ? `Instagram ì„ íƒ ì‹œ JPGê°€ ì•„ë‹Œ ì´ë¯¸ì§€ ${state.jpgBlockCount}ê°œë¥¼ êµì²´í•´ì•¼ í•©ë‹ˆë‹¤.` : "",
    state.pastCount ? `ì´ë¯¸ ì§€ë‚œ ì˜ˆì•½ ì‹œê°„ ${state.pastCount}ê°œê°€ ìžˆìŠµë‹ˆë‹¤.` : "",
    state.overflowCount ? `ê°„ê²© ë•Œë¬¸ì— ë‚ ì§œ í´ë” ë‹¤ìŒ ë‚ ë¡œ ë„˜ì–´ê°€ëŠ” ì´ë¯¸ì§€ ${state.overflowCount}ê°œê°€ ìžˆìŠµë‹ˆë‹¤.` : "",
    state.duplicate.fileConflictCount ? `ê°™ì€ ë‚ ì§œì˜ ê°™ì€ íŒŒì¼ëª… ${state.duplicate.fileConflictCount}ê°œë¥¼ í™•ì¸í•˜ì„¸ìš”.` : "",
    state.duplicate.planConflictCount ? `ì´ë²ˆ ì˜ˆì•½ ëª©ë¡ ì•ˆì— ê°™ì€ ì‹œê°„ ì¤‘ë³µ í›„ë³´ ${state.duplicate.planConflictCount}ê°œê°€ ìžˆìŠµë‹ˆë‹¤.` : "",
    state.duplicate.existingConflictCount ? `ê¸°ì¡´ ì˜ˆì•½ê³¼ ì‹œê°„ì´ ê²¹ì¹˜ëŠ” í›„ë³´ ${state.duplicate.existingConflictCount}ê°œê°€ ìžˆìŠµë‹ˆë‹¤.` : "",
    state.missingCaptionCount ? `ìº¡ì…˜ íŒŒì¼ì´ ì—†ëŠ” ì´ë¯¸ì§€ ${state.missingCaptionCount}ê°œëŠ” ê³µí†µ ë¬¸êµ¬ë¥¼ ì‚¬ìš©í•©ë‹ˆë‹¤.` : "",
    state.missingCopyCount ? `ë³¸ë¬¸ ì—†ì´ ì˜ˆì•½ë  ì´ë¯¸ì§€ ${state.missingCopyCount}ê°œê°€ ìžˆìŠµë‹ˆë‹¤. ìº¡ì…˜ íŒŒì¼ì´ë‚˜ ê¸°ë³¸ ë³¸ë¬¸ì„ ìž…ë ¥í•˜ì„¸ìš”.` : "",
    state.hasThreads ? "ThreadsëŠ” í˜„ìž¬ mock ê²Œì‹œ ìƒíƒœìž…ë‹ˆë‹¤." : "",
  ].filter(Boolean);

  const titleTemplate = String(form.elements.title.value || "").trim();
  const body = String(form.elements.body.value || "").trim();
  const link = String(form.elements.link_url.value || "").trim();
  const hashtags = String(form.elements.hashtags.value || "").trim();

  batchPlan.innerHTML = `
    <div class="batchMetricGrid">
      <article>
        <span>ì´ë¯¸ì§€</span>
        <strong>${items.length}ê°œ</strong>
      </article>
      <article>
        <span>ë‚ ì§œ í´ë”</span>
        <strong>${state.dateCount}ì¼</strong>
      </article>
      <article>
        <span>ì˜ˆì•½ ìž‘ì—…</span>
        <strong>${state.taskCount}ê°œ</strong>
      </article>
      <article>
        <span>ì‹œê°„ëŒ€</span>
        <strong>${escapeHtml(timeZone)}</strong>
      </article>
    </div>
    <div class="batchRuleSummary">
      <span>ì²« ì˜ˆì•½: <strong>${state.firstDate ? escapeHtml(formatFullDateTime(state.firstDate)) : "-"}</strong></span>
      <span>ë§ˆì§€ë§‰ ì˜ˆì•½: <strong>${state.lastDate ? escapeHtml(formatFullDateTime(state.lastDate)) : "-"}</strong></span>
      <span>ì±„ë„: <strong>${platforms.length ? platforms.map(platformLabel).join(", ") : "ì„ íƒ í•„ìš”"}</strong></span>
      <span>ë¬¸êµ¬: <strong>${titleTemplate ? "ìž‘ì„± ì œëª© ì‚¬ìš©" : "íŒŒì¼ëª… ì œëª© ì‚¬ìš©"}</strong>${body || link || hashtags ? " Â· ë³¸ë¬¸/ë§í¬/í•´ì‹œíƒœê·¸ ì ìš©" : ""}</span>
      <span>ìº íŽ˜ì¸: <strong>${formValue("campaign_name") || "ë¯¸ì§€ì •"}</strong>${utmAuto?.checked ? " Â· UTM ìžë™" : ""}</span>
      <span>ìº¡ì…˜: <strong>${state.captionCount ? `${state.captionCount}ê°œ íŒŒì¼ ë§¤ì¹­` : "ê³µí†µ ë¬¸êµ¬ ì‚¬ìš©"}</strong>${state.missingCaptionCount ? ` Â· ${state.missingCaptionCount}ê°œ ë¯¸ë§¤ì¹­` : ""}</span>
    </div>
    ${warnings.length ? `
      <div class="batchChecks">
        ${warnings.map((warning) => `<span>${escapeHtml(warning)}</span>`).join("")}
      </div>
    ` : `
      <div class="batchChecks ok">
        <span>${state.taskCount}ê°œ ì˜ˆì•½ ìž‘ì—…ì„ ë§Œë“¤ ì¤€ë¹„ê°€ ëìŠµë‹ˆë‹¤.</span>
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
        <strong>ì˜ˆì•½ ìº˜ë¦°ë”</strong>
        <span>í´ë”ë¥¼ ì„ íƒí•˜ë©´ ë‚ ì§œë³„ ì˜ˆì•½ëŸ‰ì´ í‘œì‹œë©ë‹ˆë‹¤.</span>
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
  const weekdays = ["ì¼", "ì›”", "í™”", "ìˆ˜", "ëª©", "ê¸ˆ", "í† "];
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
        ${batchCount ? `<span>ì‹ ê·œ ${batchCount}ê°œ</span>` : ""}
        ${existingCount ? `<span>ê¸°ì¡´ ${existingCount}ê°œ</span>` : ""}
        ${hasConflict ? "<span>ì¤‘ë³µ í™•ì¸</span>" : ""}
      </div>
    `;
  }).join("");

  scheduleCalendar.innerHTML = `
    <div class="scheduleCalendarHeader">
      <strong>${escapeHtml(monthLabel)} ì˜ˆì•½ ìº˜ë¦°ë”</strong>
      <span>ì‹ ê·œ ${items.length}ê°œ Â· ê¸°ì¡´ ${[...existingCounts.values()].reduce((sum, count) => sum + count, 0)}ê°œ</span>
    </div>
    <div class="calendarLegend">
      <span>ì‹ ê·œ ì˜ˆì•½</span>
      <span class="existing">ê¸°ì¡´ ì˜ˆì•½</span>
      <span class="conflict">ì¤‘ë³µ í™•ì¸</span>
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
  const hasBlockingIssue = needsInstagramJpeg || hasPastItems || hasKakao || hasOverflowItems || hasDuplicateWarnings || hasMissingCopy;
  const allSucceeded = items.length > 0 && items.every((item) => batchResultFor(item)?.status === "success");
  const remainingItems = items.filter((item) => batchResultFor(item)?.status !== "success");
  const remainingTaskCount = remainingItems.length * platforms.length;

  renderBatchPlan();
  renderScheduleCalendar();

  if (submitBatch) {
    submitBatch.disabled = appState.batchSubmitting || allSucceeded || items.length === 0 || platforms.length === 0 || hasBlockingIssue;
    submitBatch.textContent = appState.batchSubmitting
      ? "ì˜ˆì•½ ìƒì„± ì¤‘"
      : allSucceeded
      ? "ì˜ˆì•½ ì™„ë£Œ"
      : hasBlockingIssue
      ? "ì˜ˆì•½ ì¡°ê±´ í™•ì¸ í•„ìš”"
      : items.length && platforms.length
      ? `${remainingTaskCount || state.taskCount}ê°œ ì˜ˆì•½ ìž‘ì—… ë§Œë“¤ê¸°`
      : "ì˜ˆì•½ ìž‘ì—… ë§Œë“¤ê¸°";
  }
  if (clearBatch) clearBatch.disabled = items.length === 0 && skipped.length === 0;

  if (items.length === 0) {
    batchQueue.className = "batchQueue emptyState compact";
    batchQueue.innerHTML = skipped.length
      ? `<strong>${skipped.length}ê°œ íŒŒì¼ì´ ì œì™¸ë˜ì—ˆìŠµë‹ˆë‹¤.</strong><span>ë‚ ì§œ í´ë”ì™€ ì´ë¯¸ì§€ í˜•ì‹ì„ í™•ì¸í•˜ì„¸ìš”.</span>${renderSkippedDetails(skipped)}`
      : `<strong>ìƒìœ„ í´ë”ë¥¼ ì„ íƒí•˜ì„¸ìš”.</strong><span>ì˜ˆ: campaign / 2026-06-21 / 001.jpg</span>`;
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
    ? `<div class="batchWarning">Instagram ì˜ˆì•½ì€ JPG ì´ë¯¸ì§€ë§Œ ì‚¬ìš©í•  ìˆ˜ ìžˆìŠµë‹ˆë‹¤.</div>`
    : "";
  const pastNotice = hasPastItems
    ? `<div class="batchWarning">ì´ë¯¸ ì§€ë‚œ ì˜ˆì•½ ì‹œê°„ì´ í¬í•¨ë˜ì–´ ìžˆìŠµë‹ˆë‹¤. ë‚ ì§œ í´ë”ë‚˜ ì‹œìž‘ ì‹œê°„ì„ ì¡°ì •í•˜ì„¸ìš”.</div>`
    : "";
  const duplicateNotice = state.duplicate.warningCount
    ? `<div class="batchWarning">ì¤‘ë³µ ê°€ëŠ¥ì„±ì´ ìžˆëŠ” ì˜ˆì•½ ${state.duplicate.warningCount}ê±´ì´ ìžˆìŠµë‹ˆë‹¤. ê°™ì€ ì‹œê°„ì— ê°™ì€ ì±„ë„ë¡œ ë‚˜ê°€ëŠ”ì§€ í™•ì¸í•˜ì„¸ìš”.</div>`
    : "";

  batchQueue.className = "batchQueue";
  batchQueue.innerHTML = `
    <div class="batchSummary">
      <strong>${items.length}ê°œ ì˜ˆì•½ í›„ë³´</strong>
      <span>${groups.size}ì¼ Â· ${platforms.length || 0}ê°œ ì±„ë„ Â· ${state.taskCount}ê°œ ìž‘ì—…</span>
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
            <span>${group.length}ê°œ ì´ë¯¸ì§€</span>
          </summary>
          ${group.map((item) => {
            const needsJpeg = false;
            const result = batchResultFor(item);
            const itemWarnings = state.duplicate.itemWarnings.get(item.relativePath) || [];
            const scheduleIssue = batchItemScheduleIssue(item);
            const missingCopy = state.missingCopyPaths.has(item.relativePath);
            const badgeLabel = needsJpeg
              ? "JPG í•„ìš”"
              : scheduleIssue === "past"
              ? "ì§€ë‚œ ì‹œê°„"
              : scheduleIssue === "overflow"
              ? "ë‹¤ìŒë‚ "
              : missingCopy
              ? "ë¬¸êµ¬ í•„ìš”"
              : itemWarnings.length
              ? "ì¤‘ë³µ í™•ì¸"
              : batchItemTypeLabel(item);
            const captionPreview = truncateText(item.captionBody || item.captionTitle || item.captionHashtags || "", 96);
            return `
              <div class="batchFile">
                <span class="batchSequence">${item.indexWithinDate + 1}</span>
                <div class="batchFileMeta">
                  <strong>${escapeHtml(item.fileName)}</strong>
                  <small>${escapeHtml(item.relativePath)}</small>
                  ${item.captionSource ? `<span class="captionBadge">ìº¡ì…˜ ë§¤ì¹­: ${escapeHtml(item.captionSource)}</span>` : ""}
                  ${captionPreview ? `<span class="batchCaptionPreview">${escapeHtml(captionPreview)}</span>` : ""}
                  ${missingCopy ? `<span class="batchCaptionPreview">ìº¡ì…˜ íŒŒì¼ ë˜ëŠ” ê¸°ë³¸ ë³¸ë¬¸ì´ í•„ìš”í•©ë‹ˆë‹¤.</span>` : ""}
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
  if (batchStatus) batchStatus.textContent = "ëŒ€ê¸° ì¤‘";
  renderBatchQueue();
}

function resetBatchResultsForPlanChange() {
  if (appState.batchSubmitting || Object.keys(appState.batchResults).length === 0) return;
  appState.batchResults = {};
  if (batchStatus && appState.batchItems.length) batchStatus.textContent = `${appState.batchItems.length}ê°œ ì¤€ë¹„`;
}

imageFile.addEventListener("change", () => {
  const file = imageFile.files?.[0];
  clearImagePreview();
  if (!file) return;
  if (!ALLOWED_IMAGE_TYPES.has(imageTypeForFile(file))) {
    showToast("PNG, JPG, WEBP ì´ë¯¸ì§€ë§Œ ì„ íƒí•  ìˆ˜ ìžˆìŠµë‹ˆë‹¤.", "error");
    imageFile.value = "";
    return;
  }
  if (file.size > MAX_IMAGE_SIZE) {
    showToast("ì´ë¯¸ì§€ëŠ” 8MB ì´í•˜ë¡œ ì„ íƒí•´ ì£¼ì„¸ìš”.", "error");
    imageFile.value = "";
    return;
  }

  previewUrl = URL.createObjectURL(file);
  clearImage.disabled = false;
  imagePreview.innerHTML = `
    <img src="${previewUrl}" alt="ì„ íƒí•œ ì´ë¯¸ì§€ ë¯¸ë¦¬ë³´ê¸°" />
    <div>
      <strong>${escapeHtml(file.name)}</strong>
      <span>${Math.ceil(file.size / 1024)} KB Â· ì—…ë¡œë“œ ì „</span>
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
  formStatus.textContent = shouldGenerateTextImage ? "í…ìŠ¤íŠ¸ ì´ë¯¸ì§€ ìƒì„± ì¤‘" : "ì´ë¯¸ì§€ ì—…ë¡œë“œ ì¤‘";
  let result;
  try {
    result = await uploadImageFileToAssets(uploadSource, { forceJpeg: platforms.includes("instagram") });
  } finally {
    imagePreview.classList.remove("uploading");
  }
  form.elements.image_key.value = result.image_key;
  form.elements.image_url.value = result.image_url;
  imagePreview.innerHTML = `
    <img src="${shouldGenerateTextImage ? result.image_url : previewUrl}" alt="ê²Œì‹œ ì´ë¯¸ì§€ ë¯¸ë¦¬ë³´ê¸°" />
    <div>
      <strong>${escapeHtml(shouldGenerateTextImage ? "text-post.jpg" : uploadSource.name)}</strong>
      <span>${shouldGenerateTextImage ? "ë³¸ë¬¸ìœ¼ë¡œ ìžë™ ìƒì„±" : "ì—…ë¡œë“œ ì™„ë£Œ"}</span>
    </div>
  `;
  return result;
}

function renderEmptyJobs() {
  jobsEl.innerHTML = `
    <div class="emptyState">
      <strong>ì•„ì§ ë°œí–‰ ìž‘ì—…ì´ ì—†ìŠµë‹ˆë‹¤.</strong>
      <span>ê²Œì‹œê¸€ì„ ì €ìž¥í•˜ê³  ë°œí–‰í•˜ë©´ ì´ê³³ì— ìž‘ì—… ìƒíƒœê°€ í‘œì‹œë©ë‹ˆë‹¤.</span>
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
      ? `<button class="secondaryButton" data-retry="${job.id}" type="button">ìž¬ì‹œë„</button>`
      : "";
    const link = job.external_post_url
      ? `<a class="jobLink" href="${escapeHtml(job.external_post_url)}" target="_blank" rel="noreferrer">ê²Œì‹œë¬¼ ì—´ê¸°</a>`
      : "";
    return `
      <article class="job">
        <div class="platformMark" aria-hidden="true">${platformInitial(job.platform)}</div>
        <div>
          <strong>${platformLabel(job.platform)}</strong>
          <p>${escapeHtml(job.title || "ì œëª© ì—†ìŒ")}</p>
          ${job.campaign_name ? `<span class="jobCampaign">${escapeHtml(job.campaign_name)}</span>` : ""}
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
  onStage("uploading", "ì—…ë¡œë“œ ì¤‘");
  const uploadedImage = await uploadImageFileToAssets(item.file, { forceJpeg: platforms.includes("instagram") });
  const fallbackTitle = fileStem(item.fileName);
  const titleTemplate = item.captionTitle || formValue("title");
  const title = truncateText(titleTemplate || fallbackTitle, 120) || "image";
  const body = item.captionBody || formValue("body");
  const linkUrl = applyAutoUtm(item.captionLink || formValue("link_url"), platforms, fallbackTitle);
  const hashtags = item.captionHashtags || formValue("hashtags");
  onStage("creating", "ê²Œì‹œê¸€ ìƒì„± ì¤‘");
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

  onStage("scheduling", "ì˜ˆì•½ ë“±ë¡ ì¤‘");
  await request(`/api/posts/${post.post_id}/publish`, {
    method: "POST",
    body: JSON.stringify({
      mode: "scheduled",
      scheduled_at: scheduledAtForBatchItem(item),
    }),
  });
  onStage("success", "ì˜ˆì•½ ì™„ë£Œ");
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

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const explicitSinglePostSubmit = singlePostSubmitRequested;
  singlePostSubmitRequested = false;
  if (!explicitSinglePostSubmit) {
    if (manualPostDetails) manualPostDetails.open = true;
    formStatus.textContent = "ë‹¨ê±´ ê²Œì‹œ í™•ì¸ í•„ìš”";
    showToast("ë‹¨ê±´ ê²Œì‹œ ì˜µì…˜ì„ ì—´ê³  ê²Œì‹œ ë²„íŠ¼ì„ ëˆŒëŸ¬ì•¼ ë°œí–‰ë©ë‹ˆë‹¤.", "error");
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
  setBusy(submitPost, true, "ì²˜ë¦¬ ì¤‘");
  formStatus.textContent = "ë°œí–‰ ìš”ì²­ ì¤‘";
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
    formStatus.textContent = "ì™„ë£Œ";
    showToast(mode === "scheduled" ? "ì˜ˆì•½ ìž‘ì—…ì„ ë§Œë“¤ì—ˆìŠµë‹ˆë‹¤." : "ë°œí–‰ ìž‘ì—…ì„ ë§Œë“¤ì—ˆìŠµë‹ˆë‹¤.");
    await loadJobs();
  } catch (error) {
    formStatus.textContent = "ì‹¤íŒ¨";
    showToast(error.message, "error");
  } finally {
    setBusy(submitPost, false, "ê²Œì‹œ ìž‘ì—… ë§Œë“¤ê¸°");
  }
});

submitPost?.addEventListener("click", requestSinglePostSubmit);

batchFolderInput?.addEventListener("change", async () => {
  if (batchStatus) batchStatus.textContent = "í´ë” ì½ëŠ” ì¤‘";
  const { items, skipped } = await buildBatchItems(batchFolderInput.files);
  appState.batchItems = items;
  appState.batchSkipped = skipped;
  appState.batchResults = {};
  appState.batchDateGroups = {};
  if (batchStatus) batchStatus.textContent = items.length ? `${items.length}ê°œ ì¤€ë¹„` : "ëŒ€ê¸° ì¤‘";
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
    showToast("ì˜ˆì•½ ìž‘ì—… ë§Œë“¤ê¸° ë²„íŠ¼ì„ ëˆŒëŸ¬ì•¼ ëŒ€ëŸ‰ ì˜ˆì•½ì´ ìƒì„±ë©ë‹ˆë‹¤.", "error");
    return;
  }
  const items = appState.batchItems;
  const platforms = selectedPlatforms();
  const state = batchValidationState(items, platforms);
  if (items.length === 0) {
    showToast("ì˜ˆì•½í•  ì´ë¯¸ì§€ê°€ ì—†ìŠµë‹ˆë‹¤.", "error");
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
    showToast("KakaoëŠ” ì•„ì§ ë°°ì¹˜ ì˜ˆì•½ ë°œì†¡ ê²½ë¡œê°€ êµ¬ì„±ë˜ì§€ ì•Šì•˜ìŠµë‹ˆë‹¤.", "error");
    renderBatchQueue();
    return;
  }
  if (state.pastCount > 0) {
    showToast("ì§€ë‚œ ì˜ˆì•½ ì‹œê°„ì´ í¬í•¨ë˜ì–´ ìžˆìŠµë‹ˆë‹¤. ë‚ ì§œ í´ë”ë‚˜ ì‹œìž‘ ì‹œê°„ì„ ì¡°ì •í•˜ì„¸ìš”.", "error");
    renderBatchQueue();
    return;
  }
  if (state.overflowCount > 0) {
    showToast("ë‹¤ìŒë‚ ë¡œ ë„˜ì–´ê°€ëŠ” ì˜ˆì•½ì´ ìžˆìŠµë‹ˆë‹¤. ë‚ ì§œ í´ë”ë‚˜ ê°„ê²©ì„ ì¡°ì •í•˜ì„¸ìš”.", "error");
    renderBatchQueue();
    return;
  }
  if (state.duplicate.warningCount > 0) {
    showToast("ì¤‘ë³µ ê°€ëŠ¥ì„±ì´ ìžˆëŠ” ì˜ˆì•½ ì‹œê°„ì´ ìžˆìŠµë‹ˆë‹¤. íŒŒì¼ëª…ê³¼ ì˜ˆì•½ ì‹œê°„ì„ ì¡°ì •í•˜ì„¸ìš”.", "error");
    renderBatchQueue();
    return;
  }
  if (state.missingCopyCount > 0) {
    showToast("ë³¸ë¬¸ ì—†ì´ ì˜ˆì•½ë  ì´ë¯¸ì§€ê°€ ìžˆìŠµë‹ˆë‹¤. ìº¡ì…˜ íŒŒì¼ì´ë‚˜ ê¸°ë³¸ ë³¸ë¬¸ì„ ìž…ë ¥í•˜ì„¸ìš”.", "error");
    renderBatchQueue();
    return;
  }

  const pendingItems = items.filter((item) => batchResultFor(item)?.status !== "success");
  if (pendingItems.length === 0) {
    showToast("ì´ë¯¸ ëª¨ë“  ì˜ˆì•½ ìž‘ì—…ì´ ì™„ë£Œë˜ì—ˆìŠµë‹ˆë‹¤.");
    renderBatchQueue();
    return;
  }
  const taskCount = pendingItems.length * platforms.length;
  const confirmed = window.confirm([
    `${taskCount}ê°œ ì˜ˆì•½ ìž‘ì—…ì„ ë§Œë“¤ê¹Œìš”?`,
    `ê¸°ê°„: ${state.firstDate ? formatFullDateTime(state.firstDate) : "-"} ~ ${state.lastDate ? formatFullDateTime(state.lastDate) : "-"}`,
    `ì±„ë„: ${platforms.map(platformLabel).join(", ")}`,
    `ìº íŽ˜ì¸: ${formValue("campaign_name") || "ë¯¸ì§€ì •"}`,
  ].join("\n"));
  if (!confirmed) return;

  appState.batchSubmitting = true;
  setBusy(submitBatch, true, "ì˜ˆì•½ ìƒì„± ì¤‘");
  if (clearBatch) clearBatch.disabled = true;
  let created = 0;
  const failed = [];
  try {
    for (const item of pendingItems) {
      appState.batchResults[item.relativePath] = { status: "running", label: "ëŒ€ê¸° ì¤‘" };
    }
    renderBatchQueue();

    for (const item of pendingItems) {
      const key = item.relativePath;
      if (batchStatus) batchStatus.textContent = `${created + failed.length + 1}/${pendingItems.length} ì²˜ë¦¬ ì¤‘`;
      try {
        await createScheduledBatchItem(item, platforms, (status, label) => {
          appState.batchResults[key] = { status, label };
          renderBatchQueue();
        });
        created += 1;
      } catch (error) {
        const message = error instanceof Error ? error.message : "ì˜ˆì•½ ìƒì„± ì‹¤íŒ¨";
        appState.batchResults[key] = { status: "failed", label: "ì‹¤íŒ¨" };
        failed.push({
          item,
          message,
        });
        renderBatchQueue();
      }
    }

    if (created > 0) await loadJobs();
    if (failed.length > 0) {
      if (batchStatus) batchStatus.textContent = `${created}ê°œ ì™„ë£Œ / ${failed.length}ê°œ ì‹¤íŒ¨`;
      showToast(`${failed.length}ê°œ ì˜ˆì•½ ì‹¤íŒ¨: ${failed[0].message}`, "error");
    } else {
      if (batchStatus) batchStatus.textContent = "ì™„ë£Œ";
      showToast(`${created}ê°œ ì˜ˆì•½ ìž‘ì—…ì„ ë§Œë“¤ì—ˆìŠµë‹ˆë‹¤.`);
    }
  } finally {
    appState.batchSubmitting = false;
    setBusy(submitBatch, false, "ì˜ˆì•½ ìž‘ì—… ë§Œë“¤ê¸°");
    renderBatchQueue();
  }
});

jobsEl.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-retry]");
  if (!button) return;
  setBusy(button, true, "ìž¬ì‹œë„ ì¤‘");
  try {
    await request(`/api/jobs/${button.dataset.retry}/retry`, { method: "POST", body: "{}" });
    showToast("ìž‘ì—…ì„ ë‹¤ì‹œ ì‹¤í–‰í–ˆìŠµë‹ˆë‹¤.");
    await loadJobs();
  } catch (error) {
    showToast(error.message, "error");
    setBusy(button, false, "ìž¬ì‹œë„");
  }
});

accountConnections?.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-disconnect]");
  if (!button) return;
  setBusy(button, true, "í•´ì œ ì¤‘");
  try {
    await request("/api/social-accounts/disconnect", {
      method: "POST",
      body: JSON.stringify({ platform: button.dataset.disconnect }),
    });
    showToast("ê³„ì • ì—°ê²°ì„ í•´ì œí–ˆìŠµë‹ˆë‹¤.");
    await loadConnections();
  } catch (error) {
    showToast(error.message, "error");
    setBusy(button, false, "ì—°ê²° í•´ì œ");
  }
});

refreshJobs.addEventListener("click", async () => {
  setBusy(refreshJobs, true, "ìƒˆë¡œê³ ì¹¨ ì¤‘");
  try {
    await Promise.all([loadJobs(), loadConnections()]);
    showToast("ìƒíƒœë¥¼ ìƒˆë¡œê³ ì¹¨í–ˆìŠµë‹ˆë‹¤.");
  } catch (error) {
    showToast(error.message, "error");
  } finally {
    setBusy(refreshJobs, false, "ìž‘ì—… ìƒˆë¡œê³ ì¹¨");
  }
});

runScheduler.addEventListener("click", async () => {
  const confirmed = window.confirm("ìžë™ ì‹¤í–‰ì´ ì§€ì—°ëœ ì˜ˆì•½ ìž‘ì—…ì„ ì§€ê¸ˆ í™•ì¸í•©ë‹ˆë‹¤. ê³„ì†í• ê¹Œìš”?");
  if (!confirmed) return;
  setBusy(runScheduler, true, "ì‹¤í–‰ ì¤‘");
  try {
    const result = await request("/api/scheduler/run", { method: "POST", body: "{}" });
    showToast(`${result.processed?.length || 0}ê°œ ì˜ˆì•½ ìž‘ì—…ì„ í™•ì¸í–ˆìŠµë‹ˆë‹¤.`);
    await loadJobs();
  } catch (error) {
    showToast(error.message, "error");
  } finally {
    setBusy(runScheduler, false, "ì˜ˆì•½ ìž‘ì—… ìˆ˜ë™ í™•ì¸");
  }
});

const oauthResult = new URLSearchParams(window.location.search);
if (oauthResult.get("connected")) {
  showToast("ê³„ì • ì—°ê²°ì´ ì™„ë£ŒëìŠµë‹ˆë‹¤.");
  history.replaceState({}, "", window.location.pathname);
}
if (oauthResult.get("oauth_error")) {
  showToast(`ê³„ì • ì—°ê²° ì‹¤íŒ¨: ${oauthResult.get("oauth_error")}`, "error");
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
loadJobs().catch((error) => {
  jobsEl.innerHTML = `<div class="emptyState error"><strong>ìž‘ì—…ì„ ë¶ˆëŸ¬ì˜¤ì§€ ëª»í–ˆìŠµë‹ˆë‹¤.</strong><span>${escapeHtml(error.message)}</span></div>`;
});
