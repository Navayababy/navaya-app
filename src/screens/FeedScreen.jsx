import { useState, useRef, useEffect, useMemo } from 'react'
import { brand, palette, shadow, iconWellBg } from '../theme.js'
import { getSessions, addSession, updateSession, babyDisplayName } from '../lib/storage.js'
import { syncWrite } from '../lib/sync.js'
import { fmt, fmtSince, timeStr, nearestDateForTime } from '../utils/time.js'
import { normalizeFeedSession, isBottleFeed, feedTypeOf } from '../lib/normalize.js'
import { newId } from '../lib/id.js'
import { useOneTimeHint } from '../hooks/useOneTimeHint.js'
import { BottleIcon } from '../components/icons.jsx'

const sortByTime = arr => [...arr].sort((a, b) => new Date(b.startedAt) - new Date(a.startedAt))

function todayMidnight() {
  const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime()
}

// Dedicated feed tab — the timer plus feed-only context. Nappy and sleep
// logging live on their own tabs; this screen no longer duplicates them.
// No history list here — that's what the Logbook is for; this screen is
// only for logging, spread out and easy to use one-handed.
export default function FeedScreen({ night, timer, authUser, profile, sharedSessions, onSessionSaved }) {
  const p = palette(night)
  const { feedActive, feedSide, feedType, elapsed, startFeed, switchSide, stopFeed } = timer

  const [sessions, setSessions] = useState(() => sortByTime(getSessions()))
  const [showMood,       setShowMood]      = useState(false)
  // Bottles aren't timed — tapping Bottle opens this quick-log card instead
  // (time defaulting to now, amount, milk type, optional duration). The
  // duration of a bottle feed rarely matters; the quantity and method do.
  const [showBottleLog,  setShowBottleLog] = useState(false)
  const [bottleTime,     setBottleTime]    = useState('')
  const [bottleDuration, setBottleDuration] = useState('')
  const [amountInput,    setAmountInput]   = useState('')
  const [milkInput,      setMilkInput]     = useState('expressed')
  const [pendingSession, setPending]       = useState(null)
  const [partnerFlash,   setPartnerFlash]  = useState(false)
  // Confirm both the start and end time before moving on — the start is the
  // one most likely to be off (the timer is often tapped on a little after
  // the feed actually began), so the end time alone isn't enough to fix.
  // Only breast feeds reach this step now — bottles aren't timed at all.
  const [showEndTimeConfirm, setShowEndTimeConfirm] = useState(false)
  const [confirmStartTime,   setConfirmStartTime]    = useState('')
  const [confirmEndTime,     setConfirmEndTime]      = useState('')
  const flashTimersRef = useRef([])
  // One-time note for shared households — the counterpart of SleepScreen's
  // sync hint: a running feed timer is local to this device, unlike sleep,
  // and the "partner can see this feed" flash only appears after saving.
  const [feedSyncHintUnseen, dismissFeedSyncHint] = useOneTimeHint('feed_sync_hint_seen')
  const showFeedSyncHint = feedSyncHintUnseen && !!(authUser && profile?.household_id)

  useEffect(() => {
    if (!sharedSessions) return
    if (pendingSession) return
    setSessions(sortByTime(sharedSessions.map(normalizeFeedSession)))
  }, [sharedSessions, pendingSession])

  // Re-render every 30s so "since" times stay current while the screen is open
  const [, setClockTick] = useState(0)
  useEffect(() => {
    const tick = setInterval(() => setClockTick(t => t + 1), 30000)
    return () => clearInterval(tick)
  }, [])

  const lastSession = sessions[0] || null
  // Suggest the opposite of the last breast feed — bottle feeds don't count
  const lastBreast  = sessions.find(s => !isBottleFeed(s)) || null
  const lastSide    = lastBreast?.side || 'R'
  const suggested   = lastSide === 'L' ? 'R' : 'L'

  const timeSinceLast = lastSession?.endedAt && !feedActive
    ? fmtSince(lastSession.endedAt)
    : null

  const todaySessions = useMemo(() => {
    const start = todayMidnight()
    return sessions.filter(s => new Date(s.startedAt).getTime() >= start)
  }, [sessions])

  const breastMinsToday = useMemo(() =>
    Math.round(todaySessions.filter(s => !isBottleFeed(s)).reduce((a, s) => a + (s.durationSecs || 0), 0) / 60)
  , [todaySessions])
  const bottleMlToday = useMemo(() =>
    todaySessions.filter(isBottleFeed).reduce((a, s) => a + (s.amountMl || 0), 0)
  , [todaySessions])

  const pendingRemoteRef = useRef(null)

  // The feed is saved the moment it stops — the mood check-in only patches it
  // afterwards, so navigating away or closing the app can never lose the feed.
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
        flashTimersRef.current.forEach(clearTimeout)
        setPartnerFlash(true)
        flashTimersRef.current = [setTimeout(() => setPartnerFlash(false), 3100)]
        return ok
      })
    }

    setPending(session)
    setConfirmStartTime(timeStr(session.startedAt))
    setConfirmEndTime(timeStr(session.endedAt))
    // A new stop supersedes any check-in card still open from a previous
    // feed — pendingSession now points at this feed, so a stale card would
    // save its answers onto the wrong session (or null the pending session
    // before this feed's own card could save at all).
    setShowMood(false)
    setShowBottleLog(false)
    setShowEndTimeConfirm(true)
  }

  // Starting a timed feed while the bottle card is still open (unsaved)
  // discards it — otherwise its stale inputs stay on screen through the
  // whole timed feed and a later tap on its Save creates a second, bogus
  // bottle entry alongside whatever the timer produces.
  const startTimerFeed = (side) => {
    setShowBottleLog(false)
    startFeed(side)
  }

  // Bottle quick log — opens the card; nothing is created until Save.
  const openBottleLog = () => {
    setAmountInput('')
    setMilkInput('expressed')
    setBottleTime(timeStr())
    setBottleDuration('')
    // Same stale-card rule as handleStop: one check-in on screen at a time.
    setShowMood(false)
    setShowEndTimeConfirm(false)
    setShowBottleLog(true)
  }

  // Saves the bottle feed in one go — unlike a timed feed there's no open
  // session to patch, so this is the moment it reaches the logbook (and the
  // household, in a single insert). The entered time is treated as when the
  // feed ended (when you're logging it), not when it started — a duration
  // then counts backward from there. Anchoring on the end instead of the
  // start keeps endedAt from landing in the future, which would otherwise
  // make the feed look not-yet-finished in "since last feed" stats that
  // read lastSession.endedAt.
  const saveBottleLog = () => {
    const parsed = Math.round(Number(amountInput))
    const amountMl = parsed >= 1 ? Math.min(500, parsed) : null
    const mins = Math.round(Number(bottleDuration))
    const durationSecs = mins >= 1 ? Math.min(mins, 24 * 60) * 60 : 0
    const endedAt = nearestDateForTime(new Date().toISOString(), bottleTime)
    const startedAt = new Date(new Date(endedAt).getTime() - durationSecs * 1000).toISOString()
    const session = { id: newId(), startedAt, endedAt, durationSecs, side: null, feedType: 'bottle', amountMl, milkType: milkInput, mood: null }
    setSessions(sortByTime(addSession(session)))

    pendingRemoteRef.current = null
    if (authUser && profile?.household_id) {
      pendingRemoteRef.current = syncWrite('feed.insert', {
        id:           session.id,
        householdId:  profile.household_id,
        babyId:       null,
        loggedBy:     authUser.id,
        startedAt,
        endedAt,
        durationSecs,
        side:         null,
        moodScore:    null,
        feedType:     'bottle',
        amountMl,
        milkType:     milkInput,
      }).then(({ ok }) => {
        if (!ok) return ok // queued for retry — the flash would be a lie
        onSessionSaved?.()
        flashTimersRef.current.forEach(clearTimeout)
        setPartnerFlash(true)
        flashTimersRef.current = [setTimeout(() => setPartnerFlash(false), 3100)]
        return ok
      })
    }

    setShowBottleLog(false)
    setPending(session)
    setShowMood(true)
  }

  useEffect(() => () => flashTimersRef.current.forEach(clearTimeout), [])

  // The feed is already saved (with the raw start/stop times) by the time
  // this runs — confirming just patches whichever times needed adjusting,
  // then moves on to the amount/mood check-in exactly as before.
  const confirmFeedEndTime = () => {
    if (!pendingSession) return
    // Each edited time is re-dated against its own original instant, so a
    // correction that pushes the start (or end) across a midnight boundary —
    // in either direction — lands on the right day rather than inheriting
    // the original, now-wrong date.
    const startedAt = nearestDateForTime(pendingSession.startedAt, confirmStartTime)
    let endedAt = nearestDateForTime(pendingSession.endedAt, confirmEndTime)
    // Safety net for the (now rare) case the corrected times end up out of
    // order — never save a negative-duration feed. Strictly earlier only:
    // a feed shorter than a minute confirms with equal times, and treating
    // that as midnight-crossing turned a 40-second latch into a 24-hour feed.
    if (new Date(endedAt) < new Date(startedAt)) {
      const d = new Date(endedAt)
      d.setDate(d.getDate() + 1)
      endedAt = d.toISOString()
    }
    const durationSecs = Math.max(0, Math.round((new Date(endedAt) - new Date(startedAt)) / 1000))
    const changes = { startedAt, endedAt, durationSecs }
    setSessions(sortByTime(updateSession(pendingSession.id, changes)))
    setPending(prev => (prev ? { ...prev, ...changes } : prev))
    const remote = pendingRemoteRef.current
    if (remote) {
      remote.then(() => {
        syncWrite('feed.update', {
          id:           pendingSession.id,
          side:         pendingSession.side,
          startedAt,
          endedAt,
          durationSecs,
          moodScore:    pendingSession.mood ?? null,
          feedType:     feedTypeOf(pendingSession),
          amountMl:     pendingSession.amountMl ?? null,
          milkType:     pendingSession.milkType ?? null,
        }).then(({ ok }) => { if (ok) onSessionSaved?.() })
      })
    }
    setShowEndTimeConfirm(false)
    setShowMood(true)
  }

  const saveMood = (mood) => {
    if (!pendingSession) return
    setSessions(sortByTime(updateSession(pendingSession.id, { mood })))
    const remote = pendingRemoteRef.current
    if (remote) {
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
    setPending(null)
    setShowMood(false)
  }

  return (
    <div style={{ flex: 1, overflowY: 'auto', background: p.bg }}>
      <div style={{ minHeight: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-evenly', padding: '12px 0' }}>

      {/* Header */}
      <div style={{ padding: '8px 16px 16px', textAlign: 'center' }}>
        <div style={{ width: 52, height: 52, borderRadius: '50%', background: iconWellBg(brand.accent), boxShadow: shadow(night, 1), display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
          <BottleIcon color={brand.accent} size={26} />
        </div>
        <span style={{ display: 'block', fontFamily: "'Cormorant Garamond', serif", fontSize: 12, color: brand.sand, letterSpacing: '.12em', textTransform: 'uppercase' }}>Nourish &amp; nurture</span>
        <span style={{ display: 'block', fontFamily: "'Cormorant Garamond', serif", fontSize: 34, fontWeight: 400, color: p.heading, marginTop: 4 }}>Feed</span>
      </div>

      {/* Stats — bigger, roomier tiles */}
      <div style={{ display: 'flex', gap: 10, padding: '0 16px 20px' }}>
        {[
          [todaySessions.length.toString(), 'feeds today'],
          [breastMinsToday > 0 ? `${breastMinsToday}m` : (bottleMlToday > 0 ? `${bottleMlToday}ml` : '—'), breastMinsToday > 0 ? 'breast today' : 'bottle today'],
          [timeSinceLast && timeSinceLast !== 'just now' ? timeSinceLast : (timeSinceLast === 'just now' ? 'now' : '—'), 'since last'],
        ].map(([val, lbl]) => (
          <div key={lbl} style={{ flex: 1, background: p.card, borderRadius: 16, padding: '18px 8px', border: `1px solid ${p.border}`, boxShadow: shadow(night, 1), textAlign: 'center' }}>
            <span style={{ display: 'block', fontFamily: "'Cormorant Garamond', serif", fontSize: String(val).length > 6 ? 20 : 28, color: p.heading, lineHeight: 1.2 }}>{val}</span>
            <span style={{ display: 'block', fontSize: 11, color: p.sub, lineHeight: 1.3, marginTop: 5 }}>{lbl}</span>
          </div>
        ))}
      </div>

      {/* ── One-time shared-household note, same pattern as the sleep hint ── */}
      {showFeedSyncHint && (
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, margin: '0 16px 16px', padding: '11px 13px', background: p.card, border: `1px solid ${p.border}`, borderRadius: 14, boxShadow: shadow(night, 1) }}>
          <span style={{ flex: 1, fontSize: 11, color: p.sub, lineHeight: 1.5 }}>
            A feed timer only shows on this phone while it&apos;s running — your partner sees the feed in the shared logbook once you finish it.
          </span>
          <button onClick={dismissFeedSyncHint} aria-label="Dismiss"
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: p.sub, lineHeight: 1, padding: 0, flexShrink: 0 }}>
            ×
          </button>
        </div>
      )}

      {/* Feed timer card */}
      <div style={{ margin: '0 16px 16px', background: p.card, borderRadius: 20, border: `1px solid ${p.border}`, boxShadow: shadow(night, 2) }}>
        <div style={{ padding: '16px 18px 0', display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: feedActive ? brand.accent : brand.sand, flexShrink: 0 }} />
          <span style={{ fontSize: 12, color: p.sub, letterSpacing: '.04em' }}>
            {feedActive
              ? feedType === 'bottle' ? 'Feeding · Bottle' : `Feeding · ${feedSide === 'L' ? 'Left' : 'Right'} side`
              : 'Start a feed'}
          </span>
        </div>

        {feedActive && (
          <div style={{ textAlign: 'center', padding: '18px 0 14px' }}>
            <span style={{ display: 'block', fontFamily: "'Cormorant Garamond', serif", fontSize: 68, fontWeight: 300, color: p.heading, lineHeight: 1, letterSpacing: '-2px' }}>
              {fmt(elapsed)}
            </span>
            <span style={{ display: 'block', fontSize: 10, color: p.sub, marginTop: 4, letterSpacing: '.08em', textTransform: 'uppercase' }}>
              in progress
            </span>
          </div>
        )}

        {!feedActive ? (
          <div style={{ display: 'flex', gap: 10, padding: '16px 16px 18px' }}>
            {['L', 'R'].map(side => {
              const isNext = side === suggested
              return (
                <button key={side} onClick={() => startTimerFeed(side)}
                  style={{ flex: 1, minHeight: 84, borderRadius: 16, border: `1.5px solid ${isNext ? brand.sand : 'transparent'}`, cursor: 'pointer', background: isNext ? brand.barkGradient : p.bg, boxShadow: isNext ? shadow(night, 1) : 'none', transition: 'all .2s', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
                  <span style={{ fontSize: 15, fontWeight: 600, letterSpacing: '.06em', textTransform: 'uppercase', color: isNext ? brand.sand : p.text }}>
                    {side === 'L' ? 'Left' : 'Right'}
                  </span>
                  {isNext && (
                    <span style={{ fontSize: 9, color: brand.sand, letterSpacing: '.04em' }}>suggested</span>
                  )}
                </button>
              )
            })}
            {/* Bottles aren't timed — this opens the quick-log card below
                rather than starting the timer */}
            <button onClick={openBottleLog}
              style={{ flex: 1, minHeight: 84, borderRadius: 16, border: `1.5px solid ${showBottleLog ? brand.sand : 'transparent'}`, cursor: 'pointer', background: showBottleLog ? brand.barkGradient : p.bg, boxShadow: showBottleLog ? shadow(night, 1) : 'none', transition: 'all .2s', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
              <BottleIcon color={showBottleLog ? brand.sand : p.text} size={18} />
              <span style={{ fontSize: 15, fontWeight: 600, letterSpacing: '.06em', textTransform: 'uppercase', color: showBottleLog ? brand.sand : p.text }}>
                Bottle
              </span>
            </button>
          </div>
        ) : (
          <div style={{ padding: '0 16px 18px' }}>
            {feedType !== 'bottle' && (
              <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
                {['L', 'R'].map(side => {
                  const isCurrent = side === feedSide
                  return (
                    <button key={side} onClick={() => switchSide(side)}
                      style={{ flex: 1, minHeight: 64, borderRadius: 14, border: `1.5px solid ${isCurrent ? brand.sand : p.border}`, cursor: 'pointer', background: isCurrent ? brand.barkGradient : 'transparent', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2, transition: 'all .2s' }}>
                      <span style={{ fontSize: 14, fontWeight: 600, letterSpacing: '.06em', textTransform: 'uppercase', color: isCurrent ? brand.sand : p.sub }}>
                        {side === 'L' ? 'Left' : 'Right'}
                      </span>
                      {isCurrent && <span style={{ fontSize: 9, color: brand.sand, letterSpacing: '.04em' }}>on this side</span>}
                    </button>
                  )
                })}
              </div>
            )}
            <button onClick={handleStop}
              style={{ width: '100%', minHeight: 64, borderRadius: 16, border: `1.5px solid ${p.heading}`, cursor: 'pointer', background: 'transparent', color: p.heading, fontSize: 16, fontWeight: 600 }}>
              Finish feed
            </button>
          </div>
        )}
      </div>

      {/* Partner flash */}
      {partnerFlash && (
        <div className="fade-up" style={{ margin: '0 16px 16px', background: brand.green, borderRadius: 14, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ color: '#fff', fontSize: 13 }}>✓</span>
          <span style={{ fontSize: 13, color: '#fff', fontWeight: 500 }}>Your partner can see this feed</span>
        </div>
      )}

      {/* Confirm the start and end time before moving on — the start is the
          one most likely to be off, since the timer is often tapped on a
          little after the feed actually began. */}
      {showEndTimeConfirm && (
        <div className="fade-up" style={{ margin: '0 16px 16px', background: p.card, borderRadius: 16, border: `1px solid ${p.border}`, boxShadow: shadow(night, 1), padding: '16px' }}>
          <span style={{ display: 'block', fontSize: 14, color: p.text, fontWeight: 500, marginBottom: 4 }}>Did the feed start and end around these times?</span>
          <span style={{ display: 'block', fontSize: 12, color: p.sub, marginBottom: 14 }}>Adjust either if the timer was started or stopped a little late.</span>
          <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
            <div style={{ flex: 1 }}>
              <span style={{ display: 'block', fontSize: 11, color: p.sub, marginBottom: 6, letterSpacing: '.04em', textTransform: 'uppercase' }}>Started</span>
              <input
                type="time" value={confirmStartTime}
                onChange={e => setConfirmStartTime(e.target.value)}
                style={{ width: '100%', background: p.bg, border: `1px solid ${p.border}`, borderRadius: 12, padding: '12px 8px', fontSize: 18, textAlign: 'center', color: p.text, fontFamily: "'Jost', sans-serif", outline: 'none', boxSizing: 'border-box' }}
              />
            </div>
            <div style={{ flex: 1 }}>
              <span style={{ display: 'block', fontSize: 11, color: p.sub, marginBottom: 6, letterSpacing: '.04em', textTransform: 'uppercase' }}>Ended</span>
              <input
                type="time" value={confirmEndTime}
                onChange={e => setConfirmEndTime(e.target.value)}
                style={{ width: '100%', background: p.bg, border: `1px solid ${p.border}`, borderRadius: 12, padding: '12px 8px', fontSize: 18, textAlign: 'center', color: p.text, fontFamily: "'Jost', sans-serif", outline: 'none', boxSizing: 'border-box' }}
              />
            </div>
          </div>
          <button onClick={confirmFeedEndTime}
            style={{ width: '100%', padding: '14px', borderRadius: 13, border: 'none', background: brand.barkGradient, boxShadow: shadow(night, 1), cursor: 'pointer', fontSize: 14, color: brand.sand, fontWeight: 600 }}>
            Confirm
          </button>
        </div>
      )}

      {/* Bottle quick log — no timer: the quantity and milk type are what a
          bottle feed is about. Time defaults to now; duration is optional. */}
      {showBottleLog && (
        <div className="fade-up" style={{ margin: '0 16px 16px', background: p.card, borderRadius: 16, border: `1px solid ${p.border}`, boxShadow: shadow(night, 1), padding: '16px' }}>
          <span style={{ display: 'block', fontSize: 14, color: p.text, fontWeight: 500, marginBottom: 4 }}>How much did {babyDisplayName()} take?</span>
          <span style={{ display: 'block', fontSize: 12, color: p.sub, marginBottom: 14 }}>Saved to your logbook when you tap Save.</span>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            {[60, 90, 120, 150].map(ml => (
              <button key={ml} onClick={() => setAmountInput(String(ml))}
                style={{ flex: 1, padding: '11px 0', borderRadius: 12, border: `1.5px solid ${amountInput === String(ml) ? brand.sand : p.border}`, background: amountInput === String(ml) ? brand.bark : 'transparent', cursor: 'pointer', fontSize: 13, color: amountInput === String(ml) ? brand.sand : p.sub, fontWeight: 500 }}>
                {ml}ml
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <input
              type="number" inputMode="numeric" min="1" max="500"
              value={amountInput}
              onChange={e => setAmountInput(e.target.value)}
              placeholder="Amount"
              style={{ flex: 1, background: p.bg, border: `1px solid ${p.border}`, borderRadius: 12, padding: '12px 14px', fontSize: 15, color: p.text, fontFamily: "'Jost', sans-serif", outline: 'none' }}
            />
            <span style={{ fontSize: 13, color: p.sub }}>ml</span>
          </div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
            {[['expressed', 'Expressed'], ['formula', 'Formula']].map(([id, label]) => (
              <button key={id} onClick={() => setMilkInput(id)}
                style={{ flex: 1, padding: '12px 0', borderRadius: 12, border: `1.5px solid ${milkInput === id ? brand.sand : p.border}`, background: milkInput === id ? brand.bark : 'transparent', cursor: 'pointer', fontSize: 13, color: milkInput === id ? brand.sand : p.sub, fontWeight: 500 }}>
                {label}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
            <div style={{ flex: 1 }}>
              <span style={{ display: 'block', fontSize: 11, color: p.sub, marginBottom: 6, letterSpacing: '.04em', textTransform: 'uppercase' }}>Time</span>
              <input
                type="time" value={bottleTime}
                onChange={e => setBottleTime(e.target.value)}
                style={{ width: '100%', background: p.bg, border: `1px solid ${p.border}`, borderRadius: 12, padding: '12px 8px', fontSize: 15, textAlign: 'center', color: p.text, fontFamily: "'Jost', sans-serif", outline: 'none', boxSizing: 'border-box' }}
              />
            </div>
            <div style={{ flex: 1 }}>
              <span style={{ display: 'block', fontSize: 11, color: p.sub, marginBottom: 6, letterSpacing: '.04em', textTransform: 'uppercase' }}>Mins (optional)</span>
              <input
                type="number" inputMode="numeric" min="1" max="180"
                value={bottleDuration}
                onChange={e => setBottleDuration(e.target.value)}
                placeholder="—"
                style={{ width: '100%', background: p.bg, border: `1px solid ${p.border}`, borderRadius: 12, padding: '12px 8px', fontSize: 15, textAlign: 'center', color: p.text, fontFamily: "'Jost', sans-serif", outline: 'none', boxSizing: 'border-box' }}
              />
            </div>
          </div>
          <button onClick={saveBottleLog}
            style={{ width: '100%', padding: '14px', borderRadius: 13, border: 'none', background: brand.barkGradient, boxShadow: shadow(night, 1), cursor: 'pointer', fontSize: 14, color: brand.sand, fontWeight: 600 }}>
            Save
          </button>
          <button onClick={() => setShowBottleLog(false)}
            style={{ fontSize: 12, color: p.sub, background: 'none', border: 'none', cursor: 'pointer', marginTop: 12, letterSpacing: '.04em' }}>
            cancel
          </button>
        </div>
      )}

      {/* Mood check-in */}
      {showMood && (
        <div className="fade-up" style={{ margin: '0 16px 16px', background: p.card, borderRadius: 16, border: `1px solid ${p.border}`, boxShadow: shadow(night, 1), padding: '16px' }}>
          <span style={{ display: 'block', fontSize: 14, color: p.text, fontWeight: 500, marginBottom: 4 }}>How did that feed go?</span>
          <span style={{ display: 'block', fontSize: 12, color: p.sub, marginBottom: 14 }}>Your feed is already saved — this just adds extra detail.</span>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            {[
              { emoji: '😔', label: 'Tough'   },
              { emoji: '😐', label: 'Okay'    },
              { emoji: '🙂', label: 'Good'    },
              { emoji: '😊', label: 'Great'   },
              { emoji: '🤩', label: 'Amazing' },
            ].map((m, i) => (
              <button key={i} onClick={() => saveMood(i + 1)}
                style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, background: 'none', border: 'none', cursor: 'pointer', padding: '4px 6px' }}>
                <span style={{ fontSize: 28 }}>{m.emoji}</span>
                <span style={{ fontSize: 10, color: p.sub }}>{m.label}</span>
              </button>
            ))}
          </div>
          <button onClick={skipMood}
            style={{ fontSize: 12, color: p.sub, background: 'none', border: 'none', cursor: 'pointer', marginTop: 12, letterSpacing: '.04em' }}>
            skip
          </button>
        </div>
      )}

      </div>
    </div>
  )
}
