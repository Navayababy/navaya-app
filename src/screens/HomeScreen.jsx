import { useState, useRef, useEffect, useMemo } from 'react'
import { brand, palette } from '../theme.js'
import { getSessions, addSession, updateSession, getBabyName, setBabyName, getUserName, setUserName, getChecked, getCustomItems, getHiddenDefaults, getNappies, addNappy, getSleeps, addSleep } from '../lib/storage.js'
import { PREPARE_DEFAULT_ITEMS } from '../lib/constants.js'
import { syncWrite } from '../lib/sync.js'
import { fmt, fmtSince, fmtMins, fmtDayTime } from '../utils/time.js'
import { normalizeFeedSession, normalizeNappy, normalizeSleep, isBottleFeed, feedTypeOf } from '../lib/normalize.js'
import { bottleLabel } from '../lib/constants.js'
import { newId } from '../lib/id.js'

const QUOTES = [
  // — Verified breast milk facts —
  "When your baby is unwell, their saliva signals your breast to produce milk with higher concentrations of the exact antibodies needed. Your body responds in real time.",
  "Breast milk changes during a single feed — thinner at the start to quench thirst, richer in fat towards the end to satisfy hunger. Your body already knows what your baby needs.",
  "Your milk contains over 700 distinct bacterial species that seed your baby's gut microbiome for life. No formula has ever come close to replicating it.",
  "Breast milk contains melatonin at night and almost none during the day — quietly teaching your baby the rhythm of light and dark.",
  "The fat content of your milk is measurably higher in the evening than in the morning, giving your baby a richer, more satisfying feed before sleep.",
  "Human milk oligosaccharides — the third most abundant component in breast milk — exist solely to feed your baby's gut bacteria. The design is that deliberate.",
  "Breast milk contains stem cells. Research from the University of Western Australia found they can differentiate into heart, brain, and bone tissue.",
  "Studies show breastfed babies have a 73% lower risk of SIDS. Every feed is protection. (Vennemann et al., 2009)",
  "Oxytocin released during every feed is actively helping your uterus contract back to its pre-pregnancy size. You are healing and nurturing at the same time.",
  "At peak production, your body makes up to a litre of milk a day — burning roughly 500 extra calories. That is a full-time metabolic job.",
  "Your colostrum contained more immunoglobulin A per millilitre than any milk you will ever produce. The timing was not a coincidence.",
  "Premature babies receive breast milk with a different composition — higher in protein and immune factors — because your body already knew they needed more.",
  "A single breastfeed can transfer hundreds of billions of living cells to your baby. It is the only food on earth that is biologically alive.",
  // — For the hard moments —
  "At 2am, in the dark, half-asleep — this is what devotion looks like. You are doing it.",
  "There is no feed too short, no latch too imperfect. It all counts.",
  "Your baby doesn't know the time. They only know you came.",
  "Even the feeds you nearly gave up on — you didn't. That matters more than you know.",
  "No one else on earth can give your baby exactly what you just did.",
  "The nights are long. But you will look back on these quiet hours with more love than you expect.",
  "Every feed is a conversation your body is having with your baby. One no one else can have for you.",
  "You are not just feeding your baby. You are building their immune system, their gut, and their brain. Feed by feed.",
  "Some days it flows. Some days it's a fight. Both versions of you are doing enough.",
  "The research is clear: what you are doing has effects that last decades. You just can't see them yet.",
]

const sortByTime = arr => [...arr].sort((a, b) => new Date(b.startedAt) - new Date(a.startedAt))

function greeting() {
  const h = new Date().getHours()
  if (h < 12) return 'morning'
  if (h < 18) return 'afternoon'
  return 'evening'
}

// h:mm:ss for long sleeps, mm:ss under an hour — matches the Sleep screen.
function fmtClock(secs) {
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  const s = secs % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

// Gentle "next feed" cue from the typical gap between recent feeds. Returns a
// soft HH:MM string, or null when there isn't enough history to be honest.
function nextFeedHint(sessions) {
  const starts = sessions
    .map(s => new Date(s.startedAt).getTime())
    .filter(Boolean)
    .sort((a, b) => b - a)
    .slice(0, 6)
  if (starts.length < 3) return null
  const gaps = []
  for (let i = 0; i < starts.length - 1; i++) gaps.push(starts[i] - starts[i + 1])
  const avg = gaps.reduce((a, b) => a + b, 0) / gaps.length
  // Ignore implausible rhythms (under 30 min or over 8 h between feeds)
  if (avg < 30 * 60 * 1000 || avg > 8 * 3600 * 1000) return null
  const next = new Date(starts[0] + avg)
  return `${String(next.getHours()).padStart(2, '0')}:${String(next.getMinutes()).padStart(2, '0')}`
}

export default function HomeScreen({ night, onNightToggle, setScreen, timer, sleepTimer, authUser, profile, sharedSessions, sharedNappies, sharedSleeps, onSessionSaved, onNappySaved, onSleepSaved }) {
  const p = palette(night)
  const { feedActive, feedSide, feedType, elapsed, startFeed, switchSide, stopFeed } = timer
  const { sleepActive, sleepElapsed, startSleep, stopSleep } = sleepTimer

  // Full sorted list (sliced at render): the side suggestion needs the most
  // recent BREAST feed, which may sit behind a run of bottle feeds.
  const [sessions, setSessions] = useState(() => sortByTime(getSessions()))
  const [nappies,  setNappies]  = useState(() => getNappies())
  const [sleeps,   setSleeps]   = useState(() => getSleeps())

  // Keep local lists in sync with the shared household. Each runs for an empty
  // array too, so a list clears when the household has no entries.
  useEffect(() => {
    if (!sharedSessions) return
    setSessions(sortByTime(sharedSessions.map(normalizeFeedSession)))
  }, [sharedSessions])
  useEffect(() => {
    if (!sharedNappies) return
    setNappies(sharedNappies.map(normalizeNappy))
  }, [sharedNappies])
  useEffect(() => {
    if (!sharedSleeps) return
    setSleeps(sharedSleeps.map(normalizeSleep))
  }, [sharedSleeps])

  // Re-render every 30s so the "since" times stay current while the screen is open
  const [, setClockTick] = useState(0)
  useEffect(() => {
    const tick = setInterval(() => setClockTick(t => t + 1), 30000)
    return () => clearInterval(tick)
  }, [])

  const [showMood,       setShowMood]      = useState(false)
  const [showAmount,     setShowAmount]    = useState(false)
  const [amountInput,    setAmountInput]   = useState('')
  const [milkInput,      setMilkInput]     = useState('expressed')
  const [pendingSession, setPending]       = useState(null)
  const [partnerFlash,   setPartnerFlash]  = useState(false)
  const [nappyOpen,      setNappyOpen]     = useState(false)
  const [nappyFlash,     setNappyFlash]    = useState(false)
  const [editingName,    setEditingName]   = useState(false)
  const [userName,       setUserNameState] = useState(() => getUserName() || '')
  const [nameInput,      setNameInput]     = useState('')
  const [babyName,       setBabyNameState] = useState(() => getBabyName() || '')
  const [babyNameInput,  setBabyNameInput] = useState('')
  const [editingBaby,    setEditingBaby]   = useState(false)
  const [quote] = useState(() => QUOTES[Math.floor(Math.random() * QUOTES.length)])
  const nameInputRef  = useRef(null)
  const babyNameRef   = useRef(null)
  const flashTimersRef = useRef([])

  const lastSession = sessions[0] || null
  // Suggest the opposite of the last breast feed — bottle feeds don't count
  const lastBreast  = sessions.find(s => !isBottleFeed(s)) || null
  const lastSide    = lastBreast?.side || 'R'
  const suggested   = lastSide === 'L' ? 'R' : 'L'

  const timeSinceLast = lastSession?.endedAt && !feedActive
    ? fmtSince(lastSession.endedAt)
    : null

  const lastNappy = useMemo(() =>
    nappies.reduce((latest, n) =>
      !latest || new Date(n.loggedAt) > new Date(latest.loggedAt) ? n : latest
    , null)
  , [nappies])

  const lastSleep = useMemo(() =>
    sleeps.reduce((latest, s) =>
      !latest || new Date(s.endedAt) > new Date(latest.endedAt) ? s : latest
    , null)
  , [sleeps])

  const sinceNappy = lastNappy ? fmtSince(lastNappy.loggedAt) : null
  const sinceSleep = lastSleep && !sleepActive ? fmtSince(lastSleep.endedAt) : null
  const nextFeed   = !feedActive ? nextFeedHint(sessions) : null

  // Merged recent timeline — last five events across feeds, nappies and sleeps.
  const timeline = useMemo(() => {
    const feedItems  = sessions.map(s => ({ kind: 'feed',  id: s.id, at: s.endedAt || s.startedAt, data: s, loggedBy: s.loggedBy }))
    const nappyItems = nappies.map(n => ({ kind: 'nappy', id: n.id, at: n.loggedAt,                data: n, loggedBy: n.loggedBy }))
    const sleepItems = sleeps.map(s => ({ kind: 'sleep',  id: s.id, at: s.endedAt,                 data: s, loggedBy: s.loggedBy }))
    return [...feedItems, ...nappyItems, ...sleepItems]
      .filter(e => e.at)
      .sort((a, b) => new Date(b.at) - new Date(a.at))
      .slice(0, 5)
  }, [sessions, nappies, sleeps])

  // The feed is saved the moment it stops — the mood check-in only patches it
  // afterwards, so navigating away or closing the app can never lose the feed.
  const pendingRemoteRef = useRef(null)

  const handleStop = () => {
    const sessionData = stopFeed()
    const session = { id: newId(), ...sessionData, amountMl: null, milkType: null, mood: null }
    setSessions(sortByTime(addSession(session)))

    pendingRemoteRef.current = null
    if (authUser && profile?.household_id) {
      pendingRemoteRef.current = syncWrite('feed.insert', {
        id:           session.id,
        householdId:  profile.household_id,
        babyId:       null,
        loggedBy:     authUser.id,
        startedAt:    session.startedAt,
        endedAt:      session.endedAt,
        durationSecs: session.durationSecs,
        side:         session.side,
        moodScore:    null,
        feedType:     session.feedType,
        amountMl:     null,
        milkType:     null,
      }).then(({ ok }) => {
        if (!ok) return ok // queued for retry — the flash would be a lie
        onSessionSaved?.()
        // Only claim the partner can see the feed once the write has succeeded
        flashTimersRef.current.forEach(clearTimeout)
        setPartnerFlash(true)
        flashTimersRef.current = [setTimeout(() => setPartnerFlash(false), 3100)]
        return ok
      })
    }

    setPending(session)
    // Bottle: the feed is already saved — the amount sheet (then mood) only
    // patches it afterwards, so closing the app can never lose the feed.
    if (session.feedType === 'bottle') {
      setAmountInput('')
      setMilkInput('expressed')
      setShowAmount(true)
    } else {
      setShowMood(true)
    }
  }

  useEffect(() => () => flashTimersRef.current.forEach(clearTimeout), [])

  const saveMood = (mood) => {
    if (!pendingSession) return
    setSessions(sortByTime(updateSession(pendingSession.id, { mood })))
    const remote = pendingRemoteRef.current
    if (remote) {
      // Same UUID in both stores — wait for the insert attempt to settle, then
      // patch the mood. If the insert was queued, the outbox keeps this update
      // behind it, so ordering is preserved either way. The bottle fields ride
      // along so this patch never strips an amount saved a moment earlier.
      remote.then(() => {
        syncWrite('feed.update', {
          id:           pendingSession.id,
          side:         pendingSession.side,
          startedAt:    pendingSession.startedAt,
          endedAt:      pendingSession.endedAt,
          durationSecs: pendingSession.durationSecs,
          moodScore:    mood,
          feedType:     feedTypeOf(pendingSession),
          amountMl:     pendingSession.amountMl ?? null,
          milkType:     pendingSession.milkType ?? null,
        }).then(({ ok }) => { if (ok) onSessionSaved?.() })
      })
    }
    setPending(null)
    setShowMood(false)
  }

  const skipMood = () => {
    // Feed is already saved with no mood — just dismiss the check-in
    setPending(null)
    setShowMood(false)
  }

  const saveAmount = () => {
    if (!pendingSession) return
    const parsed = Math.round(Number(amountInput))
    const amountMl = parsed >= 1 ? Math.min(500, parsed) : null
    const changes = { amountMl, milkType: milkInput }
    setSessions(sortByTime(updateSession(pendingSession.id, changes)))
    setPending(prev => (prev ? { ...prev, ...changes } : prev))
    const remote = pendingRemoteRef.current
    if (remote) {
      // Patches behind the insert exactly like the mood check-in does.
      remote.then(() => {
        syncWrite('feed.update', {
          id:           pendingSession.id,
          side:         null,
          startedAt:    pendingSession.startedAt,
          endedAt:      pendingSession.endedAt,
          durationSecs: pendingSession.durationSecs,
          moodScore:    pendingSession.mood ?? null,
          feedType:     'bottle',
          amountMl,
          milkType:     milkInput,
        }).then(({ ok }) => { if (ok) onSessionSaved?.() })
      })
    }
    setShowAmount(false)
    setShowMood(true)
  }

  const skipAmount = () => {
    // Bottle feed is already saved without an amount — move on to the mood
    setShowAmount(false)
    setShowMood(true)
  }

  // ── Inline nappy quick-log ── one tap to open, one to choose a type. Colour
  // detail stays on the Nappy tab (progressive disclosure); here we log fast.
  const logNappy = (type) => {
    const loggedAt = new Date().toISOString()
    const nappy = { id: newId(), type, pooColor: null, loggedAt }
    setNappies(addNappy(nappy))
    if (authUser && profile?.household_id) {
      syncWrite('nappy.insert', { id: nappy.id, householdId: profile.household_id, loggedBy: authUser.id, type, pooColor: null, loggedAt })
        .then(({ ok }) => { if (ok) onNappySaved?.() })
    }
    setNappyOpen(false)
    flashTimersRef.current.forEach(clearTimeout)
    setNappyFlash(true)
    flashTimersRef.current = [setTimeout(() => setNappyFlash(false), 1800)]
  }

  // ── Sleep quick-log ── start/stop the shared sleep timer from Home.
  const handleSleepStop = () => {
    const sleepData = stopSleep()
    const sleep = { id: newId(), ...sleepData }
    setSleeps(addSleep(sleep))
    if (authUser && profile?.household_id) {
      syncWrite('sleep.insert', {
        id:           sleep.id,
        householdId:  profile.household_id,
        loggedBy:     authUser.id,
        startedAt:    sleep.startedAt,
        endedAt:      sleep.endedAt,
        durationSecs: sleep.durationSecs,
      }).then(({ ok }) => { if (ok) onSleepSaved?.() })
    }
  }

  const saveName = () => {
    const trimmed = nameInput.trim()
    if (trimmed) { setUserName(trimmed); setUserNameState(trimmed) }
    setEditingName(false)
  }

  const openNameEdit = () => {
    setNameInput(userName)
    setEditingName(true)
    setTimeout(() => nameInputRef.current?.focus(), 80)
  }

  const saveBabyName = () => {
    const trimmed = babyNameInput.trim()
    if (trimmed) { setBabyName(trimmed); setBabyNameState(trimmed) }
    setEditingBaby(false)
  }

  const openBabyEdit = () => {
    setBabyNameInput(babyName)
    setEditingBaby(true)
    setTimeout(() => babyNameRef.current?.focus(), 80)
  }

  const displayName = userName || 'there'
  const babyLabel   = babyName || 'baby'

  // Prepare checklist progress for the card below. Read once on mount — the
  // screen remounts on every tab change, so it stays fresh after editing.
  const [prepProgress] = useState(() => {
    const checked = getChecked()
    const hidden  = getHiddenDefaults()
    const items   = [...PREPARE_DEFAULT_ITEMS.filter(i => !hidden.includes(i.id)), ...getCustomItems()]
    return { done: items.filter(i => checked[i.id]).length, total: items.length }
  })

  // Shared design tokens for a calm, consistent surface language.
  const CARD_RADIUS = 18

  const heroStat = (label, value, accent) => (
    <div style={{ flex: 1, textAlign: 'center', padding: '0 4px' }}>
      <span style={{ display: 'block', fontSize: 9, color: p.sub, letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: 6 }}>{label}</span>
      <span style={{ display: 'block', fontFamily: "'Cormorant Garamond', serif", fontSize: String(value).length > 6 ? 19 : 24, fontWeight: 400, color: accent || p.heading, lineHeight: 1.1 }}>{value}</span>
    </div>
  )

  const TIMELINE_META = {
    feed:  { icon: '◉', tint: brand.sand },
    nappy: { icon: '◈', tint: brand.accent },
    sleep: { icon: '☾', tint: brand.green },
  }

  const timelineRow = (e, isLast) => {
    const meta = TIMELINE_META[e.kind]
    let title = ''
    if (e.kind === 'feed')  title = isBottleFeed(e.data) ? bottleLabel(e.data) : `${e.data.side === 'L' ? 'Left' : 'Right'} feed`
    if (e.kind === 'nappy') title = e.data.type === 'wet' ? 'Wee' : e.data.type === 'poo' ? 'Poo' : 'Wee & poo'
    if (e.kind === 'sleep') title = `Slept ${fmtMins(e.data.durationSecs || 0)}`
    const byPartner = e.loggedBy && authUser && e.loggedBy !== authUser.id
    return (
      <div key={`${e.kind}-${e.id}`} style={{ display: 'flex', alignItems: 'center', padding: '10px 0', borderBottom: isLast ? 'none' : `1px solid ${p.border}` }}>
        <div style={{ width: 30, height: 30, borderRadius: '50%', background: p.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: 11, flexShrink: 0, color: meta.tint, fontSize: 14 }}>
          {meta.icon}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: 'block', fontSize: 13, color: p.text, fontWeight: 500 }}>{title}</span>
          <span style={{ display: 'block', fontSize: 11, color: p.sub }}>
            {fmtDayTime(e.at)}{byPartner && <span style={{ color: brand.green }}> · shared</span>}
          </span>
        </div>
        {e.kind === 'feed' && (
          <span style={{ fontSize: 12, color: p.sub, flexShrink: 0 }}>{fmt(e.data.durationSecs)}</span>
        )}
      </div>
    )
  }

  return (
    <div style={{ flex: 1, overflowY: 'auto', background: p.bg }}>

      {/* ── Header ── */}
      <div style={{ padding: '18px 16px 4px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <span style={{ display: 'block', fontFamily: "'Cormorant Garamond', serif", fontSize: 12, color: brand.sand, letterSpacing: '.12em', textTransform: 'uppercase' }}>
            Good {greeting()}
          </span>

          {/* Editable parent name */}
          {editingName ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
              <input
                ref={nameInputRef}
                value={nameInput}
                onChange={e => setNameInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') saveName() }}
                placeholder="Your name"
                style={{
                  fontFamily: "'Cormorant Garamond', serif", fontSize: 24, fontWeight: 400,
                  color: p.heading, background: 'transparent',
                  border: 'none', borderBottom: `1.5px solid ${brand.sand}`,
                  outline: 'none', width: 140, lineHeight: 1.2, padding: '0 0 2px',
                }}
              />
              <button onClick={saveName}
                style={{ background: brand.bark, border: 'none', borderRadius: 8, padding: '4px 10px', cursor: 'pointer', color: brand.sand, fontSize: 11, fontWeight: 500 }}>
                Save
              </button>
            </div>
          ) : (
            <button onClick={openNameEdit} aria-label="Edit your name"
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'baseline', gap: 6 }}>
              <span style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 26, fontWeight: 400, color: p.heading, lineHeight: 1.1 }}>
                {displayName}
              </span>
              {babyName && <span style={{ fontSize: 12, color: p.sub }}>· {babyName}</span>}
              <span aria-hidden="true" style={{ fontSize: 11, color: p.sub }}>✎</span>
            </button>
          )}

          {/* Baby name — shown inline above; this editor appears on demand */}
          {!babyName && !editingBaby && (
            <button onClick={openBabyEdit} aria-label="Add baby name"
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginTop: 4, display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ fontSize: 12, color: p.sub }}>+ Add baby's name</span>
            </button>
          )}
          {editingBaby && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6 }}>
              <input
                ref={babyNameRef}
                value={babyNameInput}
                onChange={e => setBabyNameInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') saveBabyName() }}
                placeholder="Baby's name"
                style={{
                  fontFamily: "'Cormorant Garamond', serif", fontSize: 18, fontWeight: 400,
                  color: p.heading, background: 'transparent',
                  border: 'none', borderBottom: `1.5px solid ${brand.sand}`,
                  outline: 'none', width: 130, lineHeight: 1.2, padding: '0 0 2px',
                }}
              />
              <button onClick={saveBabyName}
                style={{ background: brand.bark, border: 'none', borderRadius: 8, padding: '4px 10px', cursor: 'pointer', color: brand.sand, fontSize: 11, fontWeight: 500 }}>
                Save
              </button>
            </div>
          )}
          {babyName && !editingBaby && (
            <button onClick={openBabyEdit} aria-label="Edit baby name"
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginTop: 2, fontSize: 11, color: p.sub }}>
              edit baby
            </button>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
          <button onClick={() => setScreen('settings')}
            style={{ position: 'relative', background: 'none', border: `1px solid ${p.border}`, borderRadius: 20, padding: '5px 12px', cursor: 'pointer', color: profile?.household_id ? brand.green : p.sub, fontSize: 11 }}>
            {profile?.household_id ? '● Sharing' : '⊕ Account'}
          </button>
          <button onClick={onNightToggle} aria-label={night ? 'Switch to light mode' : 'Switch to night mode'}
            style={{ background: 'none', border: `1px solid ${p.border}`, borderRadius: 20, padding: '5px 12px', cursor: 'pointer', color: p.sub, fontSize: 11 }}>
            {night ? '☀' : '☽'}
          </button>
        </div>
      </div>

      {/* ── Status hero: "When did she last…?" ── */}
      <div style={{ margin: '12px 14px 0', background: p.card, borderRadius: CARD_RADIUS, border: `1px solid ${p.border}`, padding: '16px 14px 14px' }}>
        <span style={{ display: 'block', fontSize: 10, color: p.sub, letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: 14, textAlign: 'center' }}>
          {babyName ? `How ${babyLabel}'s doing` : 'At a glance'}
        </span>
        <div style={{ display: 'flex', alignItems: 'flex-start' }}>
          {heroStat('Last feed',
            feedActive ? fmt(elapsed) : (timeSinceLast === 'just now' ? 'just now' : timeSinceLast || '—'),
            feedActive ? brand.accent : undefined)}
          <div style={{ width: 1, alignSelf: 'stretch', background: p.border }} />
          {heroStat('Last nappy', sinceNappy === 'just now' ? 'just now' : sinceNappy || '—')}
          <div style={{ width: 1, alignSelf: 'stretch', background: p.border }} />
          {heroStat('Sleep',
            sleepActive ? fmtClock(sleepElapsed) : (sinceSleep === 'just now' ? 'just now' : sinceSleep || '—'),
            sleepActive ? brand.green : undefined)}
        </div>

        {/* Gentle next-feed / status cue, with a quiet path into Sage */}
        <div style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid ${p.border}`, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: feedActive || sleepActive ? brand.accent : brand.sand, flexShrink: 0 }} />
          <span style={{ fontSize: 12, color: p.sub, lineHeight: 1.4, flex: 1 }}>
            {feedActive
              ? `Feeding now · ${feedType === 'bottle' ? 'Bottle' : feedSide === 'L' ? 'Left side' : 'Right side'}`
              : sleepActive
                ? `${babyLabel} is sleeping`
                : nextFeed
                  ? `Next feed likely around ${nextFeed}`
                  : `Next feed: ${suggested === 'L' ? 'Left' : 'Right'} side`}
          </span>
          <button onClick={() => setScreen('chat')}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: brand.sand, fontSize: 11, fontWeight: 500, letterSpacing: '.02em', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 4 }}>
            ✦ Ask Sage
          </button>
        </div>
      </div>

      {/* ── Editorial quote ── */}
      <div style={{ padding: '12px 18px 2px' }}>
        <p style={{ fontSize: 14, color: p.sub, fontStyle: 'italic', lineHeight: 1.55, fontFamily: "'Cormorant Garamond', serif", margin: 0, textAlign: 'center' }}>
          "{quote}"
        </p>
      </div>

      {/* ── Feed timer card (primary quick-log) ── */}
      <div style={{ margin: '12px 14px 0', background: p.card, borderRadius: CARD_RADIUS, border: `1px solid ${p.border}` }}>
        <div style={{ padding: '12px 16px 0', display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: feedActive ? brand.accent : brand.sand, flexShrink: 0 }} />
          <span style={{ fontSize: 11, color: p.sub, letterSpacing: '.04em' }}>
            {feedActive
              ? feedType === 'bottle' ? 'Feeding · Bottle' : `Feeding · ${feedSide === 'L' ? 'Left' : 'Right'} side`
              : 'Start a feed'}
          </span>
        </div>

        {feedActive && (
          <div style={{ textAlign: 'center', padding: '14px 0 12px' }}>
            <span style={{ display: 'block', fontFamily: "'Cormorant Garamond', serif", fontSize: 64, fontWeight: 300, color: p.heading, lineHeight: 1, letterSpacing: '-2px' }}>
              {fmt(elapsed)}
            </span>
            <span style={{ display: 'block', fontSize: 10, color: p.sub, marginTop: 4, letterSpacing: '.08em', textTransform: 'uppercase' }}>
              in progress
            </span>
          </div>
        )}

        {!feedActive ? (
          <div style={{ display: 'flex', gap: 8, padding: '12px 14px 14px' }}>
            {['L', 'R'].map(side => {
              const isNext = side === suggested
              return (
                <button key={side} onClick={() => startFeed(side)}
                  style={{ flex: 1, minHeight: 60, borderRadius: 14, border: 'none', cursor: 'pointer', background: isNext ? brand.bark : p.bg, transition: 'all .2s', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
                  <span style={{ fontSize: 12, fontWeight: 500, letterSpacing: '.06em', textTransform: 'uppercase', color: isNext ? brand.sand : p.text }}>
                    {side === 'L' ? 'Left' : 'Right'}
                  </span>
                  {isNext && <span style={{ fontSize: 9, color: brand.sand }}>suggested</span>}
                </button>
              )
            })}
            <button onClick={() => startFeed(null, 'bottle')}
              style={{ flex: 1, minHeight: 60, borderRadius: 14, border: 'none', cursor: 'pointer', background: p.bg, transition: 'all .2s', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
              <span style={{ fontSize: 12, fontWeight: 500, letterSpacing: '.06em', textTransform: 'uppercase', color: p.text }}>
                🍼 Bottle
              </span>
            </button>
          </div>
        ) : (
          <div style={{ padding: '0 14px 14px' }}>
            {/* Mid-feed side switch — breast feeds only; keeps the clock running */}
            {feedType !== 'bottle' && (
              <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                {['L', 'R'].map(side => {
                  const isCurrent = side === feedSide
                  return (
                    <button key={side} onClick={() => switchSide(side)}
                      style={{ flex: 1, minHeight: 48, borderRadius: 13, border: `1.5px solid ${isCurrent ? brand.sand : p.border}`, cursor: 'pointer', background: isCurrent ? brand.bark : 'transparent', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1, transition: 'all .2s' }}>
                      <span style={{ fontSize: 12, fontWeight: 500, letterSpacing: '.06em', textTransform: 'uppercase', color: isCurrent ? brand.sand : p.sub }}>
                        {side === 'L' ? 'Left' : 'Right'}
                      </span>
                      {isCurrent && <span style={{ fontSize: 8, color: brand.sand, letterSpacing: '.04em' }}>on this side</span>}
                    </button>
                  )
                })}
              </div>
            )}
            <button onClick={handleStop}
              style={{ width: '100%', minHeight: 56, borderRadius: 14, border: `1.5px solid ${p.heading}`, cursor: 'pointer', background: 'transparent', color: p.heading, fontSize: 14, fontWeight: 500 }}>
              Finish feed
            </button>
          </div>
        )}
      </div>

      {/* ── Nappy + Sleep quick-log ── */}
      <div style={{ display: 'flex', gap: 10, padding: '12px 14px 0' }}>
        {/* Nappy */}
        <button onClick={() => setNappyOpen(o => !o)}
          style={{ flex: 1, minHeight: 60, borderRadius: 14, border: `1px solid ${p.border}`, background: nappyFlash ? brand.green : p.card, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3, transition: 'background .25s' }}>
          <span style={{ fontSize: 18, color: nappyFlash ? '#fff' : brand.accent, lineHeight: 1 }}>{nappyFlash ? '✓' : '◈'}</span>
          <span style={{ fontSize: 12, fontWeight: 500, color: nappyFlash ? '#fff' : p.text }}>{nappyFlash ? 'Logged' : 'Nappy'}</span>
        </button>
        {/* Sleep */}
        {sleepActive ? (
          <button onClick={handleSleepStop}
            style={{ flex: 1, minHeight: 60, borderRadius: 14, border: `1.5px solid ${brand.green}`, background: p.card, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3 }}>
            <span style={{ fontSize: 13, fontWeight: 500, color: brand.green, fontFamily: "'Cormorant Garamond', serif" }}>{fmtClock(sleepElapsed)}</span>
            <span style={{ fontSize: 11, color: p.sub }}>Tap when awake</span>
          </button>
        ) : (
          <button onClick={startSleep}
            style={{ flex: 1, minHeight: 60, borderRadius: 14, border: `1px solid ${p.border}`, background: p.card, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3 }}>
            <span style={{ fontSize: 18, color: brand.green, lineHeight: 1 }}>☾</span>
            <span style={{ fontSize: 12, fontWeight: 500, color: p.text }}>Sleep</span>
          </button>
        )}
      </div>

      {/* Nappy type picker — appears on tap, logs in one more tap */}
      {nappyOpen && (
        <div className="fade-up" style={{ display: 'flex', gap: 8, padding: '8px 14px 0' }}>
          {[['wet', '💧', 'Wee'], ['poo', '💩', 'Poo'], ['both', '💧💩', 'Both']].map(([t, emoji, label]) => (
            <button key={t} onClick={() => logNappy(t)}
              style={{ flex: 1, minHeight: 52, borderRadius: 13, border: `1px solid ${p.border}`, background: p.card, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3 }}>
              <span style={{ fontSize: t === 'both' ? 14 : 18, lineHeight: 1 }}>{emoji}</span>
              <span style={{ fontSize: 11, color: p.text, fontWeight: 500 }}>{label}</span>
            </button>
          ))}
        </div>
      )}

      {/* ── Partner flash ── */}
      {partnerFlash && (
        <div className="fade-up" style={{ margin: '12px 14px 0', background: brand.green, borderRadius: 12, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ color: '#fff', fontSize: 13 }}>✓</span>
          <span style={{ fontSize: 12, color: '#fff', fontWeight: 500 }}>Your partner can see this feed</span>
        </div>
      )}

      {/* ── Bottle amount check-in ── */}
      {showAmount && (
        <div className="fade-up" style={{ margin: '12px 14px 0', background: p.card, borderRadius: 14, border: `1px solid ${p.border}`, padding: '14px' }}>
          <span style={{ display: 'block', fontSize: 13, color: p.text, fontWeight: 500, marginBottom: 4 }}>How much did {babyLabel} take?</span>
          <span style={{ display: 'block', fontSize: 11, color: p.sub, marginBottom: 12 }}>This gets saved to your logbook.</span>
          <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
            {[60, 90, 120, 150].map(ml => (
              <button key={ml} onClick={() => setAmountInput(String(ml))}
                style={{ flex: 1, padding: '9px 0', borderRadius: 10, border: `1.5px solid ${amountInput === String(ml) ? brand.sand : p.border}`, background: amountInput === String(ml) ? brand.bark : 'transparent', cursor: 'pointer', fontSize: 12, color: amountInput === String(ml) ? brand.sand : p.sub, fontWeight: 500 }}>
                {ml}ml
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <input
              type="number" inputMode="numeric" min="1" max="500"
              value={amountInput}
              onChange={e => setAmountInput(e.target.value)}
              placeholder="Amount"
              style={{ flex: 1, background: p.bg, border: `1px solid ${p.border}`, borderRadius: 11, padding: '10px 12px', fontSize: 14, color: p.text, fontFamily: "'Jost', sans-serif", outline: 'none' }}
            />
            <span style={{ fontSize: 12, color: p.sub }}>ml</span>
          </div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            {[['expressed', 'Expressed'], ['formula', 'Formula']].map(([id, label]) => (
              <button key={id} onClick={() => setMilkInput(id)}
                style={{ flex: 1, padding: '10px 0', borderRadius: 11, border: `1.5px solid ${milkInput === id ? brand.sand : p.border}`, background: milkInput === id ? brand.bark : 'transparent', cursor: 'pointer', fontSize: 12, color: milkInput === id ? brand.sand : p.sub, fontWeight: 500 }}>
                {label}
              </button>
            ))}
          </div>
          <button onClick={saveAmount}
            style={{ width: '100%', padding: '12px', borderRadius: 12, border: 'none', background: brand.bark, cursor: 'pointer', fontSize: 13, color: brand.sand, fontWeight: 500 }}>
            Save
          </button>
          <button onClick={skipAmount}
            style={{ fontSize: 11, color: p.sub, background: 'none', border: 'none', cursor: 'pointer', marginTop: 10, letterSpacing: '.04em' }}>
            skip
          </button>
        </div>
      )}

      {/* ── Mood check-in ── */}
      {showMood && (
        <div className="fade-up" style={{ margin: '12px 14px 0', background: p.card, borderRadius: 14, border: `1px solid ${p.border}`, padding: '14px' }}>
          <span style={{ display: 'block', fontSize: 13, color: p.text, fontWeight: 500, marginBottom: 4 }}>How did that feed go?</span>
          <span style={{ display: 'block', fontSize: 11, color: p.sub, marginBottom: 12 }}>This gets saved to your logbook.</span>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            {[
              { emoji: '😔', label: 'Tough'   },
              { emoji: '😐', label: 'Okay'    },
              { emoji: '🙂', label: 'Good'    },
              { emoji: '😊', label: 'Great'   },
              { emoji: '🤩', label: 'Amazing' },
            ].map((m, i) => (
              <button key={i} onClick={() => saveMood(i + 1)}
                style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, background: 'none', border: 'none', cursor: 'pointer', padding: '4px 6px' }}>
                <span style={{ fontSize: 26 }}>{m.emoji}</span>
                <span style={{ fontSize: 9, color: p.sub }}>{m.label}</span>
              </button>
            ))}
          </div>
          <button onClick={skipMood}
            style={{ fontSize: 11, color: p.sub, background: 'none', border: 'none', cursor: 'pointer', marginTop: 10, letterSpacing: '.04em' }}>
            skip
          </button>
        </div>
      )}

      {/* ── Recent timeline preview ── */}
      <div style={{ padding: '16px 14px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <span style={{ fontSize: 10, color: p.sub, letterSpacing: '.08em', textTransform: 'uppercase' }}>Recent</span>
          <button onClick={() => setScreen('history')}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: brand.sand, fontWeight: 500 }}>
            Logbook ›
          </button>
        </div>
        {timeline.length === 0 ? (
          <span style={{ fontSize: 13, color: p.sub }}>Nothing logged yet. Start a feed, nappy or sleep above to begin.</span>
        ) : (
          timeline.map((e, i) => timelineRow(e, i === timeline.length - 1))
        )}
      </div>

      {/* ── Prepare to go out ── */}
      <button onClick={() => setScreen('prepare')}
        style={{ display: 'block', width: 'calc(100% - 28px)', margin: '16px 14px 0', background: p.card, borderRadius: 14, border: `1px solid ${p.border}`, padding: '12px 14px', cursor: 'pointer', textAlign: 'left', WebkitTapHighlightColor: 'transparent' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <span style={{ display: 'block', fontSize: 10, color: p.sub, letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 6 }}>
              Going out?
            </span>
            <span style={{ display: 'block', fontSize: 13, color: p.text, lineHeight: 1.45 }}>
              Run through the prepare checklist before you leave.
            </span>
            <span style={{ display: 'block', fontSize: 11, color: prepProgress.done === prepProgress.total && prepProgress.total > 0 ? brand.green : p.sub, marginTop: 6, fontWeight: 500 }}>
              {prepProgress.done === prepProgress.total && prepProgress.total > 0
                ? '✓ All packed'
                : `${prepProgress.done}/${prepProgress.total} packed`}
            </span>
          </div>
          <span style={{ color: p.sub, fontSize: 16, flexShrink: 0, marginLeft: 10 }}>›</span>
        </div>
      </button>

      {/* ── Sage entry point ── */}
      <button onClick={() => setScreen('chat')}
        style={{ display: 'block', width: 'calc(100% - 28px)', margin: '12px 14px 0', background: brand.bark, borderRadius: 14, border: 'none', padding: '14px', cursor: 'pointer', textAlign: 'left', WebkitTapHighlightColor: 'transparent' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ flex: 1, marginRight: 10 }}>
            <span style={{ display: 'block', fontSize: 10, color: brand.sand, letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 5 }}>
              ✦ Sage
            </span>
            <span style={{ display: 'block', fontSize: 13, color: brand.parchment, lineHeight: 1.45 }}>
              A knowledgeable friend who's always awake. Ask anything about feeding, day or night.
            </span>
          </div>
          <span style={{ color: brand.sand, fontSize: 16, flexShrink: 0 }}>›</span>
        </div>
      </button>

      {/* ── Instagram link ── */}
      <div style={{ padding: '20px 14px 28px', textAlign: 'center' }}>
        <a
          href="https://www.instagram.com/navaya.life"
          target="_blank"
          rel="noopener noreferrer"
          style={{ fontSize: 11, color: p.sub, textDecoration: 'none', letterSpacing: '.06em', display: 'inline-flex', alignItems: 'center', gap: 5, opacity: 0.7 }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/>
            <circle cx="12" cy="12" r="4"/>
            <circle cx="17.5" cy="6.5" r="0.5" fill="currentColor"/>
          </svg>
          @navaya.life
        </a>
      </div>

    </div>
  )
}
