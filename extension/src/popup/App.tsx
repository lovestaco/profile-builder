import { useState, useEffect, useCallback } from 'react'
import { PLATFORMS } from './platforms'

type StatusKind = '' | 'running' | 'error'

interface Status {
  text: string
  kind: StatusKind
}

export default function App() {
  const [platformKey, setPlatformKey] = useState('')
  const [tabId, setTabId] = useState<number | null>(null)
  const [tabUrl, setTabUrl] = useState('')
  const [running, setRunning] = useState(false)
  const [status, setStatus] = useState<Status>({ text: '', kind: '' })

  const platform = PLATFORMS[platformKey]
  const cap = platform?.capability
  const onRightSite = cap ? cap.urlMatch.test(tabUrl) : false

  const send = useCallback(
    async (msg: { type: string }) => {
      if (tabId == null) throw new Error('No active tab')
      return chrome.tabs.sendMessage(tabId, msg)
    },
    [tabId]
  )

  const refreshState = useCallback(async () => {
    try {
      const state = await send({ type: 'GET_STATE' })
      if (state?.running) {
        setRunning(true)
        setStatus({ text: state.statusText || 'Running…', kind: 'running' })
      } else {
        setRunning(false)
        setStatus({ text: state?.statusText || 'Ready.', kind: '' })
      }
    } catch {
      setRunning(false)
      setStatus({ text: "Reload the tab if buttons don't respond.", kind: 'error' })
    }
  }, [send])

  useEffect(() => {
    chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
      setTabId(tab?.id ?? null)
      setTabUrl(tab?.url ?? '')
    })
    chrome.storage.local.get('lastPlatform', ({ lastPlatform }) => {
      if (lastPlatform && PLATFORMS[lastPlatform]) setPlatformKey(lastPlatform)
    })
  }, [])

  useEffect(() => {
    if (!platformKey || !onRightSite || platform?.comingSoon) return
    refreshState()
  }, [platformKey, onRightSite, platform, refreshState])

  useEffect(() => {
    const handler = (msg: { type?: string; running?: boolean; text?: string }) => {
      if (msg?.type !== 'STATUS') return
      const isRunning = !!msg.running
      setRunning(isRunning)
      setStatus({ text: msg.text || '', kind: isRunning ? 'running' : '' })
    }
    chrome.runtime.onMessage.addListener(handler)
    return () => chrome.runtime.onMessage.removeListener(handler)
  }, [])

  const handlePlatformChange = (key: string) => {
    setPlatformKey(key)
    chrome.storage.local.set({ lastPlatform: key })
    setStatus({ text: '', kind: '' })
    setRunning(false)
  }

  const handleStart = async () => {
    setRunning(true)
    setStatus({ text: 'Starting…', kind: 'running' })
    try {
      const res = await send({ type: 'START' })
      if (res?.error) {
        setRunning(false)
        setStatus({ text: res.error, kind: 'error' })
      } else {
        setStatus({ text: 'Running…', kind: 'running' })
      }
    } catch {
      setRunning(false)
      setStatus({ text: "Couldn't reach the page. Reload the tab.", kind: 'error' })
    }
  }

  const handleStop = async () => {
    setStatus({ text: 'Stopping & exporting CSV…', kind: '' })
    try {
      await send({ type: 'STOP' })
    } catch {
      setStatus({ text: "Couldn't reach the page.", kind: 'error' })
    }
    setRunning(false)
  }

  return (
    <>
      <h1>
        <span className="dot" />
        Profile Builder
      </h1>

      <label htmlFor="platform">Platform</label>
      <select id="platform" value={platformKey} onChange={(e) => handlePlatformChange(e.target.value)}>
        <option value="">Select a platform…</option>
        {Object.entries(PLATFORMS).map(([key, p]) => (
          <option key={key} value={key} disabled={p.comingSoon}>
            {p.label}
            {p.comingSoon ? ' (coming soon)' : ''}
          </option>
        ))}
      </select>

      {platform?.comingSoon && (
        <div className="capability">
          <h2>{platform.label}</h2>
          <p>This platform is coming soon.</p>
        </div>
      )}

      {platform && !platform.comingSoon && cap && (
        <div className="capability">
          <h2>{cap.title}</h2>
          <p>{cap.desc}</p>
          {!onRightSite ? (
            <div className="status error">{cap.urlHint}</div>
          ) : (
            <>
              <div className="btns">
                <button className="start" disabled={running} onClick={handleStart}>
                  Start
                </button>
                <button className="stop" disabled={!running} onClick={handleStop}>
                  Stop &amp; Export CSV
                </button>
              </div>
              {status.text && (
                <div className={['status', status.kind].filter(Boolean).join(' ')}>{status.text}</div>
              )}
            </>
          )}
          {cap.hint && <div className="hint">{cap.hint}</div>}
        </div>
      )}
    </>
  )
}
