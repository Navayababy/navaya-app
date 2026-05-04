import { useState, useRef, useEffect, useLayoutEffect } from 'react'
import { getNightMode, setNightMode, getActiveTimer, setActiveTimer, clearActiveTimer } from './lib/storage.js'
import HomeScreen    from './screens/HomeScreen.jsx'
import HistoryScreen from './screens/HistoryScreen.jsx'
import NappyScreen   from './screens/NappyScreen.jsx'
import ChatScreen    from './screens/ChatScreen.jsx'
import PrepareScreen from './screens/PrepareScreen.jsx'
import NavBar        from './components/NavBar.jsx'

function getViewportHeight() {
  if (typeof window === 'undefined') return null
  return Math.round(window.visualViewport?.height || window.innerHeight)
}

export default function App() {
  const [screen, setScreen] = useState('home')
  const [night, setNight]   = useState(() => getNightMode())
  const [viewportHeight, setViewportHeight] = useState(() => getViewportHeight())
  const initialTimer = useRef(getActiveTimer())

  // ── Feed timer state lives here so it survives tab changes ────────────────
  const [feedActive,    setFeedActive]    = useState(() => initialTimer.current !== null)
  const [feedSide,      setFeedSide]      = useState(() => initialTimer.current?.side || 'L')
  const [feedStartedAt, setFeedStartedAt] = useState(() => initialTimer.current?.startedAt || null)
  const [elapsed,       setElapsed]       = useState(() => {
    const saved = initialTimer.current
    if (!saved) return 0
    return Math.floor((Date.now() - saved.startedAt) / 1000)
  })
  const timerRef = useRef(null)

  useLayoutEffect(() => {
    let rafId = null

    const syncViewportHeight = () => {
      if (rafId !== null) window.cancelAnimationFrame(rafId)
      rafId = window.requestAnimationFrame(() => {
        setViewportHeight(getViewportHeight())
      })
    }

    syncViewportHeight()

    window.addEventListener('resize', syncViewportHeight)
    window.addEventListener('orientationchange', syncViewportHeight)
    window.addEventListener('pageshow', syncViewportHeight)
    document.addEventListener('visibilitychange', syncViewportHeight)
    window.visualViewport?.addEventListener('resize', syncViewportHeight)
    window.visualViewport?.addEventListener('scroll', syncViewportHeight)

    return () => {
      if (rafId !== null) window.cancelAnimationFrame(rafId)
      window.removeEventListener('resize', syncViewportHeight)
      window.removeEventListener('orientationchange', syncViewportHeight)
      window.removeEventListener('pageshow', syncViewportHeight)
      document.removeEventListener('visibilitychange', syncViewportHeight)
      window.visualViewport?.removeEventListener('resize', syncViewportHeight)
      window.visualViewport?.removeEventListener('scroll', syncViewportHeight)
    }
  }, [])

  useEffect(() => {
    if (feedActive && feedStartedAt) {
      timerRef.current = setInterval(() => {
        setElapsed(Math.floor((Date.now() - feedStartedAt) / 1000))
      }, 1000)
    } else {
      clearInterval(timerRef.current)
    }
    return () => clearInterval(timerRef.current)
  }, [feedActive, feedStartedAt])

  const startFeed = (side) => {
    const now = Date.now()
    setFeedSide(side)
    setFeedStartedAt(now)
    setElapsed(0)
    setFeedActive(true)
    setActiveTimer(side, now)
  }

  const stopFeed = () => {
    clearInterval(timerRef.current)
    setFeedActive(false)
    clearActiveTimer()
    return {
      side:         feedSide,
      startedAt:    new Date(feedStartedAt).toISOString(),
      endedAt:      new Date().toISOString(),
      durationSecs: elapsed,
    }
  }

  const toggleNight = () => {
    setNight(n => { setNightMode(!n); return !n })
  }

  const timerProps = { feedActive, feedSide, elapsed, startFeed, stopFeed }
  const bg = night ? '#1A1410' : '#F5F0EB'
  const appHeight = viewportHeight ? `${viewportHeight}px` : '100dvh'

  return (
    <div style={{
      maxWidth:      430,
      margin:        '0 auto',
      height:        appHeight,
      display:       'flex',
      flexDirection: 'column',
      background:    bg,
      overflow:      'hidden',
    }}>
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        {screen === 'home'    && <HomeScreen    night={night} onNightToggle={toggleNight} timer={timerProps} />}
        {screen === 'nappy'   && <NappyScreen   night={night} />}
        {screen === 'history' && <HistoryScreen night={night} />}
        {screen === 'chat'    && <ChatScreen    night={night} />}
        {screen === 'prepare' && <PrepareScreen night={night} />}
      </div>
      <NavBar screen={screen} setScreen={setScreen} night={night} feedActive={feedActive} />
    </div>
  )
}
