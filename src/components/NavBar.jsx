import { palette } from '../theme.js'
import { BottleIcon } from './icons.jsx'

// Prepare is reached from the Home screen card rather than the nav bar —
// it's a before-you-go-out task, not a many-times-a-day one like these six.
// Logging tabs run left to right in the order they happen in a day, with
// Sage and the Logbook (lookup, not logging) trailing at the end.
const tabs = [
  { id: 'home',    icon: '⌂',              label: 'Home'    },
  { id: 'feed',    icon: <BottleIcon size={15} />, label: 'Feed'    },
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
      boxShadow:     night ? '0 -6px 18px rgba(0,0,0,0.22)' : '0 -6px 18px rgba(74,55,40,0.05)',
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
              minWidth:       0,
              background:     'none',
              border:         'none',
              cursor:         'pointer',
              display:        'flex',
              flexDirection:  'column',
              alignItems:     'center',
              gap:            3,
              padding:        '4px 0 2px',
              WebkitTapHighlightColor: 'transparent',
              position:       'relative',
            }}
          >
            {/* Filled pill behind the active tab, instead of colour alone,
                so "which tab am I on" reads at a glance rather than needing
                a close look at a subtle tint change. Sized to the tab's own
                share of the bar (not its content) so six tabs' padding can
                never add up to more than the bar is wide, even at 320px. */}
            <span style={{
              display:      'flex',
              flexDirection: 'column',
              alignItems:   'center',
              gap:          3,
              width:        '100%',
              boxSizing:    'border-box',
              padding:      '5px 6px 4px',
              borderRadius: 14,
              background:   active ? `${p.navActive}1C` : 'transparent',
              transition:   'background .2s',
            }}>
              <span style={{ fontSize: 17, color: active ? p.navActive : p.sub, transition: 'color .2s', lineHeight: 1 }}>
                {tab.icon}
              </span>
              <span style={{ fontSize: 9, fontWeight: active ? 600 : 400, color: active ? p.navActive : p.sub, letterSpacing: '.02em', fontFamily: "'Jost', sans-serif", lineHeight: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }}>
                {tab.label}
              </span>
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
