import { useState } from 'react'
import { brand, palette, shadow } from '../../theme.js'
import { timeStr, dateStr, buildISO, fmtMins } from '../../utils/time.js'
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

  const [startDate, setStartDate] = useState(initial ? dateStr(initial.startedAt) : dateStr(defaultStartDate))
  const [startTime, setStartTime] = useState(initial ? timeStr(initial.startedAt) : timeStr(defaultStartDate))
  const [endDate,   setEndDate]   = useState(initial ? dateStr(initial.endedAt)   : dateStr(now))
  const [endTime,   setEndTime]   = useState(initial ? timeStr(initial.endedAt)   : timeStr(now))

  const startedAtPreview = buildISO(startDate, startTime)
  const endedAtPreview   = buildISO(endDate, endTime)
  const durationSecsPreview = Math.round((new Date(endedAtPreview) - new Date(startedAtPreview)) / 1000)

  const handleSave = () => {
    const startedAt = startedAtPreview
    const endedAt    = endedAtPreview
    const durationSecs = Math.max(0, Math.round((new Date(endedAt) - new Date(startedAt)) / 1000))
    onSave({ id: newId(), startedAt, endedAt, durationSecs })
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

      <span style={{ display: 'block', fontSize: 12, marginBottom: 16, color: durationSecsPreview < 0 ? brand.danger : p.sub, fontWeight: durationSecsPreview < 0 ? 600 : 400 }}>
        {durationSecsPreview < 0
          ? 'Woke up is before fell asleep — check the dates.'
          : `Duration: ${fmtMins(durationSecsPreview)}`}
      </span>

      <button onClick={handleSave} style={{ width: '100%', padding: '14px', borderRadius: 13, border: 'none', background: brand.barkGradient, boxShadow: shadow(night, 1), color: brand.sand, cursor: 'pointer', fontSize: 14, fontWeight: 500 }}>
        {editing ? 'Save changes' : 'Add sleep'}
      </button>
    </ModalShell>
  )
}
