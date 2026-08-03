import { useState, useEffect, useMemo } from 'react'
import { brand, palette, shadow, iconWellBg } from '../theme.js'
import { getSleeps, addSleep, babyDisplayName, getPendingSleep, savePendingSleep, clearPendingSleep, getHouseholdLink } from '../lib/storage.js'
import { syncWrite } from '../lib/sync.js'
import { normalizeSleep } from '../lib/normalize.js'
import { latestNightSleep, napSecsOnSleepDay } from '../lib/stats.js'
import { fmtMins, fmtSince, timeAgo, timeStr, dateStr, buildISO, resolveEditedISO } from '../utils/time.js'
import { newId } from '../lib/id.js'
import { SLEEP_TIMER_WARN_SECS } from '../lib/constants.js'
import { useOneTimeHint } from '../hooks/useOneTimeHint.js'

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
  const { sleepActive, sleepElapsed, sleepId, startSleep, stopSleep, adoptActiveSleep, releaseActiveSleep } = timer

  const [sleeps,     setSleeps]     = useState(() => getSleeps())
  const [addingPast, setAddingPast] = useState(false)
  // One-time note for shared households: sleep timers behave differently
  // from feed timers (live sync vs sync-on-save), and nothing in the UI
  // makes that visible until it surprises someone.
  const [sleepSyncHintUnseen, dismissSleepSyncHint] = useOneTimeHint('sleep_sync_hint_seen')
  const showSleepSyncHint = sleepSyncHintUnseen && !!(authUser && profile?.household_id)
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
  // pendingSleep is the single source of truth for the confirm draft — it
  // carries startedAt/endedAt/durationSecs/shared *and* the four
  // confirmStart*/confirmEnd* fields the user is editing, all in one object,
  // both in state and in localStorage. Splitting the confirm fields into
  // their own useStates (as an earlier version of this did) let each
  // field's save spread a stale copy of the others, so editing the date and
  // then the time would silently drop the date edit from the persisted
  // draft — restoring it after a tab switch or reload would resurrect the
  // original, uncorrected span. One object updated with the previous-state
  // functional form (see updateConfirmField) closes that gap: there is only
  // ever one copy of the draft to go stale.
  // { id, shared, startedAt, endedAt, durationSecs, confirmStartDate, confirmStartTime, confirmEndDate, confirmEndTime }
  const [pendingSleep, setPendingSleep] = useState(() => {
    const restored = getPendingSleep()
    if (!restored) return null
    // Defaults cover a draft persisted before these fields existed.
    return {
      ...restored,
      confirmStartDate: restored.confirmStartDate || dateStr(restored.startedAt),
      confirmStartTime: restored.confirmStartTime || timeStr(restored.startedAt),
      confirmEndDate:   restored.confirmEndDate   || dateStr(restored.endedAt),
      confirmEndTime:   restored.confirmEndTime   || timeStr(restored.endedAt),
    }
  })

  // Functional update so this always merges onto the latest draft, not
  // whatever `pendingSleep` closed over — the root cause of the stale-spread
  // bug above was reading a snapshot instead of the current state.
  const updateConfirmField = (key, value) => {
    setPendingSleep(prev => {
      if (!prev) return prev
      const next = { ...prev, [key]: value }
      savePendingSleep(next)
      return next
    })
  }

  // Live preview of the corrected duration so an implausible span (the
  // timer-left-on failure mode) is obvious before saving, not just after.
  // null while a field is mid-edit (a native date/time input reports '' when
  // cleared) — see tryBuildISO — so this can never throw during render.
  // resolveEditedISO prefers the original raw startedAt/endedAt when a field
  // hasn't been touched, rather than re-deriving from strings that can't
  // represent a DST fall-back's repeated local hour unambiguously — see its
  // comment. Only an actual edit falls back to the lossy reconstruction.
  const confirmStartedAtPreview = pendingSleep ? resolveEditedISO(pendingSleep.startedAt, pendingSleep.confirmStartDate, pendingSleep.confirmStartTime) : null
  const confirmEndedAtPreview   = pendingSleep ? resolveEditedISO(pendingSleep.endedAt, pendingSleep.confirmEndDate, pendingSleep.confirmEndTime) : null
  const confirmDurationSecs = confirmStartedAtPreview && confirmEndedAtPreview
    ? Math.round((new Date(confirmEndedAtPreview) - new Date(confirmStartedAtPreview)) / 1000)
    : null
  // As with AddSleepModal: a reversed interval is a genuine input mistake
  // (most often an overnight sleep whose "Woke up" date wasn't advanced) —
  // block Save until the dates agree rather than silently guessing a fix.
  const canConfirmSleep = confirmDurationSecs !== null && confirmDurationSecs >= 0

  // Keep the list in sync with shared sleeps when in shared mode. An
  // in-progress sleep (no ended_at yet) is excluded — it's not a completed
  // record, it's what the active-timer/adopt logic below is for.
  // Skipped while the user is composing a manual entry.
  useEffect(() => {
    if (!sharedSleeps) return
    if (addingPast) return
    setSleeps(sharedSleeps.filter(s => s.ended_at != null).map(normalizeSleep))
  }, [sharedSleeps, addingPast])

  // The one open (ended_at null) sleep in the household, if any — this is
  // what makes a sleep started on one device show up as active on another.
  const sharedActiveSleep = useMemo(() =>
    sharedSleeps?.find(s => s.ended_at == null) || null
  , [sharedSleeps])

  // Someone in the household started a sleep — including this device, once
  // its own insert round-trips back through realtime (a no-op by then,
  // since sleepId already matches). Skipped while we're mid-confirm on our
  // own stop, so the adjustable-times card can't be yanked away mid-edit.
  useEffect(() => {
    if (!sharedActiveSleep) return
    if (pendingSleep) return
    if (sleepActive && sleepId === sharedActiveSleep.id) return
    adoptActiveSleep(sharedActiveSleep.id, new Date(sharedActiveSleep.started_at).getTime())
  }, [sharedActiveSleep, pendingSleep, sleepActive, sleepId, adoptActiveSleep])

  // Whether the sleep we're actively tracking now has an end time in the
  // shared list — i.e. a household member ended it (immediately on their
  // "awake" tap, ahead of their own time-confirmation). Checked by id rather
  // than by "no active sleep in the list" so this can never fire on the
  // brief round-trip gap right after this device's own insert.
  const trackedSleepClosedRemotely = useMemo(() => {
    if (!sleepId || !sharedSleeps) return false
    const row = sharedSleeps.find(s => s.id === sleepId)
    return !!(row && row.ended_at)
  }, [sharedSleeps, sleepId])

  useEffect(() => {
    if (!trackedSleepClosedRemotely) return
    if (!sleepActive || pendingSleep) return
    releaseActiveSleep()
  }, [trackedSleepClosedRemotely, sleepActive, pendingSleep, releaseActiveSleep])

  // Re-render every 30s so the relative times stay current — also lets the
  // sleep-day window (07:00/19:00 rollover) roll over without a reload.
  const [clockTick, setClockTick] = useState(0)
  useEffect(() => {
    const tick = setInterval(() => setClockTick(t => t + 1), 30000)
    return () => clearInterval(tick)
  }, [])

  const lastSleep = useMemo(() =>
    sleeps.reduce((latest, s) =>
      !latest || new Date(s.endedAt) > new Date(latest.endedAt) ? s : latest
    , null)
  , [sleeps])

  // Sleep-day model: night sleep belongs to the evening it started rather
  // than being split at midnight (see docs/plans/sleep-tracking-clarity.md).
  // clockTick isn't read directly — it forces these to recompute so the
  // 07:00/19:00 window boundary rolls over without a reload.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const lastNight = useMemo(() => latestNightSleep(sleeps), [sleeps, clockTick])
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const napSecs    = useMemo(() => napSecsOnSleepDay(sleeps), [sleeps, clockTick])

  // "2h 14m since last sleep" — mirrors the feed card's since-last-feed line
  const timeSinceLast = lastSleep?.endedAt && !sleepActive
    ? fmtSince(lastSleep.endedAt)
    : null

  // Fail-safe: a timer nobody stopped is a "likely to happen" failure mode
  // (forgetting to end it, especially overnight), and it otherwise sits
  // silently racking up an implausible duration. Surface it instead.
  const sleepRunningLong = sleepActive && sleepElapsed >= SLEEP_TIMER_WARN_SECS

  // For manual/past entries, which never go through an open-row phase.
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

  // Opens the shared row the instant the timer starts, so realtime delivers
  // it to every household device right away rather than only once confirmed.
  const shareSleepStart = (id, startedAtIso) => {
    if (!authUser || !profile?.household_id) return
    syncWrite('sleep.insert', {
      id,
      householdId:  profile.household_id,
      loggedBy:     authUser.id,
      startedAt:    startedAtIso,
      endedAt:      null,
      durationSecs: null,
    }).then(({ ok }) => { if (ok) onSleepSaved?.() })
  }

  // Patches the open row — used both for the immediate raw stop time (so a
  // partner's device drops out of "active" right away) and for the
  // corrected times once confirmed. Deliberately not gated on auth: callers
  // only invoke it for sleeps whose shared row exists, and if the device got
  // signed out mid-sleep the patch must still queue (it delivers on the
  // sign-in flush) — otherwise the household row stays open forever.
  const shareSleepUpdate = (sleep) => {
    syncWrite('sleep.update', {
      id:           sleep.id,
      startedAt:    sleep.startedAt,
      endedAt:      sleep.endedAt,
      durationSecs: sleep.durationSecs,
    }).then(({ ok }) => { if (ok) onSleepSaved?.() })
  }

  // Patch-or-insert via the server (see upsertSleepLog) for a completed
  // sleep whose row may or may not exist. Unlike the plain insert, this
  // must queue even while signed out: if the row does exist (a timer from
  // before the shared flag, opened while signed in), nothing else will
  // ever close it — reconciliation deliberately ignores duplicate ids — so
  // dropping the op here would leave the household with a sleep that never
  // ends. The cached household link supplies the identity for the insert
  // half (ignored if it belongs to a different signed-in user); a device
  // with no link ever recorded has no household to reach, and the entry
  // stays local-only.
  const shareSleepUpsert = (sleep) => {
    const link = getHouseholdLink()
    const linkUsable = link && (!authUser || link.userId === authUser.id)
    const loggedBy    = authUser?.id || (linkUsable ? link.userId : null)
    const householdId = profile?.household_id || (linkUsable ? link.householdId : null)
    if (!loggedBy || !householdId) return
    syncWrite('sleep.upsert', {
      id:           sleep.id,
      householdId,
      loggedBy,
      startedAt:    sleep.startedAt,
      endedAt:      sleep.endedAt,
      durationSecs: sleep.durationSecs,
    }).then(({ ok }) => { if (ok) onSleepSaved?.() })
  }

  const handleStart = () => {
    // Whether the shared row can be opened right now is recorded with the
    // timer: a start made while signed out has no row, and stop/confirm must
    // insert instead of patch. (App.jsx backfills the row if the user signs
    // in while the timer is still running.)
    const canShare = !!(authUser && profile?.household_id)
    const { id, startedAt } = startSleep(canShare)
    if (canShare) shareSleepStart(id, new Date(startedAt).toISOString())
  }

  const handleStop = () => {
    const sleepData = stopSleep()
    const nextPendingSleep = {
      ...sleepData,
      confirmStartDate: dateStr(sleepData.startedAt),
      confirmStartTime: timeStr(sleepData.startedAt),
      confirmEndDate:   dateStr(sleepData.endedAt),
      confirmEndTime:   timeStr(sleepData.endedAt),
    }
    savePendingSleep(nextPendingSleep)
    setPendingSleep(nextPendingSleep)
    // Raw stop time, ahead of whatever adjustment happens on confirm — this
    // is what lets a household member's device see it end immediately. A
    // provably unshared sleep (shared false) has no row to close and is
    // inserted whole at confirm instead; a pre-flag record (undefined) goes
    // through the upsert so an existing open row is closed right now, not
    // only if and when the user confirms.
    if (sleepData.shared) shareSleepUpdate(sleepData)
    else if (sleepData.shared === undefined) shareSleepUpsert(sleepData)
  }

  // The row was already opened on start (see handleStart) and closed with a
  // raw stop time (see handleStop) — confirming just patches it with the
  // (possibly adjusted) final times, it never inserts. Start and end each
  // carry their own explicit date rather than being re-dated against the
  // raw stop time: a timer left running for a long time (the fail-safe
  // warning above targets exactly this) needs the confirm step to be able
  // to land on any day, not just the one next to wherever it happened to be
  // stopped. Blocked by canConfirmSleep (Save is disabled) rather than
  // guessed at here if the dates are still reversed.
  const confirmSleep = () => {
    if (!pendingSleep || !canConfirmSleep) return
    const sleep = { id: pendingSleep.id || newId(), startedAt: confirmStartedAtPreview, endedAt: confirmEndedAtPreview, durationSecs: confirmDurationSecs }
    setSleeps(addSleep(sleep))
    // A sleep whose whole timer ran signed out never opened a shared row, so
    // there is nothing to patch. When the flag says the row exists, patch it
    // as usual; every other case (flag false, or a record from before the
    // flag existed whose row may or may not be on the server) goes through
    // the upsert, which resolves the question against the server instead of
    // guessing — a wrong guess either strands the row open (duplicate insert
    // dropped) or burns the outbox retry cap (patching a missing row).
    if (pendingSleep.shared === true || sharedSleeps?.some(s => s.id === sleep.id)) {
      shareSleepUpdate(sleep)
    } else {
      shareSleepUpsert(sleep)
    }
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
        <div style={{ width: 52, height: 52, borderRadius: '50%', background: iconWellBg(brand.green), boxShadow: shadow(night, 1), display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
          <span style={{ fontSize: 24, color: brand.green, lineHeight: 1 }}>☾</span>
        </div>
        <span style={{ display: 'block', fontFamily: "'Cormorant Garamond', serif", fontSize: 12, color: brand.sand, letterSpacing: '.12em', textTransform: 'uppercase' }}>Rest &amp; recharge</span>
        <span style={{ display: 'block', fontFamily: "'Cormorant Garamond', serif", fontSize: 34, fontWeight: 400, color: p.heading, marginTop: 4 }}>Sleep</span>
      </div>

      {/* Stats — bigger, roomier tiles */}
      <div style={{ display: 'flex', gap: 10, padding: '0 16px 20px' }}>
        {[
          [lastNight.secs > 0 ? fmtMins(lastNight.secs) : '—', lastNight.inProgress ? 'tonight' : 'last night'],
          [napSecs > 0 ? fmtMins(napSecs) : '—', 'naps today'],
          [lastSleep && !sleepActive ? timeAgo(lastSleep.endedAt).replace(' ago', '') : sleepActive ? 'now' : '—', sleepActive ? 'sleeping' : 'awake for'],
        ].map(([val, lbl]) => (
          <div key={lbl} style={{ flex: 1, background: p.card, borderRadius: 16, padding: '18px 8px', border: `1px solid ${p.border}`, boxShadow: shadow(night, 1), textAlign: 'center' }}>
            <span style={{ display: 'block', fontFamily: "'Cormorant Garamond', serif", fontSize: String(val).length > 6 ? 20 : 28, color: p.heading, lineHeight: 1.2 }}>{val}</span>
            <span style={{ display: 'block', fontSize: 11, color: p.sub, lineHeight: 1.3, marginTop: 5 }}>{lbl}</span>
          </div>
        ))}
      </div>

      {/* ── One-time shared-household note, same pattern as Home's guest note ── */}
      {showSleepSyncHint && (
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, margin: '0 16px 16px', padding: '11px 13px', background: p.card, border: `1px solid ${p.border}`, borderRadius: 14, boxShadow: shadow(night, 1) }}>
          <span style={{ flex: 1, fontSize: 11, color: p.sub, lineHeight: 1.5 }}>
            Sleep timers sync live — your partner sees this timer running and either of you can end it. Feed timers stay on the device that started them until the feed is saved.
          </span>
          <button onClick={dismissSleepSyncHint} aria-label="Dismiss"
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: p.sub, lineHeight: 1, padding: 0, flexShrink: 0 }}>
            ×
          </button>
        </div>
      )}

      {sleepActive ? (
        /* ── Live timer ── */
        <div style={{ margin: '0 16px 16px', background: p.card, borderRadius: 20, border: `1px solid ${sleepRunningLong ? brand.danger : p.border}`, boxShadow: shadow(night, 2) }}>
          <div style={{ padding: '16px 18px 0', display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: brand.accent, flexShrink: 0 }} />
            <span style={{ fontSize: 12, color: p.sub, letterSpacing: '.04em' }}>Sleeping</span>
          </div>
          {sleepRunningLong && (
            <div style={{ margin: '12px 18px 0', padding: '10px 12px', background: `${brand.danger}1a`, border: `1px solid ${brand.danger}`, borderRadius: 12 }}>
              <span style={{ display: 'block', fontSize: 12, color: brand.danger, lineHeight: 1.5, fontWeight: 500 }}>
                This has been running for {fmtMins(sleepElapsed)} — if {babyDisplayName(true)} actually woke up earlier, stop the timer below and you&apos;ll be able to fix the date and time.
              </span>
            </div>
          )}
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
        <div style={{ margin: '0 16px 16px', background: p.card, borderRadius: 20, border: `1px solid ${p.border}`, boxShadow: shadow(night, 1), padding: '18px 16px' }}>
          <span style={{ display: 'block', fontSize: 14, color: p.text, fontWeight: 500, marginBottom: 4 }}>Did {babyDisplayName(true)} fall asleep and wake up around these times?</span>
          <span style={{ display: 'block', fontSize: 12, color: p.sub, marginBottom: 14 }}>Adjust the date too if the timer ran on for a while — the times below aren&apos;t limited to today.</span>
          <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
            <div style={{ flex: 1 }}>
              <span style={{ display: 'block', fontSize: 11, color: p.sub, marginBottom: 6, letterSpacing: '.04em', textTransform: 'uppercase' }}>Fell asleep</span>
              <div style={{ display: 'flex', gap: 6 }}>
                <input
                  type="date" value={pendingSleep.confirmStartDate}
                  onChange={e => updateConfirmField('confirmStartDate', e.target.value)}
                  style={{ ...inputStyle, flex: 1.3, fontSize: 13, boxSizing: 'border-box' }}
                />
                <input
                  type="time" value={pendingSleep.confirmStartTime}
                  onChange={e => updateConfirmField('confirmStartTime', e.target.value)}
                  style={{ ...inputStyle, flex: 1, fontSize: 15, textAlign: 'center', boxSizing: 'border-box' }}
                />
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
            <div style={{ flex: 1 }}>
              <span style={{ display: 'block', fontSize: 11, color: p.sub, marginBottom: 6, letterSpacing: '.04em', textTransform: 'uppercase' }}>Woke up</span>
              <div style={{ display: 'flex', gap: 6 }}>
                <input
                  type="date" value={pendingSleep.confirmEndDate}
                  onChange={e => updateConfirmField('confirmEndDate', e.target.value)}
                  style={{ ...inputStyle, flex: 1.3, fontSize: 13, boxSizing: 'border-box' }}
                />
                <input
                  type="time" value={pendingSleep.confirmEndTime}
                  onChange={e => updateConfirmField('confirmEndTime', e.target.value)}
                  style={{ ...inputStyle, flex: 1, fontSize: 15, textAlign: 'center', boxSizing: 'border-box' }}
                />
              </div>
            </div>
          </div>
          {confirmDurationSecs !== null && (
            <span style={{ display: 'block', fontSize: 12, marginBottom: 14, color: confirmDurationSecs < 0 ? brand.danger : p.sub, fontWeight: confirmDurationSecs < 0 ? 600 : 400 }}>
              {confirmDurationSecs < 0 ? 'Woke up is before fell asleep — check the dates.' : `Duration: ${fmtMins(confirmDurationSecs)}`}
            </span>
          )}
          <button onClick={confirmSleep} disabled={!canConfirmSleep}
            style={{ width: '100%', padding: '16px', borderRadius: 14, border: 'none', background: brand.barkGradient, boxShadow: shadow(night, 1), cursor: canConfirmSleep ? 'pointer' : 'not-allowed', fontSize: 15, color: brand.sand, fontWeight: 600, opacity: canConfirmSleep ? 1 : 0.5 }}>
            Save
          </button>
        </div>
      ) : addingPast ? (
        /* ── Manual past entry ── */
        <div style={{ margin: '0 16px 16px', background: p.card, borderRadius: 20, border: `1px solid ${p.border}`, boxShadow: shadow(night, 1), padding: '18px 16px' }}>
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
            <button onClick={handleAddPast} style={{ flex: 1, padding: '14px', borderRadius: 13, border: 'none', background: brand.barkGradient, boxShadow: shadow(night, 1), cursor: 'pointer', fontSize: 14, color: brand.sand, fontWeight: 600 }}>Save</button>
          </div>
        </div>
      ) : (
        /* ── Two simple choices ── */
        <div style={{ margin: '0 16px 16px', background: p.card, borderRadius: 20, border: `1px solid ${p.border}`, boxShadow: shadow(night, 1), padding: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: brand.sand, flexShrink: 0 }} />
            <span style={{ fontSize: 12, color: p.sub, letterSpacing: '.04em' }}>Ready to start</span>
            {timeSinceLast !== null && (
              <span style={{ marginLeft: 'auto', fontSize: 12, color: p.sub }}>woke {timeSinceLast}{timeSinceLast !== 'just now' ? ' ago' : ''}</span>
            )}
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={handleStart}
              style={{ flex: 1, minHeight: 84, borderRadius: 16, border: 'none', cursor: 'pointer', background: brand.barkGradient, boxShadow: shadow(night, 1), display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
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
