import { palette } from '../theme.js'

// Prepare is reached from the Home screen card rather than the nav bar —
// it's a before-you-go-out task, not a many-times-a-day one like these five.
const tabs = [
  { id: 'home',    icon: '◉', label: 'Feed'    },
  { id: 'nappy',   icon: '◈', label: 'Nappy'   },
  { id: 'sleep',   icon: '☾', label: 'Sleep'   },
  { id: 'history', icon: '≡', label: 'Logbook' },
  { id: 'chat',    icon: '✦', label: 'Sage'    },
]

export default function NavBar({ screen, setScreen, night, feedActive, sleepActive }) {
  const p = palette(night)

  return (
    <nav style={{
      display:       'flex',
      background:    p.navBg,
      borderTop:     `1px solid ${p.navBdr}`,
      paddingTop:    8,
      paddingBottom: 'env(safe-area-inset-bottom, 10px)',
      flexShrink:    0,
    }}>
      {tabs.map(tab => {
        const active  = screen === tab.id
        const showDot = (tab.id === 'home' && feedActive && !active)
          || (tab.id === 'sleep' && sleepActive && !active)
        return (
          <button
            key={tab.id}
            onClick={() => setScreen(tab.id)}
            style={{
              flex:           1,
              background:     'none',
              border:         'none',
              cursor:         'pointer',
              display:        'flex',
              flexDirection:  'column',
              alignItems:     'center',
              gap:            3,
              padding:        '4px 0 6px',
              WebkitTapHighlightColor: 'transparent',
              position:       'relative',
            }}
          >
            <span style={{ fontSize: 17, color: active ? p.navActive : p.sub, transition: 'color .2s', lineHeight: 1 }}>
              {tab.icon}
            </span>
            <span style={{ fontSize: 9, fontWeight: active ? 600 : 400, color: active ? p.navActive : p.sub, letterSpacing: '.02em', fontFamily: "'DM Sans', sans-serif", lineHeight: 1 }}>
              {tab.label}
            </span>
            {/* Live indicator dot — shows when a feed or sleep is running on another screen */}
            {showDot && (
              <span style={{ position: 'absolute', top: 2, right: 'calc(50% - 14px)', width: 6, height: 6, borderRadius: '50%', background: '#D4956A' }} />
            )}
          </button>
        )
      })}
    </nav>
  )
}
