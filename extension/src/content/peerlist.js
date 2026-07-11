// Profile Builder — Peerlist auto-upvote content script.
// Lives in the page, so the loop keeps running even when the popup is closed.
(() => {
  if (window.__profileBuilderLoaded) return; // avoid double-injection
  window.__profileBuilderLoaded = true;

  const state = {
    running: false,
    stopRequested: false,
    statusText: "Ready.",
    upvoted: [],
    count: 0,
  };

  // ---- status reporting -----------------------------------------------------
  function setStatus(text, running = state.running) {
    state.statusText = text;
    state.running = running;
    try {
      chrome.runtime.sendMessage({ type: "STATUS", text, running });
    } catch (e) {
      // Popup is closed — ignore.
    }
  }

  // ---- timing helpers (Web Worker timer survives backgrounded tabs) ----------
  const worker = new Worker(
    URL.createObjectURL(
      new Blob(
        ["onmessage=e=>{const{id,delay}=e.data;setTimeout(()=>postMessage(id),delay)}"],
        { type: "application/javascript" }
      )
    )
  );
  let _sid = 0;
  const _pending = new Map();
  worker.onmessage = (e) => {
    const r = _pending.get(e.data);
    if (r) {
      _pending.delete(e.data);
      r();
    }
  };
  const sleep = (ms) =>
    new Promise((r) => {
      const id = ++_sid;
      _pending.set(id, r);
      worker.postMessage({ id, delay: ms });
    });

  const rand = (a, b) => a + Math.random() * (b - a);
  const waitFor = async (fn, timeout = 8000, interval = 100) => {
    const t0 = Date.now();
    while (Date.now() - t0 < timeout) {
      const v = fn();
      if (v) return v;
      await sleep(interval);
    }
    return null;
  };

  // ---- Peerlist DOM accessors ----------------------------------------------
  const getModal = () => document.querySelector('#portal [role="dialog"]');
  const getUpvoteBtn = () => getModal()?.querySelector('button[label="upvote button"]');
  const getUpvoteCount = () => {
    const btn = getUpvoteBtn();
    if (!btn) return NaN;
    const el = btn.querySelector("number-flow-react");
    return el ? parseInt(el.getAttribute("aria-label"), 10) : NaN;
  };
  const isAlreadyUpvoted = () => {
    const btn = getUpvoteBtn();
    if (!btn) return false;
    return /\bUpvoted\b/.test(btn.textContent || "");
  };
  const getNextLink = () => document.querySelector('a[data-for^="next-project-name"]');
  const getModalScroller = () => getModal()?.querySelector(".overflow-y-scroll");

  const findDevLink = () => {
    const modal = getModal();
    if (!modal) return null;
    const isProfileHref = (a) => {
      const h = a.getAttribute("href") || "";
      return h.startsWith("/") && !h.includes("/project/") && !h.includes("/launchpad") && h !== "/";
    };
    let link = [...modal.querySelectorAll('a[type="button"][href^="/"]')].find(
      (a) => isProfileHref(a) && !!a.querySelector("p")
    );
    if (link) return link;
    for (const a of modal.querySelectorAll('.min-h-6 a[href^="/"]')) {
      if (isProfileHref(a)) return a;
    }
    return null;
  };

  const extractFromModal = async () => {
    const modal = getModal();
    if (!modal) return null;
    const h1 = modal.querySelector("h1");
    const productName = h1 ? h1.textContent.trim() : "";
    const link = await waitFor(findDevLink, 3000);
    let devName = "",
      devUrl = "";
    if (link) {
      const p = link.querySelector("p.font-semibold") || link.querySelector("p");
      devName = p ? p.textContent.trim() : "";
      devUrl = "https://peerlist.io" + link.getAttribute("href");
    }
    return { productName, devName, devUrl };
  };

  const humanScroll = async (durationMs) => {
    const t0 = Date.now();
    while (Date.now() - t0 < durationMs) {
      if (state.stopRequested) return;
      const sc = getModalScroller();
      if (sc) {
        const max = sc.scrollHeight - sc.clientHeight;
        const dir = Math.random() < 0.7 ? 1 : -1;
        const step = (60 + Math.random() * 220) * dir;
        sc.scrollTo({ top: Math.max(0, Math.min(max, sc.scrollTop + step)), behavior: "auto" });
      }
      await sleep(400 + Math.random() * 800);
    }
  };

  // ---- CSV export -----------------------------------------------------------
  function exportCSV() {
    if (!state.upvoted.length) {
      setStatus(`Stopped. No items upvoted — nothing to export.`, false);
      return;
    }
    const esc = (v) => {
      const s = String(v ?? "");
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const headers = ["index", "product", "developer_name", "developer_url", "upvotes_before", "upvotes_after"];
    const rows = [headers, ...state.upvoted.map((r) => headers.map((h) => r[h]))];
    const csv = rows.map((row) => row.map(esc).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "peerlist_upvoted.csv";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setStatus(`Stopped. Exported ${state.upvoted.length} upvoted launches to CSV.`, false);
  }

  // ---- main loop ------------------------------------------------------------
  async function runLoop() {
    state.running = true;
    state.stopRequested = false;
    state.upvoted = [];
    state.count = 0;

    if (!(await waitFor(getModal, 5000))) {
      setStatus("No project popup is open. Open a launch project first.", false);
      state.running = false;
      return;
    }
    await waitFor(() => getModal()?.querySelector("h1"), 5000);

    let i = 0;
    while (true) {
      if (state.stopRequested) break;
      i++;
      state.count = i;

      const info = await extractFromModal();
      setStatus(
        `[#${i}] ${info?.productName || "(unknown)"} — by ${info?.devName || "?"} · ${state.upvoted.length} upvoted`,
        true
      );

      const btn = getUpvoteBtn();
      if (!btn) {
        setStatus(`Stopped — no upvote button found. ${state.upvoted.length} upvoted.`, false);
        break;
      }

      await sleep(2000);

      let skipWait = false;
      if (isAlreadyUpvoted()) {
        skipWait = true;
      } else {
        const before = getUpvoteCount();
        btn.click();
        await sleep(1000);
        const after = getUpvoteCount();
        if (Number.isFinite(before) && Number.isFinite(after) && after === before + 1) {
          state.upvoted.push({
            index: i,
            product: info?.productName || "",
            developer_name: info?.devName || "",
            developer_url: info?.devUrl || "",
            upvotes_before: before,
            upvotes_after: after,
          });
        }
      }

      if (!skipWait) {
        const wait = rand(1000, 30000);
        setStatus(
          `[#${i}] ${info?.productName || ""} · waiting ${(wait / 1000).toFixed(1)}s · ${state.upvoted.length} upvoted`,
          true
        );
        await humanScroll(wait);
      }
      if (state.stopRequested) break;

      const next = getNextLink();
      if (!next) {
        setStatus(`Reached end of list. ${state.upvoted.length} upvoted. Exporting CSV…`, false);
        exportCSV();
        state.running = false;
        return;
      }
      const prevName = info?.productName || "";
      next.click();
      const ok = await waitFor(() => {
        const h = getModal()?.querySelector("h1");
        return h && h.textContent.trim() !== prevName;
      }, 10000);
      if (!ok) {
        setStatus(`Next item didn't load. Stopping. ${state.upvoted.length} upvoted.`, false);
        break;
      }
      await sleep(500);
    }

    // Stopped (by user or breaking condition) — export what we have.
    state.running = false;
    exportCSV();
  }

  // ---- message handling -----------------------------------------------------
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (!msg) return;
    if (msg.type === "GET_STATE") {
      sendResponse({ running: state.running, statusText: state.statusText });
      return;
    }
    if (msg.type === "START") {
      if (state.running) {
        sendResponse({ error: "Already running." });
        return;
      }
      runLoop();
      sendResponse({ ok: true });
      return;
    }
    if (msg.type === "STOP") {
      state.stopRequested = true;
      setStatus("Stopping…", true);
      sendResponse({ ok: true });
      return;
    }
  });
})();
