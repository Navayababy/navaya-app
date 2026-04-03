import { brand, palette } from '../theme.js'

const tabs = [
  { id: 'home',    icon: '◉', label: 'Feed'    },
  { id: 'history', icon: '≡', label: 'History' },
  { id: 'chat',    icon: '✦', label: 'Ask'     },
  { id: 'prepare', icon: '◎', label: 'Prepare' },
]

export default function NavBar({ screen, setScreen, night }) {
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
        const active = screen === tab.id
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
            }}
          >
            <span style={{
              fontSize:   17,
              color:      active ? brand.bark : p.sub,
              transition: 'color .2s',
              lineHeight: 1,
            }}>
              {tab.icon}
            </span>
            <span style={{
              fontSize:      9,
              fontWeight:    active ? 600 : 400,
              color:         active ? brand.bark : p.sub,
              letterSpacing: '.02em',
              fontFamily:    "'DM Sans', sans-serif",
              lineHeight:    1,
            }}>
              {tab.label}
            </span>
          </button>
        )
      })}
    </nav>
  )
}
