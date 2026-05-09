/*
  Peerlist Launchpad upvoter — paste into DevTools console while a project
  popup is already open. The script:
    1. Reads name + developer info from the current popup
    2. Upvotes it (verifies via count delta)
    3. Waits a random 1–30s, gently scrolling the popup
    4. Clicks the "Next" arrow → next project popup loads
    5. Repeats

  Logged-in tab assumed. To stop early: window.__stopUpvote = true
  Output: peerlist_upvoted.csv
*/
(async () => {
  // Web Worker timer so the loop survives backgrounded tabs.
  const worker = new Worker(URL.createObjectURL(new Blob(
    [`onmessage=e=>{const{id,delay}=e.data;setTimeout(()=>postMessage(id),delay)}`],
    { type: 'application/javascript' })));
  let _sid = 0; const _pending = new Map();
  worker.onmessage = e => { const r = _pending.get(e.data); if (r) { _pending.delete(e.data); r(); } };
  const sleep = ms => new Promise(r => { const id = ++_sid; _pending.set(id, r); worker.postMessage({ id, delay: ms }); });

  const rand = (a, b) => a + Math.random() * (b - a);
  const waitFor = async (fn, timeout = 8000, interval = 100) => {
    const t0 = Date.now();
    while (Date.now() - t0 < timeout) {
      const v = fn(); if (v) return v;
      await sleep(interval);
    }
    return null;
  };

  const getModal = () => document.querySelector('#portal [role="dialog"]');
  const getUpvoteBtn = () => getModal()?.querySelector('button[label="upvote button"]');
  const getUpvoteCount = () => {
    const btn = getUpvoteBtn(); if (!btn) return NaN;
    const el = btn.querySelector('number-flow-react');
    return el ? parseInt(el.getAttribute('aria-label'), 10) : NaN;
  };
  const getNextLink = () => document.querySelector('a[data-for^="next-project-name"]');
  const getModalScroller = () => getModal()?.querySelector('.overflow-y-scroll');

  const extractFromModal = () => {
    const modal = getModal(); if (!modal) return null;
    const h1 = modal.querySelector('h1');
    const productName = h1 ? h1.textContent.trim() : '';
    const link = [...modal.querySelectorAll('a[type="button"][href^="/"]')].find(a => {
      const href = a.getAttribute('href') || '';
      if (href.includes('/project/') || href.includes('/launchpad') || href === '/') return false;
      return !!a.querySelector('p');
    });
    let devName = '', devUrl = '';
    if (link) {
      const p = link.querySelector('p.font-semibold') || link.querySelector('p');
      devName = p ? p.textContent.trim() : '';
      devUrl = 'https://peerlist.io' + link.getAttribute('href');
    }
    return { productName, devName, devUrl };
  };

  // Periodically scroll the popup content so it looks like a human is reading.
  const humanScroll = async durationMs => {
    const t0 = Date.now();
    while (Date.now() - t0 < durationMs) {
      if (window.__stopUpvote) return;
      const sc = getModalScroller();
      if (sc) {
        const max = sc.scrollHeight - sc.clientHeight;
        const dir = Math.random() < 0.7 ? 1 : -1;
        const step = (60 + Math.random() * 220) * dir;
        sc.scrollTo({ top: Math.max(0, Math.min(max, sc.scrollTop + step)), behavior: 'auto' });
      }
      await sleep(400 + Math.random() * 800);
    }
  };

  if (!await waitFor(getModal, 5000)) {
    console.error('No project popup is open. Open one first, then run the script.');
    return;
  }
  await waitFor(() => getModal()?.querySelector('h1'), 5000);

  const upvoted = [];
  window.__stopUpvote = false;
  let i = 0;

  while (true) {
    if (window.__stopUpvote) { console.log('Stopped by user.'); break; }
    i++;

    const info = extractFromModal();
    if (!info?.productName) {
      console.warn(`#${i}: couldn't read product info`);
    } else {
      console.log(`[#${i}] ${info.productName} — by ${info.devName || '?'}`);
    }

    const before = getUpvoteCount();
    const btn = getUpvoteBtn();
    if (!btn) {
      console.warn(`  no upvote button found, stopping`);
      break;
    }
    btn.click();
    await sleep(1000);
    const after = getUpvoteCount();

    if (Number.isFinite(before) && Number.isFinite(after) && after === before + 1) {
      upvoted.push({
        index: i,
        product: info?.productName || '',
        developer_name: info?.devName || '',
        developer_url: info?.devUrl || '',
        upvotes_before: before,
        upvotes_after: after,
      });
      console.log(`  ✔ upvoted (${before} → ${after})`);
    } else if (Number.isFinite(before) && Number.isFinite(after) && after === before - 1) {
      console.log(`  ↶ already upvoted, restoring`);
      btn.click();
      await sleep(700);
    } else {
      console.warn(`  ✗ no count change (${before} → ${after})`);
    }

    const wait = rand(1000, 30000);
    console.log(`  waiting ${(wait / 1000).toFixed(1)}s before next`);
    await humanScroll(wait);
    if (window.__stopUpvote) { console.log('Stopped.'); break; }

    const next = getNextLink();
    if (!next) {
      console.log('No "Next" link — reached end of list.');
      break;
    }
    const prevName = info?.productName || '';
    next.click();

    // Wait for the modal content to change (new h1 text).
    const ok = await waitFor(() => {
      const h = getModal()?.querySelector('h1');
      return h && h.textContent.trim() !== prevName;
    }, 10000);
    if (!ok) { console.warn('Next item didn\'t load in time, stopping.'); break; }
    await sleep(500);
  }

  if (!upvoted.length) { console.log('No items upvoted; nothing to download.'); return; }
  const esc = v => { const s = String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const headers = ['index', 'product', 'developer_name', 'developer_url', 'upvotes_before', 'upvotes_after'];
  const rows = [headers, ...upvoted.map(r => headers.map(h => r[h]))];
  const csv = rows.map(row => row.map(esc).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'peerlist_upvoted.csv';
  document.body.appendChild(a); a.click(); a.remove();
  console.log(`Saved ${upvoted.length} upvoted launches to peerlist_upvoted.csv`);
})();
