import { useState, useEffect, useMemo } from 'react'
import { brand, palette } from '../theme.js'
import { getSessions, getNappies, getSleeps, getUserName, getChecked, getCustomItems, getHiddenDefaults, getLastOpenedAt, setLastOpenedAt } from '../lib/storage.js'
import { PREPARE_DEFAULT_ITEMS } from '../lib/constants.js'
import { fmtSince } from '../utils/time.js'
import { normalizeFeedSession, normalizeNappy, normalizeSleep } from '../lib/normalize.js'

function greeting() {
  const h = new Date().getHours()
  if (h < 12) return 'morning'
  if (h < 18) return 'afternoon'
  return 'evening'
}

// Compact bottle glyph — matches the thin-stroke line-icon language used
// elsewhere (Going Out's bag icon, the nav bar) rather than an emoji.
function BottleIcon({ color, size = 26 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="9" y="2" width="6" height="3.5" rx="1" />
      <path d="M9.5 5.5 8.3 8.6A3 3 0 0 0 7 11v9a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2v-9a3 3 0 0 0-1.3-2.4L14.5 5.5" />
      <path d="M7.3 13.5h9.4" />
    </svg>
  )
}

// A capsule/pill glyph, same thin-stroke style as the bottle icon.
function PillIcon({ color, size = 22 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="4" y="8.5" width="16" height="7" rx="3.5" transform="rotate(-45 12 12)" />
      <line x1="12" y1="8.5" x2="12" y2="15.5" transform="rotate(-45 12 12)" />
    </svg>
  )
}

// The launch screen: answers "what do you want to do" and nothing else.
// Feed, Nappy, Sleep and Sage each own their real logging UI on their own
// tab — this screen only routes to them, it never re-implements them.
export default function HomeScreen({ night, setScreen, onAskSage, onLogMedicine, profile, timer, sleepTimer, sharedSessions, sharedNappies, sharedSleeps }) {
  const p = palette(night)
  const { feedActive, feedType, feedSide } = timer
  const { sleepActive } = sleepTimer

  const [sessions, setSessions] = useState(() => getSessions())
  const [nappies,  setNappies]  = useState(() => getNappies())
  const [sleeps,   setSleeps]   = useState(() => getSleeps())
  const [userName] = useState(() => getUserName() || '')

  // "Welcome back" replaces the time-of-day greeting once a day or more has
  // passed since the app was last opened — otherwise it's just "Good
  // afternoon" as usual. Read once per visit, then record this visit for
  // next time.
  const [welcomeBack] = useState(() => {
    const last = getLastOpenedAt()
    return last ? (Date.now() - new Date(last).getTime()) >= 24 * 60 * 60 * 1000 : false
  })
  useEffect(() => { setLastOpenedAt() }, [])

  useEffect(() => {
    if (!sharedSessions) return
    setSessions(sharedSessions.map(normalizeFeedSession))
  }, [sharedSessions])
  useEffect(() => {
    if (!sharedNappies) return
    setNappies(sharedNappies.map(normalizeNappy))
  }, [sharedNappies])
  useEffect(() => {
    if (!sharedSleeps) return
    setSleeps(sharedSleeps.map(normalizeSleep))
  }, [sharedSleeps])

  // Re-render every 30s so the "since" times in the glance line stay current
  const [, setClockTick] = useState(0)
  useEffect(() => {
    const tick = setInterval(() => setClockTick(t => t + 1), 30000)
    return () => clearInterval(tick)
  }, [])

  const lastSession = useMemo(() =>
    sessions.reduce((latest, s) => !latest || new Date(s.startedAt) > new Date(latest.startedAt) ? s : latest, null)
  , [sessions])
  const lastNappy = useMemo(() =>
    nappies.reduce((latest, n) => !latest || new Date(n.loggedAt) > new Date(latest.loggedAt) ? n : latest, null)
  , [nappies])
  const lastSleep = useMemo(() =>
    sleeps.reduce((latest, s) => !latest || new Date(s.endedAt) > new Date(latest.endedAt) ? s : latest, null)
  , [sleeps])

  const feedGlance = feedActive
    ? `Feeding now${feedType === 'bottle' ? '' : ` · ${feedSide === 'L' ? 'left' : 'right'}`}`
    : lastSession?.endedAt
      ? `Fed ${fmtSince(lastSession.endedAt)}${fmtSince(lastSession.endedAt) !== 'just now' ? ' ago' : ''}`
      : null
  const nappyGlance = lastNappy
    ? `Nappy ${fmtSince(lastNappy.loggedAt)}${fmtSince(lastNappy.loggedAt) !== 'just now' ? ' ago' : ''}`
    : null
  const sleepGlance = sleepActive
    ? 'Asleep now'
    : lastSleep?.endedAt
      ? `Awake ${fmtSince(lastSleep.endedAt)}${fmtSince(lastSleep.endedAt) !== 'just now' ? ' ago' : ''}`
      : null
  const glanceLine = [feedGlance, nappyGlance, sleepGlance].filter(Boolean).join('  ·  ')

  // Prepare checklist progress for the secondary card below.
  const [prepProgress] = useState(() => {
    const checked = getChecked()
    const hidden  = getHiddenDefaults()
    const items   = [...PREPARE_DEFAULT_ITEMS.filter(i => !hidden.includes(i.id)), ...getCustomItems()]
    return { done: items.filter(i => checked[i.id]).length, total: items.length }
  })

  // Full-width rows rather than a 2x2 grid — each action reads as its own
  // clear, oversized button rather than a tile in a dense grid.
  // Every row keeps the same dark-brown fill (that's the "high contrast,
  // oversized" foundation) — each action's own accent only tints its
  // border and icon badge, so the four read as a family with a hero each,
  // not identical blocks distinguished by text alone.
  const rowStyle = (accent) => ({ display: 'flex', alignItems: 'center', gap: 16, width: '100%', minHeight: 76, borderRadius: 20, border: `1.5px solid ${accent}`, background: brand.bark, cursor: 'pointer', padding: '0 20px', textAlign: 'left', WebkitTapHighlightColor: 'transparent' })
  const iconWrapStyle = (accent) => ({ width: 42, height: 42, borderRadius: '50%', background: `${accent}29`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 })
  const primaryLabel = { fontSize: 18, fontWeight: 600, color: brand.sand, fontFamily: "'Jost', sans-serif", letterSpacing: '.01em' }
  const primaryChevron = { marginLeft: 'auto', color: brand.sand, opacity: 0.55, fontSize: 18, flexShrink: 0 }
  // Secondary pair (Sage, Going out) sit side by side, together spanning the
  // same width as the four rows above — a matched, quieter pair rather than
  // two full-width rows adrift with space between them.
  const secondaryCard = { flex: 1, minHeight: 76, borderRadius: 18, border: `1px solid ${p.border}`, background: p.card, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, WebkitTapHighlightColor: 'transparent' }

  return (
    <div style={{ flex: 1, overflowY: 'auto', background: p.bg, position: 'relative' }}>
      {/* Settings — pinned to the corner, out of the main flow so it doesn't
          claim one of the evenly-spread content slots below */}
      <button onClick={() => setScreen('settings')}
        style={{ position: 'absolute', top: 16, right: 16, zIndex: 1, background: 'none', border: `1px solid ${p.border}`, borderRadius: 20, padding: '6px 13px', cursor: 'pointer', color: profile?.household_id ? brand.green : p.sub, fontSize: 12 }}>
        {profile?.household_id ? '● Sharing' : '⚙ Settings'}
      </button>

      <div style={{ minHeight: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-evenly', padding: '48px 0 16px' }}>

      {/* ── Greeting — the one moment of warmth, given real room ── */}
      <div style={{ padding: '4px 16px 4px', textAlign: 'center' }}>
        <span style={{ display: 'block', fontFamily: "'Cormorant Garamond', serif", fontSize: 14, color: brand.sand, letterSpacing: '.14em', textTransform: 'uppercase' }}>
          {welcomeBack ? 'Welcome back' : `Good ${greeting()}`}
        </span>
        <span style={{ display: 'block', fontFamily: "'Cormorant Garamond', serif", fontSize: 40, fontWeight: 400, color: p.heading, lineHeight: 1.15, marginTop: 4 }}>
          {userName || 'Welcome'}
        </span>
        {/* No name yet — invite adding one rather than faking familiarity
            with a placeholder like "there". */}
        {!userName && (
          <button onClick={() => setScreen('settings')}
            style={{ display: 'block', margin: '4px auto 0', background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: p.sub, letterSpacing: '.02em' }}>
            + Add your name
          </button>
        )}
        {glanceLine && (
          <span style={{ display: 'block', fontSize: 12, color: p.sub, lineHeight: 1.4, marginTop: 6 }}>{glanceLine}</span>
        )}
      </div>

      {/* ── What do you want to do? — the four things logged every day ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '10px 16px 0' }}>
        <button onClick={() => setScreen('feed')} style={rowStyle(brand.accent)}>
          <span style={iconWrapStyle(brand.accent)}><BottleIcon color={brand.accent} size={22} /></span>
          <span style={primaryLabel}>Log a feed</span>
          <span style={primaryChevron}>›</span>
        </button>
        <button onClick={() => setScreen('nappy')} style={rowStyle(brand.mist)}>
          <span style={iconWrapStyle(brand.mist)}><span style={{ fontSize: 20, color: brand.mist, lineHeight: 1 }}>◈</span></span>
          <span style={primaryLabel}>Log a nappy</span>
          <span style={primaryChevron}>›</span>
        </button>
        <button onClick={() => setScreen('sleep')} style={rowStyle(brand.green)}>
          <span style={iconWrapStyle(brand.green)}><span style={{ fontSize: 20, color: brand.green, lineHeight: 1 }}>☾</span></span>
          <span style={primaryLabel}>Log sleep</span>
          <span style={primaryChevron}>›</span>
        </button>
        <button onClick={onLogMedicine} style={rowStyle(brand.rose)}>
          <span style={iconWrapStyle(brand.rose)}><PillIcon color={brand.rose} size={20} /></span>
          <span style={primaryLabel}>Log medicine</span>
          <span style={primaryChevron}>›</span>
        </button>
      </div>

      {/* ── Secondary: Sage and Going out — a matched pair, available but
          not competing with the four logging actions above ── */}
      <div style={{ display: 'flex', gap: 10, padding: '10px 16px 0' }}>
        <button onClick={() => onAskSage('')} style={secondaryCard}>
          <span style={{ color: brand.sand, fontSize: 18, lineHeight: 1 }}>✦</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: p.text }}>Ask Sage</span>
        </button>
        <button onClick={() => setScreen('prepare')} style={secondaryCard}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={brand.sand} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="3" y="7" width="18" height="13" rx="2" />
            <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            <path d="M3 13h18" />
          </svg>
          <span style={{ fontSize: 13, fontWeight: 600, color: p.text }}>Going out</span>
          <span style={{ fontSize: 10, color: prepProgress.done === prepProgress.total && prepProgress.total > 0 ? brand.green : p.sub, fontWeight: 500 }}>
            {prepProgress.done === prepProgress.total && prepProgress.total > 0 ? '✓ Packed' : `${prepProgress.done}/${prepProgress.total}`}
          </span>
        </button>
      </div>

      </div>
    </div>
  )
}
