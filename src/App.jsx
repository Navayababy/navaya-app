import { useState } from 'react'
import { getNightMode, setNightMode } from './lib/storage.js'
import HomeScreen    from './screens/HomeScreen.jsx'
import HistoryScreen from './screens/HistoryScreen.jsx'
import ChatScreen    from './screens/ChatScreen.jsx'
import PrepareScreen from './screens/PrepareScreen.jsx'
import NavBar        from './components/NavBar.jsx'

export default function App() {
  const [screen, setScreen] = useState('home')
  const [night, setNight]   = useState(() => getNightMode())

  const toggleNight = () => {
    setNight(n => {
      setNightMode(!n)
      return !n
    })
  }

  const bg = night ? '#1A1410' : '#F5F0EB'

  return (
    <div style={{
      maxWidth:        430,
      margin:          '0 auto',
      height:          '100dvh',
      display:         'flex',
      flexDirection:   'column',
      background:      bg,
      position:        'relative',
      overflow:        'hidden',
    }}>

      {/* Main screen area */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        {screen === 'home'    && <HomeScreen    night={night} onNightToggle={toggleNight} />}
        {screen === 'history' && <HistoryScreen night={night} />}
        {screen === 'chat'    && <ChatScreen    night={night} />}
        {screen === 'prepare' && <PrepareScreen night={night} />}
      </div>

      {/* Bottom navigation */}
      <NavBar screen={screen} setScreen={setScreen} night={night} />

    </div>
  )
}
