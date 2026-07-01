import { useState, useEffect, useMemo } from 'react'
import { brand, palette } from '../theme.js'
import { getSessions, getNappies, getSleeps, getUserName, getChecked, getCustomItems, getHiddenDefaults } from '../lib/storage.js'
import { PREPARE_DEFAULT_ITEMS } from '../lib/constants.js'
import { fmtSince } from '../utils/time.js'
import { normalizeFeedSession, normalizeNappy, normalizeSleep } from '../lib/normalize.js'

const QUOTES = [
  "When your baby is unwell, their saliva signals your breast to produce milk with higher concentrations of the exact antibodies needed. Your body responds in real time.",
  "Breast milk changes during a single feed — thinner at the start to quench thirst, richer in fat towards the end to satisfy hunger. Your body already knows what your baby needs.",
  "Your milk contains over 700 distinct bacterial species that seed your baby's gut microbiome for life. No formula has ever come close to replicating it.",
  "Breast milk contains melatonin at night and almost none during the day — quietly teaching your baby the rhythm of light and dark.",
  "Human milk oligosaccharides — the third most abundant component in breast milk — exist solely to feed your baby's gut bacteria. The design is that deliberate.",
  "Studies show breastfed babies have a 73% lower risk of SIDS. Every feed is protection. (Vennemann et al., 2009)",
  "Oxytocin released during every feed is actively helping your uterus contract back to its pre-pregnancy size. You are healing and nurturing at the same time.",
  "At 2am, in the dark, half-asleep — this is what devotion looks like. You are doing it.",
  "There is no feed too short, no latch too imperfect. It all counts.",
  "Your baby doesn't know the time. They only know you came.",
  "No one else on earth can give your baby exactly what you just did.",
  "Some days it flows. Some days it's a fight. Both versions of you are doing enough.",
]

function greeting() {
  const h = new Date().getHours()
  if (h < 12) return 'morning'
  if (h < 18) return 'afternoon'
  return 'evening'
}

// Compact bottle glyph — matches the thin-stroke line-icon language used
// elsewhere (Going Out's bag icon, the nav bar) rather than an emoji.
function BottleIcon({ color, size = 30 }) {
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
  const [quote] = useState(() => QUOTES[Math.floor(Math.random() * QUOTES.length)])

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

  // A visible sand border, not just a fill-colour change, is what keeps these
  // legible in night mode — brand.bark and the near-black night background
  // sit too close in luminance for the fill alone to read as a button edge.
  const primaryCard = { minHeight: 118, borderRadius: 20, border: `1.5px solid ${brand.sand}`, background: brand.bark, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, WebkitTapHighlightColor: 'transparent' }
  const primaryLabel = { fontSize: 18, fontWeight: 600, color: brand.sand, fontFamily: "'Jost', sans-serif", letterSpacing: '.01em' }

  return (
    <div style={{ flex: 1, overflowY: 'auto', background: p.bg }}>
      <div style={{ minHeight: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>

      {/* ── Header ── */}
      <div style={{ padding: '22px 16px 6px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <span style={{ display: 'block', fontFamily: "'Cormorant Garamond', serif", fontSize: 12, color: brand.sand, letterSpacing: '.12em', textTransform: 'uppercase' }}>
            Good {greeting()}
          </span>
          <span style={{ display: 'block', fontFamily: "'Cormorant Garamond', serif", fontSize: 28, fontWeight: 400, color: p.heading, lineHeight: 1.1, marginTop: 2 }}>
            {userName || 'there'}
          </span>
        </div>
        <button onClick={() => setScreen('settings')}
          style={{ background: 'none', border: `1px solid ${p.border}`, borderRadius: 20, padding: '6px 13px', cursor: 'pointer', color: profile?.household_id ? brand.green : p.sub, fontSize: 12, marginTop: 4 }}>
          {profile?.household_id ? '● Sharing' : '⊕ Account'}
        </button>
      </div>

      {/* ── At a glance: one quiet line, not a dashboard ── */}
      {glanceLine && (
        <div style={{ padding: '10px 16px 4px' }}>
          <span style={{ fontSize: 13, color: p.sub, lineHeight: 1.5 }}>{glanceLine}</span>
        </div>
      )}

      {/* ── What do you want to do? ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, padding: '18px 16px 0' }}>
        <button onClick={() => setScreen('feed')} style={primaryCard}>
          <BottleIcon color={brand.sand} />
          <span style={primaryLabel}>Log a feed</span>
        </button>
        <button onClick={() => setScreen('nappy')} style={primaryCard}>
          <span style={{ fontSize: 30, color: brand.sand, lineHeight: 1 }}>◈</span>
          <span style={primaryLabel}>Log a nappy</span>
        </button>
        <button onClick={() => setScreen('sleep')} style={primaryCard}>
          <span style={{ fontSize: 30, color: brand.sand, lineHeight: 1 }}>☾</span>
          <span style={primaryLabel}>Log sleep</span>
        </button>
        <button onClick={() => onAskSage('')} style={primaryCard}>
          <span style={{ fontSize: 30, color: brand.sand, lineHeight: 1 }}>✦</span>
          <span style={primaryLabel}>Ask Sage</span>
        </button>
      </div>

      {/* ── Secondary: Going out (occasional, so it stays smaller and quieter) ── */}
      <button onClick={() => setScreen('prepare')}
        style={{ display: 'flex', alignItems: 'center', gap: 10, width: 'calc(100% - 32px)', margin: '14px 16px 0', background: p.card, borderRadius: 14, border: `1px solid ${p.border}`, padding: '12px 14px', cursor: 'pointer', textAlign: 'left', WebkitTapHighlightColor: 'transparent' }}>
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

      {/* ── Editorial daily note ── */}
      <div style={{ padding: '34px 26px 20px', textAlign: 'center' }}>
        <span aria-hidden="true" style={{ display: 'block', fontSize: 13, color: brand.sand, marginBottom: 8 }}>✦</span>
        <p style={{ fontSize: 15, color: p.sub, fontStyle: 'italic', lineHeight: 1.55, fontFamily: "'Cormorant Garamond', serif", margin: 0 }}>
          "{quote}"
        </p>
      </div>

      </div>
    </div>
  )
}
