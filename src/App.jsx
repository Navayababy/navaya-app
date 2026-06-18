import { useState, useEffect } from 'react'
import { getNightMode, setNightMode, hasNightPref, getNightHintSeen, setNightHintSeen, getDismissedAnnouncements, dismissAnnouncement } from './lib/storage.js'
import { getActiveAnnouncement } from './lib/db.js'
import { isSupabaseConfigured } from './lib/supabase.js'
import { useViewportHeight } from './hooks/useViewportHeight.js'
import { useFeedTimer } from './hooks/useFeedTimer.js'
import { useSleepTimer } from './hooks/useSleepTimer.js'
import { useHousehold } from './hooks/useHousehold.js'
import HomeScreen    from './screens/HomeScreen.jsx'
import HistoryScreen from './screens/HistoryScreen.jsx'
import NappyScreen   from './screens/NappyScreen.jsx'
import SleepScreen   from './screens/SleepScreen.jsx'
import ChatScreen    from './screens/ChatScreen.jsx'
import PrepareScreen from './screens/PrepareScreen.jsx'
import SettingsScreen from './screens/SettingsScreen.jsx'
import NavBar        from './components/NavBar.jsx'
import AnnouncementBanner from './components/AnnouncementBanner.jsx'
import { brand, palette } from './theme.js'

// Low-light hours — used only to auto-suggest night mode before the user has
// made an explicit choice. Deep evening through early morning.
const isAfterDark = () => {
  const h = new Date().getHours()
  return h >= 19 || h < 7
}

export default function App() {
  const [screen, setScreen] = useState('home')
  // Honour an explicit choice; otherwise ease into night mode after dark.
  const [night, setNight]   = useState(() => (hasNightPref() ? getNightMode() : isAfterDark()))
  // One-time gentle note the first time night mode is applied for them.
  const [nightHint, setNightHint] = useState(() => !hasNightPref() && isAfterDark() && !getNightHintSeen())
  // Chat history lives here so the conversation survives tab changes
  // (screens are conditionally rendered, so ChatScreen unmounts on navigation).
  const [chatMessages, setChatMessages] = useState([])
  const [announcement, setAnnouncement] = useState(null)

  // Fetch the live broadcast banner once on load. RLS only returns active,
  // in-window rows; we then suppress anything this device has dismissed.
  useEffect(() => {
    if (!isSupabaseConfigured) return
    let cancelled = false
    getActiveAnnouncement().then(({ data }) => {
      if (cancelled || !data) return
      if (getDismissedAnnouncements().includes(data.id)) return
      setAnnouncement(data)
    })
    return () => { cancelled = true }
  }, [])

  const dismissBanner = () => {
    if (announcement) dismissAnnouncement(announcement.id)
    setAnnouncement(null)
  }

  const viewportHeight = useViewportHeight()
  const timerProps = useFeedTimer()
  const sleepTimerProps = useSleepTimer()
  const {
    authUser, profile, householdMembers, householdMembersError,
    sharedSessions, sharedNappies, sharedMedicines, sharedSleeps,
    loadHouseholdMembers, refreshProfile,
    refreshSharedSessions, refreshSharedNappies, refreshSharedMedicines, refreshSharedSleeps,
    resyncAll,
  } = useHousehold()

  const toggleNight = () => {
    setNight(n => { setNightMode(!n); return !n })
    dismissNightHint()
  }

  const dismissNightHint = () => {
    if (nightHint) { setNightHintSeen(); setNightHint(false) }
  }

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
      {announcement && <AnnouncementBanner night={night} announcement={announcement} onDismiss={dismissBanner} />}
      {nightHint && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 14px', background: palette(night).card, borderBottom: `1px solid ${palette(night).navBdr}` }}>
          <span style={{ fontSize: 13, flexShrink: 0 }} aria-hidden="true">☽</span>
          <span style={{ flex: 1, fontSize: 12, color: palette(night).sub, lineHeight: 1.4 }}>
            Night mode is on for the evening. You can switch back anytime.
          </span>
          <button onClick={toggleNight}
            style={{ background: 'none', border: `1px solid ${palette(night).navBdr}`, borderRadius: 16, padding: '4px 10px', cursor: 'pointer', color: brand.sand, fontSize: 11, flexShrink: 0 }}>
            Use light
          </button>
          <button onClick={dismissNightHint} aria-label="Dismiss"
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: palette(night).sub, fontSize: 16, lineHeight: 1, flexShrink: 0 }}>
            ×
          </button>
        </div>
      )}
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        {screen === 'home'    && <HomeScreen    night={night} onNightToggle={toggleNight} setScreen={setScreen} timer={timerProps} sleepTimer={sleepTimerProps} authUser={authUser} profile={profile} sharedSessions={sharedSessions} sharedNappies={sharedNappies} sharedSleeps={sharedSleeps} onSessionSaved={refreshSharedSessions} onNappySaved={refreshSharedNappies} onSleepSaved={refreshSharedSleeps} />}
        {screen === 'nappy'   && <NappyScreen   night={night} authUser={authUser} profile={profile} sharedNappies={sharedNappies} onNappySaved={refreshSharedNappies} />}
        {screen === 'sleep'   && <SleepScreen   night={night} timer={sleepTimerProps} authUser={authUser} profile={profile} sharedSleeps={sharedSleeps} onSleepSaved={refreshSharedSleeps} />}
        {screen === 'history' && <HistoryScreen night={night} authUser={authUser} profile={profile} sharedSessions={sharedSessions} sharedNappies={sharedNappies} sharedMedicines={sharedMedicines} sharedSleeps={sharedSleeps} onRefreshSessions={refreshSharedSessions} onRefreshNappies={refreshSharedNappies} onRefreshMedicines={refreshSharedMedicines} onRefreshSleeps={refreshSharedSleeps} />}
        {screen === 'chat'    && <ChatScreen    night={night} messages={chatMessages} setMessages={setChatMessages} />}
        {screen === 'prepare' && <PrepareScreen night={night} setScreen={setScreen} />}
        {screen === 'settings' && <SettingsScreen night={night} authUser={authUser} profile={profile} householdMembers={householdMembers} householdMembersError={householdMembersError} onProfileUpdate={refreshProfile} onRefreshHouseholdMembers={loadHouseholdMembers} onResync={resyncAll} />}
      </div>
      <NavBar screen={screen} setScreen={setScreen} night={night} feedActive={timerProps.feedActive} sleepActive={sleepTimerProps.sleepActive} />
    </div>
  )
}
