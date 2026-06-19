import { useState, useEffect, useMemo } from 'react'
import { brand, palette } from '../theme.js'
import { getSleeps, addSleep, deleteSleep, babyDisplayName } from '../lib/storage.js'
import { syncWrite } from '../lib/sync.js'
import { normalizeSleep } from '../lib/normalize.js'
import { sleepSecsOnDay } from '../lib/stats.js'
import { fmtMins, fmtSince, timeAgo, timeStr, dateStr, buildISO, dayShort } from '../utils/time.js'
import { newId } from '../lib/id.js'

// h:mm:ss for long-running sleeps, mm:ss under an hour
function fmtClock(secs) {
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  const s = secs % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function fmtRange(sleep) {
  return `${timeStr(sleep.startedAt)} – ${timeStr(sleep.endedAt)}`
}

export default function SleepScreen({ night, timer, authUser, profile, sharedSleeps, onSleepSaved }) {
  const p = palette(night)
  const { sleepActive, sleepElapsed, startSleep, stopSleep } = timer
  const sharedMode = !!(profile?.household_id && sharedSleeps)

  const [sleeps,     setSleeps]     = useState(() => getSleeps())
  const [addingPast, setAddingPast] = useState(false)
  const [logDate,    setLogDate]    = useState(() => dateStr())
  const [startTime,  setStartTime]  = useState('13:00')
  const [endTime,    setEndTime]    = useState('14:00')
  const [confirmDel, setConfirmDel] = useState(null)
  const [showAll,    setShowAll]    = useState(false)

  // Keep the list in sync with shared sleeps when in shared mode.
  // Skipped while the user is composing a manual entry.
  useEffect(() => {
    if (!sharedSleeps) return
    if (addingPast) return
    setSleeps(sharedSleeps.map(normalizeSleep))
  }, [sharedSleeps, addingPast])

  // Re-render every 30s so the relative times stay current
  const [, setClockTick] = useState(0)
  useEffect(() => {
    const tick = setInterval(() => setClockTick(t => t + 1), 30000)
    return () => clearInterval(tick)
  }, [])

  const lastSleep = useMemo(() =>
    sleeps.reduce((latest, s) =>
      !latest || new Date(s.endedAt) > new Date(latest.endedAt) ? s : latest
    , null)
  , [sleeps])

  // Clamped to today's boundary: an overnight 22:00–06:00 sleep contributes
  // only the after-midnight portion to today's total.
  const todaySecs = useMemo(() => sleepSecsOnDay(sleeps), [sleeps])

  // "2h 14m since last sleep" — mirrors the feed card's since-last-feed line
  const timeSinceLast = lastSleep?.endedAt && !sleepActive
    ? fmtSince(lastSleep.endedAt)
    : null

  const shareSleep = (sleep) => {
    if (!authUser || !profile?.household_id) return
    syncWrite('sleep.insert', {
      id:           sleep.id,
      householdId:  profile.household_id,
      loggedBy:     authUser.id,
      startedAt:    sleep.startedAt,
      endedAt:      sleep.endedAt,
      durationSecs: sleep.durationSecs,
    }).then(({ ok }) => { if (ok) onSleepSaved?.() })
  }

  const handleStop = () => {
    const sleepData = stopSleep()
    const sleep = { id: newId(), ...sleepData }
    setSleeps(addSleep(sleep))
    shareSleep(sleep)
  }

  const handleAddPast = () => {
    const startedAt = buildISO(logDate, startTime)
    let endedAt = buildISO(logDate, endTime)
    // An end time earlier than the start time means the sleep crossed midnight
    if (new Date(endedAt) <= new Date(startedAt)) {
      const d = new Date(endedAt)
      d.setDate(d.getDate() + 1)
      endedAt = d.toISOString()
    }
    const durationSecs = Math.max(0, Math.round((new Date(endedAt) - new Date(startedAt)) / 1000))
    const sleep = { id: newId(), startedAt, endedAt, durationSecs }
    setSleeps(addSleep(sleep))
    shareSleep(sleep)
    setAddingPast(false)
    setLogDate(dateStr())
  }

  const handleDelete = (id) => {
    setSleeps(deleteSleep(id))
    if (sharedMode) syncWrite('sleep.delete', { id }).then(({ ok }) => { if (ok) onSleepSaved?.() })
    setConfirmDel(null)
  }

  const inputStyle = {
    background: p.bg, border: `1px solid ${p.border}`, borderRadius: 11,
    padding: '10px 12px', fontSize: 14, color: p.text,
    fontFamily: "'Jost', sans-serif", outline: 'none',
  }

  return (
    <div style={{ flex: 1, overflowY: 'auto', background: p.bg }}>

      {/* Header */}
      <div style={{ padding: '20px 16px 12px' }}>
        <span style={{ display: 'block', fontFamily: "'Cormorant Garamond', serif", fontSize: 12, color: brand.sand, letterSpacing: '.12em', textTransform: 'uppercase' }}>Rest &amp; recharge</span>
        <span style={{ display: 'block', fontFamily: "'Cormorant Garamond', serif", fontSize: 26, fontWeight: 400, color: p.heading, marginTop: 2 }}>Sleep</span>
      </div>

      {/* Stats */}
      <div style={{ display: 'flex', gap: 8, padding: '0 14px 14px' }}>
        {[
          [todaySecs > 0 ? fmtMins(todaySecs) : '—', 'sleep today'],
          [lastSleep ? fmtMins(lastSleep.durationSecs || 0) : '—', 'last sleep'],
          [lastSleep && !sleepActive ? timeAgo(lastSleep.endedAt).replace(' ago', '') : sleepActive ? 'now' : '—', sleepActive ? 'sleeping' : 'awake for'],
        ].map(([val, lbl]) => (
          <div key={lbl} style={{ flex: 1, background: p.card, borderRadius: 13, padding: '11px 8px', border: `1px solid ${p.border}`, textAlign: 'center' }}>
            <span style={{ display: 'block', fontFamily: "'Cormorant Garamond', serif", fontSize: String(val).length > 6 ? 15 : 20, color: p.heading, lineHeight: 1.2 }}>{val}</span>
            <span style={{ display: 'block', fontSize: 9, color: p.sub, lineHeight: 1.3, marginTop: 3 }}>{lbl}</span>
          </div>
        ))}
      </div>

      {/* Sleep timer card */}
      <div style={{ margin: '0 14px 14px', background: p.card, borderRadius: 18, border: `1px solid ${p.border}` }}>
        <div style={{ padding: '12px 16px 0', display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: sleepActive ? brand.accent : brand.sand, flexShrink: 0 }} />
          <span style={{ fontSize: 11, color: p.sub, letterSpacing: '.04em' }}>
            {sleepActive ? 'Sleeping' : 'Ready to start'}
          </span>
          {!sleepActive && timeSinceLast !== null && (
            <span style={{ marginLeft: 'auto', fontSize: 11, color: p.sub }}>woke {timeSinceLast}{timeSinceLast !== 'just now' ? ' ago' : ''}</span>
          )}
        </div>

        <div style={{ textAlign: 'center', padding: '18px 0 14px' }}>
          {sleepActive ? (
            <>
              <span style={{ display: 'block', fontFamily: "'Cormorant Garamond', serif", fontSize: 56, fontWeight: 300, color: p.heading, lineHeight: 1, letterSpacing: '-1px' }}>
                {fmtClock(sleepElapsed)}
              </span>
              <span style={{ display: 'block', fontSize: 10, color: p.sub, marginTop: 4, letterSpacing: '.08em', textTransform: 'uppercase' }}>
                asleep
              </span>
            </>
          ) : (
            <span style={{ display: 'block', fontFamily: "'Cormorant Garamond', serif", fontSize: 30, fontWeight: 300, color: p.sub, lineHeight: 1 }}>
              {timeSinceLast !== null
                ? timeSinceLast === 'just now' ? 'just woke up' : `${timeSinceLast} since last sleep`
                : 'Track naps and night sleep'}
            </span>
          )}
        </div>

        <div style={{ padding: '0 14px 14px' }}>
          {sleepActive ? (
            <button onClick={handleStop}
              style={{ width: '100%', padding: '15px', borderRadius: 13, border: `1.5px solid ${p.heading}`, cursor: 'pointer', background: 'transparent', color: p.heading, fontSize: 13, fontWeight: 500 }}>
              {babyDisplayName()}&apos;s awake
            </button>
          ) : (
            <button onClick={startSleep}
              style={{ width: '100%', padding: '15px', borderRadius: 13, border: 'none', cursor: 'pointer', background: brand.bark, color: brand.sand, fontSize: 13, fontWeight: 500 }}>
              ☾ &nbsp;{babyDisplayName()}&apos;s asleep
            </button>
          )}
        </div>
      </div>

      {/* Add a past sleep */}
      <div style={{ margin: '0 14px 14px', background: p.card, borderRadius: 14, border: `1px solid ${p.border}`, padding: '12px 14px' }}>
        {addingPast ? (
          <>
            <span style={{ display: 'block', fontSize: 11, color: p.sub, letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 10 }}>Add a sleep</span>
            <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
              <input type="date" value={logDate} onChange={e => setLogDate(e.target.value)} style={{ ...inputStyle, flex: 1.5 }} />
            </div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} style={{ ...inputStyle, flex: 1 }} />
              <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} style={{ ...inputStyle, flex: 1 }} />
            </div>
            <span style={{ display: 'block', fontSize: 10, color: p.sub, marginBottom: 12 }}>
              If the end time is earlier than the start, we&apos;ll assume the sleep crossed midnight.
            </span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setAddingPast(false)} style={{ flex: 1, padding: '12px', borderRadius: 12, border: `1px solid ${p.border}`, background: 'transparent', cursor: 'pointer', fontSize: 13, color: p.sub }}>Cancel</button>
              <button onClick={handleAddPast} style={{ flex: 1, padding: '12px', borderRadius: 12, border: 'none', background: brand.bark, cursor: 'pointer', fontSize: 13, color: brand.sand, fontWeight: 500 }}>Save</button>
            </div>
          </>
        ) : (
          <button onClick={() => setAddingPast(true)}
            style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: p.sub, padding: '2px 0', textAlign: 'left' }}>
            + Add a sleep you forgot to log
          </button>
        )}
      </div>

      {/* Recent sleeps */}
      <div style={{ padding: '0 14px' }}>
        <span style={{ display: 'block', fontSize: 10, color: p.sub, letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 10 }}>Recent</span>

        {sleeps.length === 0 ? (
          <span style={{ fontSize: 13, color: p.sub }}>No sleeps logged yet. Tap the button above when {babyDisplayName(true)} drifts off.</span>
        ) : (
          (showAll ? sleeps : sleeps.slice(0, 5)).map((s, i, shown) => {
            const canDelete = !sharedMode || !s.loggedBy || s.loggedBy === authUser?.id
            return (
            <div key={s.id} style={{
              display: 'flex', alignItems: 'center', padding: '10px 0',
              borderBottom: i < shown.length - 1 ? `1px solid ${p.border}` : 'none',
            }}>
              <div style={{ width: 26, height: 26, borderRadius: '50%', background: p.card, border: `1px solid ${p.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: 10, flexShrink: 0, fontSize: 12 }}>
                😴
              </div>
              <div style={{ flex: 1 }}>
                <span style={{ display: 'block', fontSize: 13, color: p.text, fontWeight: 500 }}>{fmtMins(s.durationSecs || 0)}</span>
                <span style={{ display: 'block', fontSize: 11, color: p.sub }}>{fmtRange(s)}</span>
              </div>
              <div style={{ textAlign: 'right', marginRight: 12 }}>
                {/* Labelled by start day, matching the Logbook's grouping */}
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

        {sleeps.length > 5 && (
          <button onClick={() => setShowAll(v => !v)}
            style={{ width: '100%', marginTop: 10, padding: '10px', borderRadius: 11, border: `1px solid ${p.border}`, background: 'transparent', cursor: 'pointer', fontSize: 12, color: p.sub, fontWeight: 500 }}>
            {showAll ? 'Show fewer' : `Show all ${sleeps.length}`}
          </button>
        )}
      </div>

      <div style={{ height: 24 }} />
    </div>
  )
}
