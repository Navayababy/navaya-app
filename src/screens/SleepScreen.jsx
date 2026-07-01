import { useState, useEffect, useMemo } from 'react'
import { brand, palette } from '../theme.js'
import { getSleeps, addSleep, babyDisplayName, getPendingSleep, savePendingSleep, clearPendingSleep } from '../lib/storage.js'
import { syncWrite } from '../lib/sync.js'
import { normalizeSleep } from '../lib/normalize.js'
import { sleepSecsOnDay } from '../lib/stats.js'
import { fmtMins, fmtSince, timeAgo, timeStr, dateStr, buildISO, nearestDateForTime } from '../utils/time.js'
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
// Starts simple: two choices (start the live timer, or log a sleep that
// already happened) rather than showing both flows at once.
export default function SleepScreen({ night, timer, authUser, profile, sharedSleeps, onSleepSaved }) {
  const p = palette(night)
  const { sleepActive, sleepElapsed, startSleep, stopSleep } = timer

  const [sleeps,     setSleeps]     = useState(() => getSleeps())
  const [addingPast, setAddingPast] = useState(false)
  const [logDate,    setLogDate]    = useState(() => dateStr())
  const [startTime,  setStartTime]  = useState('13:00')
  const [endTime,    setEndTime]    = useState('14:00')

  // Stopping the timer doesn't save right away — it asks "is this right?"
  // first, since the tap to start often lands after baby's actually asleep,
  // and the tap to end often lands a few minutes after baby actually woke
  // up. The active timer is already cleared by then, so this is persisted
  // too (not just component state) — otherwise switching tabs or closing
  // the app before confirming would silently lose the sleep. The persisted
  // record also carries whatever the user has typed into the confirmation
  // fields so far — otherwise an edit made just before a tab switch or
  // reload would silently revert to the original start/stop times.
  const [pendingSleep, setPendingSleep] = useState(() => getPendingSleep())   // { startedAt, endedAt, durationSecs, confirmStartTime, confirmEndTime }
  const [confirmStartTime, setConfirmStartTime] = useState(() => {
    const restored = getPendingSleep()
    return restored ? (restored.confirmStartTime || timeStr(restored.startedAt)) : ''
  })
  const [confirmEndTime, setConfirmEndTime] = useState(() => {
    const restored = getPendingSleep()
    return restored ? (restored.confirmEndTime || timeStr(restored.endedAt)) : ''
  })

  const updateConfirmStartTime = (value) => {
    setConfirmStartTime(value)
    if (pendingSleep) savePendingSleep({ ...pendingSleep, confirmStartTime: value })
  }
  const updateConfirmEndTime = (value) => {
    setConfirmEndTime(value)
    if (pendingSleep) savePendingSleep({ ...pendingSleep, confirmEndTime: value })
  }

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
    const initialConfirmStartTime = timeStr(sleepData.startedAt)
    const initialConfirmEndTime = timeStr(sleepData.endedAt)
    savePendingSleep({ ...sleepData, confirmStartTime: initialConfirmStartTime, confirmEndTime: initialConfirmEndTime })
    setPendingSleep(sleepData)
    setConfirmStartTime(initialConfirmStartTime)
    setConfirmEndTime(initialConfirmEndTime)
  }

  // There's no sleep.update sync — rather than save then patch, the record
  // is only created once the (possibly adjusted) start/end times are
  // confirmed. Each edited time is re-dated against its own original
  // instant, so a correction that pushes the start (or end) across a
  // midnight boundary — in either direction — lands on the right day
  // rather than inheriting the original, now-wrong date.
  const confirmSleep = () => {
    if (!pendingSleep) return
    const startedAt = nearestDateForTime(pendingSleep.startedAt, confirmStartTime)
    let endedAt = nearestDateForTime(pendingSleep.endedAt, confirmEndTime)
    // Safety net for the (now rare) case both corrected times still end up
    // out of order — never save a negative-duration sleep.
    if (new Date(endedAt) <= new Date(startedAt)) {
      const d = new Date(endedAt)
      d.setDate(d.getDate() + 1)
      endedAt = d.toISOString()
    }
    const durationSecs = Math.max(0, Math.round((new Date(endedAt) - new Date(startedAt)) / 1000))
    const sleep = { id: newId(), startedAt, endedAt, durationSecs }
    setSleeps(addSleep(sleep))
    shareSleep(sleep)
    clearPendingSleep()
    setPendingSleep(null)
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
      <div style={{ padding: '8px 16px 16px', textAlign: 'center' }}>
        <div style={{ width: 52, height: 52, borderRadius: '50%', background: `${brand.green}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
          <span style={{ fontSize: 24, color: brand.green, lineHeight: 1 }}>☾</span>
        </div>
        <span style={{ display: 'block', fontFamily: "'Cormorant Garamond', serif", fontSize: 12, color: brand.sand, letterSpacing: '.12em', textTransform: 'uppercase' }}>Rest &amp; recharge</span>
        <span style={{ display: 'block', fontFamily: "'Cormorant Garamond', serif", fontSize: 34, fontWeight: 400, color: p.heading, marginTop: 4 }}>Sleep</span>
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

      {sleepActive ? (
        /* ── Live timer ── */
        <div style={{ margin: '0 16px 16px', background: p.card, borderRadius: 20, border: `1px solid ${p.border}` }}>
          <div style={{ padding: '16px 18px 0', display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: brand.accent, flexShrink: 0 }} />
            <span style={{ fontSize: 12, color: p.sub, letterSpacing: '.04em' }}>Sleeping</span>
          </div>
          <div style={{ textAlign: 'center', padding: '22px 0 18px' }}>
            <span style={{ display: 'block', fontFamily: "'Cormorant Garamond', serif", fontSize: 60, fontWeight: 300, color: p.heading, lineHeight: 1, letterSpacing: '-1px' }}>
              {fmtClock(sleepElapsed)}
            </span>
            <span style={{ display: 'block', fontSize: 10, color: p.sub, marginTop: 4, letterSpacing: '.08em', textTransform: 'uppercase' }}>
              asleep
            </span>
          </div>
          <div style={{ padding: '0 16px 18px' }}>
            <button onClick={handleStop}
              style={{ width: '100%', padding: '18px', borderRadius: 16, border: `1.5px solid ${p.heading}`, cursor: 'pointer', background: 'transparent', color: p.heading, fontSize: 15, fontWeight: 600 }}>
              {babyDisplayName()}&apos;s awake
            </button>
          </div>
        </div>
      ) : pendingSleep ? (
        /* ── Confirm the start and end time before saving ── */
        <div style={{ margin: '0 16px 16px', background: p.card, borderRadius: 20, border: `1px solid ${p.border}`, padding: '18px 16px' }}>
          <span style={{ display: 'block', fontSize: 14, color: p.text, fontWeight: 500, marginBottom: 4 }}>Did {babyDisplayName(true)} fall asleep and wake up around these times?</span>
          <span style={{ display: 'block', fontSize: 12, color: p.sub, marginBottom: 14 }}>Adjust either if the timer was started or stopped a little late.</span>
          <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
            <div style={{ flex: 1 }}>
              <span style={{ display: 'block', fontSize: 11, color: p.sub, marginBottom: 6, letterSpacing: '.04em', textTransform: 'uppercase' }}>Fell asleep</span>
              <input
                type="time" value={confirmStartTime}
                onChange={e => updateConfirmStartTime(e.target.value)}
                style={{ ...inputStyle, width: '100%', fontSize: 18, textAlign: 'center', boxSizing: 'border-box' }}
              />
            </div>
            <div style={{ flex: 1 }}>
              <span style={{ display: 'block', fontSize: 11, color: p.sub, marginBottom: 6, letterSpacing: '.04em', textTransform: 'uppercase' }}>Woke up</span>
              <input
                type="time" value={confirmEndTime}
                onChange={e => updateConfirmEndTime(e.target.value)}
                style={{ ...inputStyle, width: '100%', fontSize: 18, textAlign: 'center', boxSizing: 'border-box' }}
              />
            </div>
          </div>
          <button onClick={confirmSleep}
            style={{ width: '100%', padding: '16px', borderRadius: 14, border: 'none', background: brand.bark, cursor: 'pointer', fontSize: 15, color: brand.sand, fontWeight: 600 }}>
            Save
          </button>
        </div>
      ) : addingPast ? (
        /* ── Manual past entry ── */
        <div style={{ margin: '0 16px 16px', background: p.card, borderRadius: 20, border: `1px solid ${p.border}`, padding: '18px 16px' }}>
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
        </div>
      ) : (
        /* ── Two simple choices ── */
        <div style={{ margin: '0 16px 16px', background: p.card, borderRadius: 20, border: `1px solid ${p.border}`, padding: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: brand.sand, flexShrink: 0 }} />
            <span style={{ fontSize: 12, color: p.sub, letterSpacing: '.04em' }}>Ready to start</span>
            {timeSinceLast !== null && (
              <span style={{ marginLeft: 'auto', fontSize: 12, color: p.sub }}>woke {timeSinceLast}{timeSinceLast !== 'just now' ? ' ago' : ''}</span>
            )}
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={startSleep}
              style={{ flex: 1, minHeight: 84, borderRadius: 16, border: 'none', cursor: 'pointer', background: brand.bark, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
              <span style={{ fontSize: 18, color: brand.sand, lineHeight: 1 }}>☾</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: brand.sand }}>Start sleep timer</span>
            </button>
            <button onClick={() => setAddingPast(true)}
              style={{ flex: 1, minHeight: 84, borderRadius: 16, border: `1.5px solid ${p.border}`, cursor: 'pointer', background: 'transparent', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
              <span style={{ fontSize: 18, color: p.text, lineHeight: 1 }}>+</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: p.text }}>Log a sleep</span>
            </button>
          </div>
        </div>
      )}

      </div>
    </div>
  )
}
