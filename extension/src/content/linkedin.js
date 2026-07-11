// linkedin.js — LinkedIn Auto Post Liker for Profile Builder
// Likes posts from people whose headline matches keywords in config/linkedin-keywords.json
// Rate-limited to 6 likes per minute to avoid detection.
;(async () => {
  const LIKE_INTERVAL_MS = Math.ceil(60_000 / 6) // 10,000ms = 6/min

  let running = false
  let statusText = 'Ready.'
  let likeTimer = null
  let likedCount = 0
  const processedPosts = new WeakSet()
  const likeQueue = []
  let KEYWORDS = []

  async function loadKeywords() {
    try {
      const resp = await fetch(chrome.runtime.getURL('config/linkedin-keywords.json'))
      const data = await resp.json()
      KEYWORDS = (data.keywords || []).map(k => k.toLowerCase())
    } catch (e) {
      console.error('[ProfileBuilder/LinkedIn] Failed to load keywords:', e)
    }
  }

  function notify(text, isRunning = running) {
    statusText = text
    chrome.runtime.sendMessage({ type: 'STATUS', running: isRunning, text }).catch(() => {})
  }

  // Walk up from h2 "Feed post" to find the div that contains both
  // the control-menu button and the reaction button — that's the post root.
  function getPostRoot(h2) {
    let el = h2.parentElement
    for (let i = 0; i < 20; i++) {
      if (!el) break
      if (
        el.querySelector('button[aria-label^="Open control menu for post by"]') &&
        el.querySelector('button[aria-label^="Reaction button state:"]')
      ) return el
      el = el.parentElement
    }
    return null
  }

  // Extract the headline by walking text nodes.
  // The headline is the text node that appears immediately after the connection
  // degree badge ("• 1st", "• 2nd", "• 3rd", "• 3rd+").
  // Company/page posts have no degree badge → returns null → naturally excluded.
  function getHeadline(root) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
    const texts = []
    let node
    while ((node = walker.nextNode())) {
      const t = node.textContent?.trim()
      if (t && t.length > 2) texts.push(t)
    }
    const degIdx = texts.findIndex(t => /^•\s*[123]/.test(t))
    if (degIdx < 0) return null // company / page post
    const next = texts[degIdx + 1]
    // Timestamps look like "4m •", "2h •", "1w •" etc. — skip them.
    if (!next || /^\d+[smhdwy]/.test(next)) return null
    return next
  }

  function headlineMatches(headline) {
    if (!headline) return false
    const lower = headline.toLowerCase()
    return KEYWORDS.some(k => lower.includes(k))
  }

  function getLikeButton(root) {
    return root.querySelector('button[aria-label^="Reaction button state:"]')
  }

  function isAlreadyLiked(btn) {
    return btn?.getAttribute('aria-label') !== 'Reaction button state: no reaction'
  }

  function collectPosts() {
    const feedH2s = [...document.querySelectorAll('h2')]
      .filter(h => h.textContent?.trim() === 'Feed post')

    for (const h2 of feedH2s) {
      const root = getPostRoot(h2)
      if (!root || processedPosts.has(root)) continue
      processedPosts.add(root)

      const headline = getHeadline(root)
      if (!headlineMatches(headline)) continue

      const btn = getLikeButton(root)
      if (!btn || isAlreadyLiked(btn)) continue

      likeQueue.push({ btn, headline })
    }
  }

  function processNext() {
    if (!running) return

    collectPosts()

    if (likeQueue.length === 0) {
      // LinkedIn's search page scrolls an inner container, not window
      const feed = document.getElementById('workspace') ||
        document.querySelector('main[id]') ||
        document.scrollingElement
      if (feed) feed.scrollBy({ top: 800, behavior: 'smooth' })
      else window.scrollBy({ top: 800, behavior: 'smooth' })
      notify(`Liked ${likedCount}. Scrolling for more posts…`)
      likeTimer = setTimeout(processNext, LIKE_INTERVAL_MS)
      return
    }

    const { btn, headline } = likeQueue.shift()

    // Skip stale entries (DOM changed or already liked since we queued)
    if (!document.contains(btn) || isAlreadyLiked(btn)) {
      likeTimer = setTimeout(processNext, 500)
      return
    }

    // Scroll the button into view, then wait for the scroll to settle before clicking
    btn.scrollIntoView({ behavior: 'smooth', block: 'center' })
    setTimeout(() => {
      if (!running) return
      if (!document.contains(btn) || isAlreadyLiked(btn)) {
        likeTimer = setTimeout(processNext, 500)
        return
      }
      try {
        btn.click()
        likedCount++
        const preview = headline.length > 50 ? headline.slice(0, 50) + '…' : headline
        notify(`Liked ${likedCount} — "${preview}"`)
      } catch (e) {
        console.error('[ProfileBuilder/LinkedIn] Click error:', e)
      }
      likeTimer = setTimeout(processNext, LIKE_INTERVAL_MS)
    }, 600)
  }

  function start() {
    if (running) return { ok: true }
    if (KEYWORDS.length === 0) return { error: 'Keywords not loaded. Reload the page and try again.' }
    running = true
    likedCount = 0
    likeQueue.length = 0
    notify('Starting…', true)
    likeTimer = setTimeout(processNext, 300)
    return { ok: true }
  }

  function stop() {
    running = false
    clearTimeout(likeTimer)
    notify(`Stopped. Liked ${likedCount} posts this session.`, false)
    return { ok: true }
  }

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg.type === 'START') sendResponse(start())
    else if (msg.type === 'STOP') sendResponse(stop())
    else if (msg.type === 'GET_STATE') sendResponse({ running, statusText })
    return true
  })

  await loadKeywords()
  console.log(`[ProfileBuilder/LinkedIn] Loaded. ${KEYWORDS.length} keywords active.`)
})()
