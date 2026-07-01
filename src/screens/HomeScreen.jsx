import { useState, useEffect, useMemo } from 'react'
import { brand, palette } from '../theme.js'
import { getSessions, getNappies, getSleeps, getUserName, getChecked, getCustomItems, getHiddenDefaults } from '../lib/storage.js'
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

// The launch screen: answers "what do you want to do" and nothing else.
// Feed, Nappy, Sleep and Sage each own their real logging UI on their own
// tab — this screen only routes to them, it never re-implements them.
export default function HomeScreen({ night, setScreen, onAskSage, profile, timer, sleepTimer, sharedSessions, sharedNappies, sharedSleeps }) {
  const p = palette(night)
  const { feedActive, feedType, feedSide } = timer
  const { sleepActive } = sleepTimer

  const [sessions, setSessions] = useState(() => getSessions())
  const [nappies,  setNappies]  = useState(() => getNappies())
  const [sleeps,   setSleeps]   = useState(() => getSleeps())
  const [userName] = useState(() => getUserName() || '')

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
  // not four identical blocks distinguished by text alone.
  const rowStyle = (accent) => ({ display: 'flex', alignItems: 'center', gap: 16, width: '100%', minHeight: 80, borderRadius: 20, border: `1.5px solid ${accent}`, background: brand.bark, cursor: 'pointer', padding: '0 20px', textAlign: 'left', WebkitTapHighlightColor: 'transparent' })
  const iconWrapStyle = (accent) => ({ width: 44, height: 44, borderRadius: '50%', background: `${accent}29`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 })
  const primaryLabel = { fontSize: 19, fontWeight: 600, color: brand.sand, fontFamily: "'Jost', sans-serif", letterSpacing: '.01em' }
  const primaryChevron = { marginLeft: 'auto', color: brand.sand, opacity: 0.55, fontSize: 18, flexShrink: 0 }

  return (
    <div style={{ flex: 1, overflowY: 'auto', background: p.bg, position: 'relative' }}>
      {/* Settings — pinned to the corner, out of the main flow so it doesn't
          claim one of the evenly-spread content slots below */}
      <button onClick={() => setScreen('settings')}
        style={{ position: 'absolute', top: 18, right: 16, zIndex: 1, background: 'none', border: `1px solid ${p.border}`, borderRadius: 20, padding: '6px 13px', cursor: 'pointer', color: profile?.household_id ? brand.green : p.sub, fontSize: 12 }}>
        {profile?.household_id ? '● Sharing' : '⚙ Settings'}
      </button>

      <div style={{ minHeight: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-evenly', padding: '56px 0 20px' }}>

      {/* ── Greeting — the one moment of warmth, given real room ── */}
      <div style={{ padding: '10px 16px 8px', textAlign: 'center' }}>
        <span style={{ display: 'block', fontFamily: "'Cormorant Garamond', serif", fontSize: 15, color: brand.sand, letterSpacing: '.14em', textTransform: 'uppercase' }}>
          Good {greeting()}
        </span>
        <span style={{ display: 'block', fontFamily: "'Cormorant Garamond', serif", fontSize: 46, fontWeight: 400, color: p.heading, lineHeight: 1.15, marginTop: 4 }}>
          {userName || 'Welcome'}
        </span>
        {/* No name yet — invite adding one rather than faking familiarity
            with a placeholder like "there". */}
        {!userName && (
          <button onClick={() => setScreen('settings')}
            style={{ display: 'block', margin: '6px auto 0', background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: p.sub, letterSpacing: '.02em' }}>
            + Add your name
          </button>
        )}
        {glanceLine && (
          <span style={{ display: 'block', fontSize: 13, color: p.sub, lineHeight: 1.5, marginTop: 10 }}>{glanceLine}</span>
        )}
      </div>

      {/* ── What do you want to do? ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '22px 16px 0' }}>
        <button onClick={() => setScreen('feed')} style={rowStyle(brand.accent)}>
          <span style={iconWrapStyle(brand.accent)}><BottleIcon color={brand.accent} /></span>
          <span style={primaryLabel}>Log a feed</span>
          <span style={primaryChevron}>›</span>
        </button>
        <button onClick={() => setScreen('nappy')} style={rowStyle(brand.mist)}>
          <span style={iconWrapStyle(brand.mist)}><span style={{ fontSize: 22, color: brand.mist, lineHeight: 1 }}>◈</span></span>
          <span style={primaryLabel}>Log a nappy</span>
          <span style={primaryChevron}>›</span>
        </button>
        <button onClick={() => setScreen('sleep')} style={rowStyle(brand.green)}>
          <span style={iconWrapStyle(brand.green)}><span style={{ fontSize: 22, color: brand.green, lineHeight: 1 }}>☾</span></span>
          <span style={primaryLabel}>Log sleep</span>
          <span style={primaryChevron}>›</span>
        </button>
        <button onClick={() => onAskSage('')} style={rowStyle(brand.sand)}>
          <span style={iconWrapStyle(brand.sand)}><span style={{ fontSize: 22, color: brand.sand, lineHeight: 1 }}>✦</span></span>
          <span style={primaryLabel}>Ask Sage</span>
          <span style={primaryChevron}>›</span>
        </button>
      </div>

      {/* ── Secondary: Going out — occasional, so it stays visually quieter
          and clearly subordinate to the four actions above ── */}
      <button onClick={() => setScreen('prepare')}
        style={{ display: 'flex', alignItems: 'center', gap: 10, width: 'calc(100% - 32px)', margin: '20px 16px 0', background: p.card, borderRadius: 14, border: `1px solid ${p.border}`, padding: '13px 14px', cursor: 'pointer', textAlign: 'left', WebkitTapHighlightColor: 'transparent' }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={brand.sand} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0 }}>
          <rect x="3" y="7" width="18" height="13" rx="2" />
          <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
          <path d="M3 13h18" />
        </svg>
        <span style={{ flex: 1, fontSize: 13, fontWeight: 500, color: p.text }}>Going out</span>
        <span style={{ fontSize: 11, color: prepProgress.done === prepProgress.total && prepProgress.total > 0 ? brand.green : p.sub, fontWeight: 500 }}>
          {prepProgress.done === prepProgress.total && prepProgress.total > 0 ? '✓ Packed' : `${prepProgress.done}/${prepProgress.total}`}
        </span>
        <span style={{ color: p.sub, fontSize: 15 }}>›</span>
      </button>

      </div>
    </div>
  )
}
