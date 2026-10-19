"use strict";

const RELEASE_API = "https://api.github.com/repos/tanmainhat0502/dms_annotation_extension/releases/latest";
const currentVersion = chrome.runtime.getManifest().version;
const button = document.getElementById("updateCheck");
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
  const zip = (release.assets || []).find((asset) => asset.name?.toLowerCase().endsWith(".zip"));
  button.dataset.downloadUrl = zip?.browser_download_url || release.html_url;
  button.textContent = `Tải bản v${latestVersion}`;
  show(`Có bản v${latestVersion}. Bản Load unpacked cần tải gói mới và Reload trong chrome://extensions.`, "warn");
}

button.addEventListener("click", async () => {
  const downloadUrl = button.dataset.downloadUrl;
  if (downloadUrl) {
    chrome.tabs.create({ url: downloadUrl });
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
