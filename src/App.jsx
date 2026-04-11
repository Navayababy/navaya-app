import { useState, useRef, useEffect } from 'react'
import { getNightMode, setNightMode, getUserName, getActiveTimer, setActiveTimer, clearActiveTimer, getActiveSleep, setActiveSleep, clearActiveSleep } from './lib/storage.js'
import HomeScreen    from './screens/HomeScreen.jsx'
import HistoryScreen from './screens/HistoryScreen.jsx'
import ChatScreen    from './screens/ChatScreen.jsx'
import PrepareScreen from './screens/PrepareScreen.jsx'
import NavBar        from './components/NavBar.jsx'

export default function App() {
  const [screen, setScreen] = useState('home')
  const [night, setNight]   = useState(() => getNightMode())

  // ── Timer state lives here so it survives screen changes ──────────────────
  // Initialise from localStorage so the timer survives app close/reopen
  const [feedActive,    setFeedActive]    = useState(() => {
    const saved = getActiveTimer()
    return saved !== null
  })
  const [feedSide,      setFeedSide]      = useState(() => {
    const saved = getActiveTimer()
    return saved?.side || 'L'
  })
  const [feedStartedAt, setFeedStartedAt] = useState(() => {
    const saved = getActiveTimer()
    return saved?.startedAt || null
  })
  const [elapsed,       setElapsed]       = useState(() => {
    const saved = getActiveTimer()
    if (!saved) return 0
    return Math.floor((Date.now() - saved.startedAt) / 1000)
  })
  const timerRef = useRef(null)

  // Keep elapsed ticking whenever a feed is active
  useEffect(() => {
    if (feedActive && feedStartedAt) {
      timerRef.current = setInterval(() => {
        setElapsed(Math.floor((Date.now() - feedStartedAt) / 1000))
      }, 500)
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

  // ── Sleep / nap timer ─────────────────────────────────────────────────────
  const [sleepActive,    setSleepActive]    = useState(() => getActiveSleep() !== null)
  const [sleepStartedAt, setSleepStartedAt] = useState(() => getActiveSleep()?.startedAt || null)
  const [sleepElapsed,   setSleepElapsed]   = useState(() => {
    const saved = getActiveSleep()
    if (!saved) return 0
    return Math.floor((Date.now() - saved.startedAt) / 1000)
  })
  const sleepRef = useRef(null)

  useEffect(() => {
    if (sleepActive && sleepStartedAt) {
      sleepRef.current = setInterval(() => {
        setSleepElapsed(Math.floor((Date.now() - sleepStartedAt) / 1000))
      }, 500)
    } else {
      clearInterval(sleepRef.current)
    }
    return () => clearInterval(sleepRef.current)
  }, [sleepActive, sleepStartedAt])

  const startSleep = () => {
    const now = Date.now()
    setSleepStartedAt(now)
    setSleepElapsed(0)
    setSleepActive(true)
    setActiveSleep(now)
  }

  const stopSleep = () => {
    clearInterval(sleepRef.current)
    setSleepActive(false)
    clearActiveSleep()
    return {
      startedAt:    new Date(sleepStartedAt).toISOString(),
      endedAt:      new Date().toISOString(),
      durationSecs: sleepElapsed,
    }
  }

  const toggleNight = () => {
    setNight(n => { setNightMode(!n); return !n })
  }

  const timerProps      = { feedActive, feedSide, elapsed, startFeed, stopFeed }
  const sleepTimerProps = { sleepActive, sleepElapsed, startSleep, stopSleep }

  const bg = night ? '#1A1410' : '#F5F0EB'

  return (
    <div style={{
      maxWidth:      430,
      margin:        '0 auto',
      height:        '100dvh',
      display:       'flex',
      flexDirection: 'column',
      background:    bg,
      overflow:      'hidden',
    }}>
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        {screen === 'home'    && <HomeScreen    night={night} onNightToggle={toggleNight} timer={timerProps} sleepTimer={sleepTimerProps} />}
        {screen === 'history' && <HistoryScreen night={night} />}
        {screen === 'chat'    && <ChatScreen    night={night} />}
        {screen === 'prepare' && <PrepareScreen night={night} />}
      </div>
      <NavBar screen={screen} setScreen={setScreen} night={night} feedActive={feedActive || sleepActive} />
    </div>
  )
}
