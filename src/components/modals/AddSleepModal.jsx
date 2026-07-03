import { useState } from 'react'
import { brand, palette, shadow } from '../../theme.js'
import { timeStr, dateStr, buildISO } from '../../utils/time.js'
import { newId } from '../../lib/id.js'
import { makeModalStyles } from './modalStyles.js'
import ModalShell from './ModalShell.jsx'

// `initial` switches the modal into edit mode: fields are pre-filled and the
// title/button reflect editing. The caller decides how to persist the result.
export default function AddSleepModal({ night, onSave, onClose, initial = null }) {
  const p = palette(night)
  const { input: inputStyle, label: labelStyle } = makeModalStyles(p)
  const editing = !!initial

  // The date field is the sleep's START date. Seed it from the default start
  // time (an hour ago), so opening the modal just after midnight defaults to
  // yesterday rather than creating a future entry.
  const now              = new Date()
  const defaultStartDate = new Date(now.getTime() - 60 * 60 * 1000)

  const [date,      setDate]      = useState(initial ? dateStr(initial.startedAt) : dateStr(defaultStartDate))
  const [startTime, setStartTime] = useState(initial ? timeStr(initial.startedAt) : timeStr(defaultStartDate))
  const [endTime,   setEndTime]   = useState(initial ? timeStr(initial.endedAt)   : timeStr(now))

  const handleSave = () => {
    const startedAt = buildISO(date, startTime)
    let endedAt = buildISO(date, endTime)
    // An end time earlier than the start time means the sleep crossed midnight
    if (new Date(endedAt) <= new Date(startedAt)) {
      const d = new Date(endedAt)
      d.setDate(d.getDate() + 1)
      endedAt = d.toISOString()
    }
    const durationSecs = Math.max(0, Math.round((new Date(endedAt) - new Date(startedAt)) / 1000))
    onSave({ id: newId(), startedAt, endedAt, durationSecs })
  }

  return (
    <ModalShell title={editing ? 'Edit sleep' : 'Add sleep'} night={night} onClose={onClose}>
      <span style={labelStyle}>Date</span>
      <input type="date" value={date} onChange={e => setDate(e.target.value)} style={{ ...inputStyle, marginBottom: 14 }} />

      <span style={labelStyle}>Fell asleep</span>
      <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} style={{ ...inputStyle, marginBottom: 14 }} />

      <span style={labelStyle}>Woke up</span>
      <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} style={{ ...inputStyle, marginBottom: 8 }} />

      <span style={{ display: 'block', fontSize: 10, color: p.sub, marginBottom: 16, lineHeight: 1.5 }}>
        If the wake time is earlier than the start, we&apos;ll assume the sleep crossed midnight.
      </span>

      <button onClick={handleSave} style={{ width: '100%', padding: '14px', borderRadius: 13, border: 'none', background: brand.barkGradient, boxShadow: shadow(night, 1), color: brand.sand, cursor: 'pointer', fontSize: 14, fontWeight: 500 }}>
        {editing ? 'Save changes' : 'Add sleep'}
      </button>
    </ModalShell>
  )
}
