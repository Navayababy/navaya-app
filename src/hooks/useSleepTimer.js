import { useState, useRef, useEffect } from 'react'
import { getActiveSleep, setActiveSleep, clearActiveSleep } from '../lib/storage.js'

// Sleep timer state. Lives above the screens so the timer survives tab
// changes, and is persisted to localStorage so it survives reloads.
export function useSleepTimer() {
  const initialSleep = useRef(getActiveSleep())

  const [sleepActive,    setSleepActive]    = useState(() => initialSleep.current !== null)
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

  const startSleep = () => {
    const now = Date.now()
    setSleepStartedAt(now)
    setSleepElapsed(0)
    setSleepActive(true)
    setActiveSleep(now)
  }

  const stopSleep = () => {
    clearInterval(timerRef.current)
    setSleepActive(false)
    clearActiveSleep()
    const endedAt = Date.now()
    return {
      startedAt:    new Date(sleepStartedAt).toISOString(),
      endedAt:      new Date(endedAt).toISOString(),
      durationSecs: Math.max(0, Math.round((endedAt - sleepStartedAt) / 1000)),
    }
  }

  return { sleepActive, sleepElapsed, startSleep, stopSleep }
}
