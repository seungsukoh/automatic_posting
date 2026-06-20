const form = document.querySelector("#postForm");
const jobsEl = document.querySelector("#jobs");
const toast = document.querySelector("#toast");
const imageFile = document.querySelector("#imageFile");
const imagePreview = document.querySelector("#imagePreview");
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
    <div class="wizard-meta">
      <strong>${step.platform}</strong>
      <span>${index + 1} / ${wizardSteps.length}</span>
      <span>${doneCount}개 완료</span>
    </div>
    <div class="wizard-bar"><span style="width: ${Math.round((doneCount / wizardSteps.length) * 100)}%"></span></div>
    <h3>${step.title}</h3>
    <p>${step.body}</p>
    <div class="wizard-actions">
      <button type="button" class="secondary" data-wizard-prev ${index === 0 ? "disabled" : ""}>이전</button>
      <a class="link-button" href="${step.url}" target="_blank" rel="noreferrer">${step.action}</a>
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

function clearImagePreview() {
  if (previewUrl) URL.revokeObjectURL(previewUrl);
  previewUrl = "";
  imagePreview.textContent = "선택된 이미지가 없습니다.";
  form.elements.image_name.value = "";
}

imageFile.addEventListener("change", () => {
  const file = imageFile.files?.[0];
  clearImagePreview();
  if (!file) return;
  if (!file.type.startsWith("image/")) {
    showToast("이미지 파일만 선택할 수 있습니다.");
    imageFile.value = "";
    return;
  }

  previewUrl = URL.createObjectURL(file);
  form.elements.image_name.value = file.name;
  imagePreview.innerHTML = `
    <img src="${previewUrl}" alt="선택한 이미지 미리보기">
    <div>
      <strong>${escapeHtml(file.name)}</strong>
      <span>${Math.ceil(file.size / 1024)} KB</span>
    </div>
  `;
});

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
    clearImagePreview();
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
