import { useState, useEffect, useMemo } from 'react'
import { brand, palette } from '../theme.js'
import { getSleeps, addSleep, babyDisplayName } from '../lib/storage.js'
import { syncWrite } from '../lib/sync.js'
import { normalizeSleep } from '../lib/normalize.js'
import { sleepSecsOnDay } from '../lib/stats.js'
import { fmtMins, fmtSince, timeAgo, dateStr, buildISO } from '../utils/time.js'
import { newId } from '../lib/id.js'

// h:mm:ss for long-running sleeps, mm:ss under an hour
function fmtClock(secs) {
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  const s = secs % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

// Log-only screen — no history list here — that's what the Logbook is for.
export default function SleepScreen({ night, timer, authUser, profile, sharedSleeps, onSleepSaved }) {
  const p = palette(night)
  const { sleepActive, sleepElapsed, startSleep, stopSleep } = timer

  const [sleeps,     setSleeps]     = useState(() => getSleeps())
  const [addingPast, setAddingPast] = useState(false)
  const [logDate,    setLogDate]    = useState(() => dateStr())
  const [startTime,  setStartTime]  = useState('13:00')
  const [endTime,    setEndTime]    = useState('14:00')

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

  const inputStyle = {
    background: p.bg, border: `1px solid ${p.border}`, borderRadius: 12,
    padding: '12px 14px', fontSize: 15, color: p.text,
    fontFamily: "'Jost', sans-serif", outline: 'none',
  }

  return (
    <div style={{ flex: 1, overflowY: 'auto', background: p.bg }}>
      <div style={{ minHeight: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-evenly', padding: '12px 0' }}>

      {/* Header */}
      <div style={{ padding: '8px 16px 16px' }}>
        <span style={{ display: 'block', fontFamily: "'Cormorant Garamond', serif", fontSize: 12, color: brand.sand, letterSpacing: '.12em', textTransform: 'uppercase' }}>Rest &amp; recharge</span>
        <span style={{ display: 'block', fontFamily: "'Cormorant Garamond', serif", fontSize: 26, fontWeight: 400, color: p.heading, marginTop: 2 }}>Sleep</span>
      </div>

      {/* Stats — bigger, roomier tiles */}
      <div style={{ display: 'flex', gap: 10, padding: '0 16px 20px' }}>
        {[
          [todaySecs > 0 ? fmtMins(todaySecs) : '—', 'sleep today'],
          [lastSleep ? fmtMins(lastSleep.durationSecs || 0) : '—', 'last sleep'],
          [lastSleep && !sleepActive ? timeAgo(lastSleep.endedAt).replace(' ago', '') : sleepActive ? 'now' : '—', sleepActive ? 'sleeping' : 'awake for'],
        ].map(([val, lbl]) => (
          <div key={lbl} style={{ flex: 1, background: p.card, borderRadius: 16, padding: '18px 8px', border: `1px solid ${p.border}`, textAlign: 'center' }}>
            <span style={{ display: 'block', fontFamily: "'Cormorant Garamond', serif", fontSize: String(val).length > 6 ? 20 : 28, color: p.heading, lineHeight: 1.2 }}>{val}</span>
            <span style={{ display: 'block', fontSize: 11, color: p.sub, lineHeight: 1.3, marginTop: 5 }}>{lbl}</span>
          </div>
        ))}
      </div>

      {/* Sleep timer card */}
      <div style={{ margin: '0 16px 16px', background: p.card, borderRadius: 20, border: `1px solid ${p.border}` }}>
        <div style={{ padding: '16px 18px 0', display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: sleepActive ? brand.accent : brand.sand, flexShrink: 0 }} />
          <span style={{ fontSize: 12, color: p.sub, letterSpacing: '.04em' }}>
            {sleepActive ? 'Sleeping' : 'Ready to start'}
          </span>
          {!sleepActive && timeSinceLast !== null && (
            <span style={{ marginLeft: 'auto', fontSize: 12, color: p.sub }}>woke {timeSinceLast}{timeSinceLast !== 'just now' ? ' ago' : ''}</span>
          )}
        </div>

        <div style={{ textAlign: 'center', padding: '22px 0 18px' }}>
          {sleepActive ? (
            <>
              <span style={{ display: 'block', fontFamily: "'Cormorant Garamond', serif", fontSize: 60, fontWeight: 300, color: p.heading, lineHeight: 1, letterSpacing: '-1px' }}>
                {fmtClock(sleepElapsed)}
              </span>
              <span style={{ display: 'block', fontSize: 10, color: p.sub, marginTop: 4, letterSpacing: '.08em', textTransform: 'uppercase' }}>
                asleep
              </span>
            </>
          ) : (
            <span style={{ display: 'block', fontFamily: "'Cormorant Garamond', serif", fontSize: 32, fontWeight: 300, color: p.sub, lineHeight: 1 }}>
              {timeSinceLast !== null
                ? timeSinceLast === 'just now' ? 'just woke up' : `${timeSinceLast} since last sleep`
                : 'Track naps and night sleep'}
            </span>
          )}
        </div>

        <div style={{ padding: '0 16px 18px' }}>
          {sleepActive ? (
            <button onClick={handleStop}
              style={{ width: '100%', padding: '18px', borderRadius: 16, border: `1.5px solid ${p.heading}`, cursor: 'pointer', background: 'transparent', color: p.heading, fontSize: 15, fontWeight: 600 }}>
              {babyDisplayName()}&apos;s awake
            </button>
          ) : (
            <button onClick={startSleep}
              style={{ width: '100%', padding: '18px', borderRadius: 16, border: 'none', cursor: 'pointer', background: brand.bark, color: brand.sand, fontSize: 15, fontWeight: 600 }}>
              ☾ &nbsp;{babyDisplayName()}&apos;s asleep
            </button>
          )}
        </div>
      </div>

      {/* Add a past sleep */}
      <div style={{ margin: '0 16px 16px', background: p.card, borderRadius: 16, border: `1px solid ${p.border}`, padding: '14px 16px' }}>
        {addingPast ? (
          <>
            <span style={{ display: 'block', fontSize: 12, color: p.sub, letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 12 }}>Add a sleep</span>
            <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
              <input type="date" value={logDate} onChange={e => setLogDate(e.target.value)} style={{ ...inputStyle, flex: 1.5 }} />
            </div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
              <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} style={{ ...inputStyle, flex: 1 }} />
              <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} style={{ ...inputStyle, flex: 1 }} />
            </div>
            <span style={{ display: 'block', fontSize: 11, color: p.sub, marginBottom: 14 }}>
              If the end time is earlier than the start, we&apos;ll assume the sleep crossed midnight.
            </span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setAddingPast(false)} style={{ flex: 1, padding: '14px', borderRadius: 13, border: `1px solid ${p.border}`, background: 'transparent', cursor: 'pointer', fontSize: 14, color: p.sub }}>Cancel</button>
              <button onClick={handleAddPast} style={{ flex: 1, padding: '14px', borderRadius: 13, border: 'none', background: brand.bark, cursor: 'pointer', fontSize: 14, color: brand.sand, fontWeight: 600 }}>Save</button>
            </div>
          </>
        ) : (
          <button onClick={() => setAddingPast(true)}
            style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: p.sub, padding: '4px 0', textAlign: 'left' }}>
            + Add a sleep you forgot to log
          </button>
        )}
      </div>

      </div>
    </div>
  )
}
