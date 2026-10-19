"use strict";

const RELEASE_API = "https://api.github.com/repos/tanmainhat0502/dms_annotation_extension/releases/latest";
const NATIVE_HOST = "ai.nota.labeling_updater";
const currentVersion = chrome.runtime.getManifest().version;
const button = document.getElementById("updateCheck");
const setupButton = document.getElementById("updaterSetup");
const status = document.getElementById("updateStatus");
document.getElementById("currentVersion").textContent = currentVersion;

function versionParts(value) {
  return String(value || "0").replace(/^v/i, "").split(".").map((part) => Number(part) || 0);
}

function compareVersions(left, right) {
  const a = versionParts(left);
  const b = versionParts(right);
  const length = Math.max(a.length, b.length);
  for (let index = 0; index < length; index += 1) {
    const difference = (a[index] || 0) - (b[index] || 0);
    if (difference) return Math.sign(difference);
  }
  return 0;
}

function show(message, kind = "") {
  status.className = kind;
  status.textContent = message;
}

function sendNative(message) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendNativeMessage(NATIVE_HOST, message, (response) => {
      const error = chrome.runtime.lastError;
      if (error) {
        reject(new Error(error.message));
        return;
      }
      resolve(response);
    });
  });
}

function openUpdaterSetup() {
  chrome.tabs.create({ url: chrome.runtime.getURL("updater/setup.html") });
}

async function detectNativeUpdater() {
  try {
    const response = await sendNative({ action: "ping" });
    if (response?.ok) setupButton.hidden = true;
  } catch (_) {
    setupButton.hidden = false;
  }
}

async function requestStoreUpdate() {
  try {
    if (typeof chrome.runtime.requestUpdateCheck !== "function") return false;
    const result = await chrome.runtime.requestUpdateCheck();
    if (result?.status !== "update_available") return false;
    button.disabled = true;
    button.textContent = `Đang cập nhật ${result.version || "bản mới"}…`;
    show("Chrome đã tìm thấy bản Store mới và đang tải. Extension sẽ khởi động lại để áp dụng.", "ok");
    setTimeout(() => chrome.runtime.reload(), 800);
    return true;
  } catch (_) {
    return false;
  }
}

async function checkGitHubRelease() {
  const response = await fetch(RELEASE_API, {
    cache: "no-store",
    headers: { Accept: "application/vnd.github+json" }
  });
  if (!response.ok) throw new Error(`GitHub HTTP ${response.status}`);
  const release = await response.json();
  const latestVersion = String(release.tag_name || release.name || "").replace(/^v/i, "");
  if (!latestVersion) throw new Error("Release chưa có số phiên bản");
  if (compareVersions(latestVersion, currentVersion) <= 0) {
    button.textContent = `Đã cập nhật v${currentVersion}`;
    button.disabled = true;
    show("Bạn đang dùng phiên bản mới nhất trên GitHub.", "ok");
    return;
  }
  button.dataset.latestVersion = latestVersion;
  button.textContent = `Update ngay v${latestVersion}`;
  show(setupButton.hidden
    ? `Có bản v${latestVersion}. Bấm Update ngay để tự cập nhật và reload.`
    : `Có bản v${latestVersion}. Cài NOTA Updater một lần, sau đó chỉ cần bấm Update ngay.`, "warn");
}

async function runNativeUpdate() {
  const expectedVersion = button.dataset.latestVersion;
  button.disabled = true;
  button.textContent = `Đang update v${expectedVersion}…`;
  show("Đang tải Release, kiểm tra SHA256 và thay file extension…");
  try {
    const response = await sendNative({ action: "update", expectedVersion });
    if (!response?.ok) throw new Error(response?.message || "Updater trả về lỗi");
    const installedVersion = response.version || currentVersion;
    const runtimeIsStale = compareVersions(installedVersion, currentVersion) > 0;
    if (response.status === "updated" || runtimeIsStale) {
      button.textContent = `Đang nạp v${installedVersion}…`;
      show(response.status === "updated"
        ? "Cập nhật hoàn tất. Extension đang nạp phiên bản mới…"
        : `File v${installedVersion} đã có trên máy. Extension đang nạp lại để thay runtime v${currentVersion}…`, "ok");
      setTimeout(() => chrome.runtime.reload(), 700);
      return;
    }
    button.textContent = `Đã cập nhật v${installedVersion}`;
    show("Bạn đang dùng phiên bản mới nhất.", "ok");
  } catch (error) {
    button.disabled = false;
    button.textContent = `Thử update lại v${expectedVersion}`;
    setupButton.hidden = false;
    show(`Chưa dùng được NOTA Updater: ${error.message}`, "err");
    openUpdaterSetup();
  }
}

setupButton.addEventListener("click", openUpdaterSetup);

button.addEventListener("click", async () => {
  if (button.dataset.latestVersion) {
    await runNativeUpdate();
    return;
  }
  button.disabled = true;
  button.textContent = "Đang kiểm tra…";
  show("Đang kiểm tra Chrome Web Store và GitHub…");
  if (await requestStoreUpdate()) return;
  try {
    await checkGitHubRelease();
  } catch (error) {
    button.textContent = "Thử kiểm tra lại";
    show(`Không kiểm tra được GitHub: ${error.message}`, "err");
  } finally {
    if (!button.textContent.startsWith("Đã cập nhật") && !button.textContent.startsWith("Đang cập nhật")) {
      button.disabled = false;
    }
  }
});

detectNativeUpdater();
