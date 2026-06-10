import { useState } from 'react'
import { getNightMode, setNightMode } from './lib/storage.js'
import { useViewportHeight } from './hooks/useViewportHeight.js'
import { useFeedTimer } from './hooks/useFeedTimer.js'
import { useHousehold } from './hooks/useHousehold.js'
import HomeScreen    from './screens/HomeScreen.jsx'
import HistoryScreen from './screens/HistoryScreen.jsx'
import NappyScreen   from './screens/NappyScreen.jsx'
import ChatScreen    from './screens/ChatScreen.jsx'
import PrepareScreen from './screens/PrepareScreen.jsx'
import SettingsScreen from './screens/SettingsScreen.jsx'
import NavBar        from './components/NavBar.jsx'

export default function App() {
  const [screen, setScreen] = useState('home')
  const [night, setNight]   = useState(() => getNightMode())
  // Chat history lives here so the conversation survives tab changes
  // (screens are conditionally rendered, so ChatScreen unmounts on navigation).
  const [chatMessages, setChatMessages] = useState([])

  const viewportHeight = useViewportHeight()
  const timerProps = useFeedTimer()
  const {
    authUser, profile, householdMembers, householdMembersError,
    sharedSessions, sharedNappies, sharedMedicines,
    loadHouseholdMembers, refreshProfile,
    refreshSharedSessions, refreshSharedNappies, refreshSharedMedicines,
    resyncAll,
  } = useHousehold()

  const toggleNight = () => {
    setNight(n => { setNightMode(!n); return !n })
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
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        {screen === 'home'    && <HomeScreen    night={night} onNightToggle={toggleNight} setScreen={setScreen} timer={timerProps} authUser={authUser} profile={profile} sharedSessions={sharedSessions} onSessionSaved={refreshSharedSessions} />}
        {screen === 'nappy'   && <NappyScreen   night={night} authUser={authUser} profile={profile} sharedNappies={sharedNappies} onNappySaved={refreshSharedNappies} />}
        {screen === 'history' && <HistoryScreen night={night} authUser={authUser} profile={profile} sharedSessions={sharedSessions} sharedNappies={sharedNappies} sharedMedicines={sharedMedicines} onRefreshSessions={refreshSharedSessions} onRefreshNappies={refreshSharedNappies} onRefreshMedicines={refreshSharedMedicines} />}
        {screen === 'chat'    && <ChatScreen    night={night} messages={chatMessages} setMessages={setChatMessages} />}
        {screen === 'prepare' && <PrepareScreen night={night} />}
        {screen === 'settings' && <SettingsScreen night={night} authUser={authUser} profile={profile} householdMembers={householdMembers} householdMembersError={householdMembersError} onProfileUpdate={refreshProfile} onRefreshHouseholdMembers={loadHouseholdMembers} onResync={resyncAll} />}
      </div>
      <NavBar screen={screen} setScreen={setScreen} night={night} feedActive={timerProps.feedActive} />
    </div>
  )
}
