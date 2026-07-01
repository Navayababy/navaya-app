import { useState, useRef, useEffect, useCallback } from 'react'
import { getActiveSleep, setActiveSleep, clearActiveSleep } from '../lib/storage.js'
import { newId } from '../lib/id.js'

// Sleep timer state. Lives above the screens so the timer survives tab
// changes, and is persisted to localStorage so it survives reloads. The
// tracked `id` is what makes cross-device sync possible: SleepScreen writes
// it to the shared sleep_logs row on start, and uses it to recognise when a
// household member's realtime update is about the same sleep it's tracking.
export function useSleepTimer() {
  const initialSleep = useRef(getActiveSleep())

  const [sleepActive,    setSleepActive]    = useState(() => initialSleep.current !== null)
  // Older saved records predate the id field — synthesise one rather than
  // leave this sleep unable to receive remote updates.
  const [sleepId,        setSleepId]        = useState(() => initialSleep.current ? (initialSleep.current.id || newId()) : null)
  const [sleepStartedAt, setSleepStartedAt] = useState(() => initialSleep.current?.startedAt || null)
  const [sleepElapsed,   setSleepElapsed]   = useState(() => {
    const saved = initialSleep.current
    if (!saved) return 0
    return Math.floor((Date.now() - saved.startedAt) / 1000)
  })
  const timerRef = useRef(null)
  const startedAtRef = useRef(sleepStartedAt)
  startedAtRef.current = sleepStartedAt

  useEffect(() => {
    if (sleepActive) {
      timerRef.current = setInterval(() => {
        setSleepElapsed(Math.floor((Date.now() - startedAtRef.current) / 1000))
      }, 1000)
    } else {
      clearInterval(timerRef.current)
    }
    return () => clearInterval(timerRef.current)
  }, [sleepActive])

  // Stable identities (via useCallback) so effects elsewhere that adopt or
  // release a shared sleep can list these in their dependency array without
  // re-firing on every unrelated re-render.
  const startSleep = useCallback(() => {
    const id = newId()
    const now = Date.now()
    setSleepId(id)
    setSleepStartedAt(now)
    setSleepElapsed(0)
    setSleepActive(true)
    setActiveSleep(id, now)
    return { id, startedAt: now }
  }, [])

  const stopSleep = useCallback(() => {
    clearInterval(timerRef.current)
    setSleepActive(false)
    clearActiveSleep()
    const endedAt = Date.now()
    return {
      id:           sleepId,
      startedAt:    new Date(sleepStartedAt).toISOString(),
      endedAt:      new Date(endedAt).toISOString(),
      durationSecs: Math.max(0, Math.round((endedAt - sleepStartedAt) / 1000)),
    }
  }, [sleepId, sleepStartedAt])

  // A household member started a sleep on another device — mirror it here
  // so this device's timer reflects it too, without treating it as a fresh
  // start of our own.
  const adoptActiveSleep = useCallback((id, startedAtMs) => {
    setSleepId(id)
    setSleepStartedAt(startedAtMs)
    setSleepElapsed(Math.floor((Date.now() - startedAtMs) / 1000))
    setSleepActive(true)
    setActiveSleep(id, startedAtMs)
  }, [])

  // A household member ended the shared sleep before we did — drop out of
  // the active view locally without starting our own confirm flow.
  const releaseActiveSleep = useCallback(() => {
    clearInterval(timerRef.current)
    setSleepActive(false)
    setSleepId(null)
    clearActiveSleep()
  }, [])

  return { sleepActive, sleepElapsed, sleepId, startSleep, stopSleep, adoptActiveSleep, releaseActiveSleep }
}
