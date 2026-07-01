import { useState, useRef, useEffect, useMemo } from 'react'
import { brand, palette } from '../theme.js'
import { getSessions, addSession, updateSession, deleteSession, babyDisplayName } from '../lib/storage.js'
import { syncWrite } from '../lib/sync.js'
import { fmt, fmtSince, fmtMins, dayShort } from '../utils/time.js'
import { normalizeFeedSession, isBottleFeed, feedTypeOf } from '../lib/normalize.js'
import { newId } from '../lib/id.js'

const sortByTime = arr => [...arr].sort((a, b) => new Date(b.startedAt) - new Date(a.startedAt))

function todayMidnight() {
  const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime()
}

// Dedicated feed tab — the timer plus feed-only context. Nappy and sleep
// logging live on their own tabs; this screen no longer duplicates them.
export default function FeedScreen({ night, timer, authUser, profile, sharedSessions, onSessionSaved }) {
  const p = palette(night)
  const { feedActive, feedSide, feedType, elapsed, startFeed, switchSide, stopFeed } = timer
  const sharedMode = !!(profile?.household_id && sharedSessions)

  const [sessions, setSessions] = useState(() => sortByTime(getSessions()))
  const [showMood,       setShowMood]      = useState(false)
  const [showAmount,     setShowAmount]    = useState(false)
  const [amountInput,    setAmountInput]   = useState('')
  const [milkInput,      setMilkInput]     = useState('expressed')
  const [pendingSession, setPending]       = useState(null)
  const [partnerFlash,   setPartnerFlash]  = useState(false)
  const [confirmDel,     setConfirmDel]    = useState(null)
  const [showAll,        setShowAll]       = useState(false)
  const flashTimersRef = useRef([])

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

  const saveAmount = () => {
    if (!pendingSession) return
    const parsed = Math.round(Number(amountInput))
    const amountMl = parsed >= 1 ? Math.min(500, parsed) : null
    const changes = { amountMl, milkType: milkInput }
    setSessions(sortByTime(updateSession(pendingSession.id, changes)))
    setPending(prev => (prev ? { ...prev, ...changes } : prev))
    const remote = pendingRemoteRef.current
    if (remote) {
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
    setShowAmount(false)
    setShowMood(true)
  }

  const handleDelete = (id) => {
    setSessions(sortByTime(deleteSession(id)))
    if (sharedMode) syncWrite('feed.delete', { id }).then(({ ok }) => { if (ok) onSessionSaved?.() })
    setConfirmDel(null)
  }

  return (
    <div style={{ flex: 1, overflowY: 'auto', background: p.bg }}>

      {/* Header */}
      <div style={{ padding: '20px 16px 12px' }}>
        <span style={{ display: 'block', fontFamily: "'Cormorant Garamond', serif", fontSize: 12, color: brand.sand, letterSpacing: '.12em', textTransform: 'uppercase' }}>Nourish &amp; nurture</span>
        <span style={{ display: 'block', fontFamily: "'Cormorant Garamond', serif", fontSize: 26, fontWeight: 400, color: p.heading, marginTop: 2 }}>Feed</span>
      </div>

      {/* Stats */}
      <div style={{ display: 'flex', gap: 8, padding: '0 14px 14px' }}>
        {[
          [todaySessions.length.toString(), 'feeds today'],
          [breastMinsToday > 0 ? `${breastMinsToday}m` : (bottleMlToday > 0 ? `${bottleMlToday}ml` : '—'), breastMinsToday > 0 ? 'breast today' : 'bottle today'],
          [timeSinceLast && timeSinceLast !== 'just now' ? timeSinceLast : (timeSinceLast === 'just now' ? 'now' : '—'), 'since last'],
        ].map(([val, lbl]) => (
          <div key={lbl} style={{ flex: 1, background: p.card, borderRadius: 13, padding: '11px 8px', border: `1px solid ${p.border}`, textAlign: 'center' }}>
            <span style={{ display: 'block', fontFamily: "'Cormorant Garamond', serif", fontSize: String(val).length > 6 ? 15 : 20, color: p.heading, lineHeight: 1.2 }}>{val}</span>
            <span style={{ display: 'block', fontSize: 9, color: p.sub, lineHeight: 1.3, marginTop: 3 }}>{lbl}</span>
          </div>
        ))}
      </div>

      {/* Feed timer card */}
      <div style={{ margin: '0 14px 14px', background: p.card, borderRadius: 18, border: `1px solid ${p.border}` }}>
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
                  style={{ flex: 1, minHeight: 60, borderRadius: 14, border: `1.5px solid ${isNext ? brand.sand : 'transparent'}`, cursor: 'pointer', background: isNext ? brand.bark : p.bg, transition: 'all .2s', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
                  <span style={{ fontSize: 12, fontWeight: 500, letterSpacing: '.06em', textTransform: 'uppercase', color: isNext ? brand.sand : p.text }}>
                    {side === 'L' ? 'Left' : 'Right'}
                  </span>
                </button>
              )
            })}
            <button onClick={() => startFeed(null, 'bottle')}
              style={{ flex: 1, minHeight: 60, borderRadius: 14, border: '1.5px solid transparent', cursor: 'pointer', background: p.bg, transition: 'all .2s', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
              <span style={{ fontSize: 12, fontWeight: 500, letterSpacing: '.06em', textTransform: 'uppercase', color: p.text }}>
                🍼 Bottle
              </span>
            </button>
          </div>
        ) : (
          <div style={{ padding: '0 14px 14px' }}>
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

      {/* Partner flash */}
      {partnerFlash && (
        <div className="fade-up" style={{ margin: '0 14px 14px', background: brand.green, borderRadius: 12, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ color: '#fff', fontSize: 13 }}>✓</span>
          <span style={{ fontSize: 12, color: '#fff', fontWeight: 500 }}>Your partner can see this feed</span>
        </div>
      )}

      {/* Bottle amount check-in */}
      {showAmount && (
        <div className="fade-up" style={{ margin: '0 14px 14px', background: p.card, borderRadius: 14, border: `1px solid ${p.border}`, padding: '14px' }}>
          <span style={{ display: 'block', fontSize: 13, color: p.text, fontWeight: 500, marginBottom: 4 }}>How much did {babyDisplayName()} take?</span>
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

      {/* Mood check-in */}
      {showMood && (
        <div className="fade-up" style={{ margin: '0 14px 14px', background: p.card, borderRadius: 14, border: `1px solid ${p.border}`, padding: '14px' }}>
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

      {/* Recent feeds */}
      <div style={{ padding: '0 14px' }}>
        <span style={{ display: 'block', fontSize: 10, color: p.sub, letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 10 }}>Recent</span>

        {sessions.length === 0 ? (
          <span style={{ fontSize: 13, color: p.sub }}>No feeds logged yet. Tap Left, Right or Bottle above to start.</span>
        ) : (
          (showAll ? sessions : sessions.slice(0, 5)).map((s, i, shown) => {
            const canDelete = !sharedMode || !s.loggedBy || s.loggedBy === authUser?.id
            const bottle = isBottleFeed(s)
            return (
              <div key={s.id} style={{
                display: 'flex', alignItems: 'center', padding: '10px 0',
                borderBottom: i < shown.length - 1 ? `1px solid ${p.border}` : 'none',
              }}>
                <div style={{ width: 26, height: 26, borderRadius: '50%', background: p.card, border: `1px solid ${p.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: 10, flexShrink: 0, fontSize: 12 }}>
                  {bottle ? '🍼' : '🤱'}
                </div>
                <div style={{ flex: 1 }}>
                  <span style={{ display: 'block', fontSize: 13, color: p.text, fontWeight: 500 }}>
                    {bottle ? (s.amountMl ? `${s.amountMl}ml` : 'Bottle') : `${s.side === 'L' ? 'Left' : 'Right'} · ${fmtMins(s.durationSecs || 0)}`}
                  </span>
                  <span style={{ display: 'block', fontSize: 11, color: p.sub }}>{fmtSince(s.startedAt)} ago</span>
                </div>
                <div style={{ textAlign: 'right', marginRight: 12 }}>
                  <span style={{ display: 'block', fontSize: 11, color: p.sub }}>{dayShort(s.startedAt)}</span>
                </div>
                {canDelete && (confirmDel === s.id ? (
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    <button onClick={() => setConfirmDel(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: p.sub, padding: '2px 6px' }}>Cancel</button>
                    <button onClick={() => handleDelete(s.id)} style={{ background: '#c0392b', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 11, color: '#fff', padding: '2px 8px', fontWeight: 500 }}>Delete</button>
                  </div>
                ) : (
                  <button onClick={() => setConfirmDel(s.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 17, color: p.sub, padding: '0 2px', lineHeight: 1, flexShrink: 0 }}>×</button>
                ))}
              </div>
            )
          })
        )}

        {sessions.length > 5 && (
          <button onClick={() => setShowAll(v => !v)}
            style={{ width: '100%', marginTop: 10, padding: '10px', borderRadius: 11, border: `1px solid ${p.border}`, background: 'transparent', cursor: 'pointer', fontSize: 12, color: p.sub, fontWeight: 500 }}>
            {showAll ? 'Show fewer' : `Show all ${sessions.length}`}
          </button>
        )}
      </div>

      <div style={{ height: 24 }} />
    </div>
  )
}
