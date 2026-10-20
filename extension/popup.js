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
    button.textContent = `Updating ${result.version || "to the latest version"}…`;
    show("Chrome found a new Store version and is downloading it. The extension will reload to apply it.", "ok");
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
  if (!latestVersion) throw new Error("The release has no version number");
  if (compareVersions(latestVersion, currentVersion) <= 0) {
    button.textContent = `Up to date: v${currentVersion}`;
    button.disabled = true;
    show("You have the latest version on GitHub.", "ok");
    return;
  }
  button.dataset.latestVersion = latestVersion;
  button.textContent = `Update now to v${latestVersion}`;
  show(setupButton.hidden
    ? `Version ${latestVersion} is available. Click Update now to install it and reload.`
    : `Version ${latestVersion} is available. Set up NOTA Updater once, then click Update now.`, "warn");
}

async function runNativeUpdate() {
  const expectedVersion = button.dataset.latestVersion;
  button.disabled = true;
  button.textContent = `Updating to v${expectedVersion}…`;
  show("Downloading the release, verifying SHA256, and replacing extension files…");
  try {
    const response = await sendNative({ action: "update", expectedVersion });
    if (!response?.ok) throw new Error(response?.message || "The updater returned an error");
    const installedVersion = response.version || currentVersion;
    const runtimeIsStale = compareVersions(installedVersion, currentVersion) > 0;
    if (response.status === "updated" || runtimeIsStale) {
      button.textContent = `Loading v${installedVersion}…`;
      show(response.status === "updated"
        ? "Update complete. Loading the new extension version…"
        : `Version ${installedVersion} is already on disk. Reloading the extension to replace running version ${currentVersion}…`, "ok");
      setTimeout(() => chrome.runtime.reload(), 700);
      return;
    }
    button.textContent = `Up to date: v${installedVersion}`;
    show("You have the latest version.", "ok");
  } catch (error) {
    button.disabled = false;
    button.textContent = `Retry update to v${expectedVersion}`;
    setupButton.hidden = false;
    show(`NOTA Updater is unavailable: ${error.message}`, "err");
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
  button.textContent = "Checking…";
  show("Checking the Chrome Web Store and GitHub…");
  if (await requestStoreUpdate()) return;
  try {
    await checkGitHubRelease();
  } catch (error) {
    button.textContent = "Check again";
    show(`Could not check GitHub: ${error.message}`, "err");
  } finally {
    if (!button.textContent.startsWith("Up to date:") && !button.textContent.startsWith("Updating")) {
      button.disabled = false;
    }
  }
});

detectNativeUpdater();
