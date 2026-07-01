import { palette } from '../theme.js'

// Compact bottle glyph, matching the thin-stroke line-icon language used
// for the other tabs rather than an emoji.
function BottleIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="9" y="2" width="6" height="3.5" rx="1" />
      <path d="M9.5 5.5 8.3 8.6A3 3 0 0 0 7 11v9a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2v-9a3 3 0 0 0-1.3-2.4L14.5 5.5" />
      <path d="M7.3 13.5h9.4" />
    </svg>
  )
}

// Prepare is reached from the Home screen card rather than the nav bar —
// it's a before-you-go-out task, not a many-times-a-day one like these six.
// Logging tabs run left to right in the order they happen in a day, with
// Sage and the Logbook (lookup, not logging) trailing at the end.
const tabs = [
  { id: 'home',    icon: '⌂',              label: 'Home'    },
  { id: 'feed',    icon: <BottleIcon />,    label: 'Feed'    },
  { id: 'nappy',   icon: '◈',              label: 'Nappy'   },
  { id: 'sleep',   icon: '☾',              label: 'Sleep'   },
  { id: 'chat',    icon: '✦',              label: 'Sage'    },
  { id: 'history', icon: '≡',              label: 'Logbook' },
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
        const showDot = (tab.id === 'feed' && feedActive && !active)
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
            <span style={{ fontSize: 9, fontWeight: active ? 600 : 400, color: active ? p.navActive : p.sub, letterSpacing: '.02em', fontFamily: "'Jost', sans-serif", lineHeight: 1 }}>
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
