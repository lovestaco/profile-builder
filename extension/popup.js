// Platform / capability registry. Add new platforms here.
const PLATFORMS = {
  peerlist: {
    capability: {
      title: "Auto Upvote Launch",
      desc: "Open any launch project on Peerlist, then click Start. It upvotes each project and clicks Next, pausing like a human. Stop exports a CSV of everything upvoted.",
      hint: "Tip: open a project popup first, e.g. from the weekly launchpad list.",
      urlMatch: /^https:\/\/peerlist\.io\//,
      urlHint: "Open peerlist.io and a launch project, then reopen this popup.",
    },
  },
};

const els = {
  platform: document.getElementById("platform"),
  capability: document.getElementById("capability"),
  title: document.getElementById("cap-title"),
  desc: document.getElementById("cap-desc"),
  hint: document.getElementById("hint"),
  start: document.getElementById("start"),
  stop: document.getElementById("stop"),
  status: document.getElementById("status"),
};

let activeTabId = null;
let currentUrl = "";

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

function setStatus(text, kind = "") {
  els.status.textContent = text || "";
  els.status.className = "status" + (kind ? " " + kind : "");
}

function setRunning(running) {
  els.start.disabled = running;
  els.stop.disabled = !running;
}

async function sendToContent(message) {
  if (activeTabId == null) throw new Error("No active tab");
  return chrome.tabs.sendMessage(activeTabId, message);
}

function renderCapability(platformKey) {
  const platform = PLATFORMS[platformKey];
  if (!platform) {
    els.capability.classList.add("hidden");
    return;
  }
  const cap = platform.capability;
  els.title.textContent = cap.title;
  els.desc.textContent = cap.desc;
  els.hint.textContent = cap.hint || "";
  els.capability.classList.remove("hidden");

  if (cap.urlMatch && !cap.urlMatch.test(currentUrl)) {
    setStatus(cap.urlHint || "Open the platform's site first.", "error");
    els.start.disabled = true;
    els.stop.disabled = true;
    return;
  }

  // On the right site: ask content script for current state.
  refreshState();
}

async function refreshState() {
  try {
    const state = await sendToContent({ type: "GET_STATE" });
    if (state && state.running) {
      setRunning(true);
      setStatus(state.statusText || "Running…", "running");
    } else {
      setRunning(false);
      setStatus(state && state.statusText ? state.statusText : "Ready.");
    }
  } catch (e) {
    // Content script not present (page not loaded with extension yet).
    setRunning(false);
    setStatus("Reload the Peerlist tab if buttons don't respond.", "error");
  }
}

els.platform.addEventListener("change", async () => {
  const key = els.platform.value;
  await chrome.storage.local.set({ lastPlatform: key });
  renderCapability(key);
});

els.start.addEventListener("click", async () => {
  setRunning(true);
  setStatus("Starting…", "running");
  try {
    const res = await sendToContent({ type: "START" });
    if (res && res.error) {
      setRunning(false);
      setStatus(res.error, "error");
    } else {
      setStatus("Running…", "running");
    }
  } catch (e) {
    setRunning(false);
    setStatus("Couldn't reach the page. Reload the Peerlist tab.", "error");
  }
});

els.stop.addEventListener("click", async () => {
  setStatus("Stopping & exporting CSV…");
  try {
    await sendToContent({ type: "STOP" });
  } catch (e) {
    setStatus("Couldn't reach the page.", "error");
  }
  setRunning(false);
});

// Live status updates pushed from the content script.
chrome.runtime.onMessage.addListener((msg) => {
  if (msg && msg.type === "STATUS") {
    const running = !!msg.running;
    setRunning(running);
    setStatus(msg.text || "", running ? "running" : "");
  }
});

(async function init() {
  const tab = await getActiveTab();
  activeTabId = tab ? tab.id : null;
  currentUrl = tab ? tab.url || "" : "";

  const { lastPlatform } = await chrome.storage.local.get("lastPlatform");
  if (lastPlatform && PLATFORMS[lastPlatform]) {
    els.platform.value = lastPlatform;
    renderCapability(lastPlatform);
  }
})();
