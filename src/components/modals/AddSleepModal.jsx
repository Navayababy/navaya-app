import { useState } from 'react'
import { brand, palette, shadow } from '../../theme.js'
import { timeStr, dateStr, resolveEditedISO, fmtMins } from '../../utils/time.js'
import { newId } from '../../lib/id.js'
import { makeModalStyles } from './modalStyles.js'
import ModalShell from './ModalShell.jsx'

// `initial` switches the modal into edit mode: fields are pre-filled and the
// title/button reflect editing. The caller decides how to persist the result.
//
// Start and end each carry their own date field (rather than one shared date
// plus a same-day/next-day guess) so a sleep that ran for days — most often
// a timer nobody stopped — can always be corrected back to its true span
// instead of being stuck within whatever the guess allowed.
export default function AddSleepModal({ night, onSave, onClose, initial = null }) {
  const p = palette(night)
  const { input: inputStyle, label: labelStyle } = makeModalStyles(p)
  const editing = !!initial

  // Seed from an hour ago, so opening the modal just after midnight defaults
  // to yesterday rather than creating a future entry.
  const now              = new Date()
  const defaultStartDate = new Date(now.getTime() - 60 * 60 * 1000)

  // The unambiguous instant each date/time pair was seeded from — captured
  // once, on mount, alongside the fields below (not recomputed on every
  // render, since `now`/`defaultStartDate` above are). Preserved verbatim by
  // resolveEditedISO for as long as the fields go unedited; see its comment
  // for why re-deriving from strings alone can't always be trusted (a DST
  // fall-back's repeated local hour is genuinely ambiguous without it).
  const [originalStartedAt] = useState(() => initial ? initial.startedAt : defaultStartDate.toISOString())
  const [originalEndedAt]   = useState(() => initial ? initial.endedAt   : now.toISOString())

  const [startDate, setStartDate] = useState(initial ? dateStr(initial.startedAt) : dateStr(defaultStartDate))
  const [startTime, setStartTime] = useState(initial ? timeStr(initial.startedAt) : timeStr(defaultStartDate))
  const [endDate,   setEndDate]   = useState(initial ? dateStr(initial.endedAt)   : dateStr(now))
  const [endTime,   setEndTime]   = useState(initial ? timeStr(initial.endedAt)   : timeStr(now))

  // null while a field is mid-edit (a native date/time input reports '' when
  // cleared) rather than an Invalid Date, so nothing here can throw during
  // render — see tryBuildISO (used inside resolveEditedISO).
  const startedAtPreview = resolveEditedISO(originalStartedAt, startDate, startTime)
  const endedAtPreview   = resolveEditedISO(originalEndedAt, endDate, endTime)
  const durationSecsPreview = startedAtPreview && endedAtPreview
    ? Math.round((new Date(endedAtPreview) - new Date(startedAtPreview)) / 1000)
    : null
  // A reversed interval (commonly: an overnight sleep entered without
  // advancing "Woke up" to the next day) is a genuine input mistake, not
  // something to silently guess a fix for — block Save until the dates
  // actually agree, rather than persisting an endedAt before startedAt.
  const canSave = durationSecsPreview !== null && durationSecsPreview >= 0

  const handleSave = () => {
    if (!canSave) return
    onSave({ id: newId(), startedAt: startedAtPreview, endedAt: endedAtPreview, durationSecs: durationSecsPreview })
  }

  return (
    <ModalShell title={editing ? 'Edit sleep' : 'Add sleep'} night={night} onClose={onClose}>
      <span style={labelStyle}>Fell asleep</span>
      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={{ ...inputStyle, flex: 1.3 }} />
        <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} style={{ ...inputStyle, flex: 1 }} />
      </div>

      <span style={labelStyle}>Woke up</span>
      <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
        <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} style={{ ...inputStyle, flex: 1.3 }} />
        <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} style={{ ...inputStyle, flex: 1 }} />
      </div>

      {durationSecsPreview !== null && (
        <span style={{ display: 'block', fontSize: 12, marginBottom: 16, color: durationSecsPreview < 0 ? brand.danger : p.sub, fontWeight: durationSecsPreview < 0 ? 600 : 400 }}>
          {durationSecsPreview < 0
            ? 'Woke up is before fell asleep — check the dates.'
            : `Duration: ${fmtMins(durationSecsPreview)}`}
        </span>
      )}

      <button onClick={handleSave} disabled={!canSave} style={{ width: '100%', padding: '14px', borderRadius: 13, border: 'none', background: brand.barkGradient, boxShadow: shadow(night, 1), color: brand.sand, cursor: canSave ? 'pointer' : 'not-allowed', fontSize: 14, fontWeight: 500, opacity: canSave ? 1 : 0.5 }}>
        {editing ? 'Save changes' : 'Add sleep'}
      </button>
    </ModalShell>
  )
}
