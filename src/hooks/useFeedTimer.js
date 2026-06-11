import { useState, useRef, useEffect } from 'react'
import { getActiveTimer, setActiveTimer, clearActiveTimer } from '../lib/storage.js'

// Feed timer state. Lives above the screens so the timer survives tab
// changes, and is persisted to localStorage so it survives reloads.
export function useFeedTimer() {
  const initialTimer = useRef(getActiveTimer())

  const [feedActive,    setFeedActive]    = useState(() => initialTimer.current !== null)
  const [feedSide,      setFeedSide]      = useState(() => initialTimer.current?.side || 'L')
  // Timers persisted before bottle feeds existed have no feedType — breast.
  const [feedType,      setFeedType]      = useState(() => initialTimer.current?.feedType || 'breast')
  const [feedStartedAt, setFeedStartedAt] = useState(() => initialTimer.current?.startedAt || null)
  const [elapsed,       setElapsed]       = useState(() => {
    const saved = initialTimer.current
    if (!saved) return 0
    return Math.floor((Date.now() - saved.startedAt) / 1000)
  })
  const timerRef = useRef(null)
  const feedStartedAtRef = useRef(feedStartedAt)
  feedStartedAtRef.current = feedStartedAt

  // feedStartedAt is read via ref inside the interval to avoid restarting on every tick.
  useEffect(() => {
    if (feedActive) {
      timerRef.current = setInterval(() => {
        setElapsed(Math.floor((Date.now() - feedStartedAtRef.current) / 1000))
      }, 1000)
    } else {
      clearInterval(timerRef.current)
    }
    return () => clearInterval(timerRef.current)
  }, [feedActive])

  // Bottle feeds start with startFeed(null, 'bottle') — no side.
  const startFeed = (side, type = 'breast') => {
    const now = Date.now()
    setFeedSide(side)
    setFeedType(type)
    setFeedStartedAt(now)
    setElapsed(0)
    setFeedActive(true)
    setActiveTimer(side, now, type)
  }

  const stopFeed = () => {
    clearInterval(timerRef.current)
    setFeedActive(false)
    clearActiveTimer()
    // Duration is derived from the timestamps, not the ticking elapsed state,
    // which can lag behind when the tab has been backgrounded.
    const endedAt = Date.now()
    return {
      feedType,
      side:         feedType === 'bottle' ? null : feedSide,
      startedAt:    new Date(feedStartedAt).toISOString(),
      endedAt:      new Date(endedAt).toISOString(),
      durationSecs: Math.max(0, Math.round((endedAt - feedStartedAt) / 1000)),
    }
  }

  return { feedActive, feedSide, feedType, elapsed, startFeed, stopFeed }
}
