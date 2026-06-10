import { useState } from 'react'
import { brand, palette } from '../../theme.js'
import { timeStr, todayDateStr, buildISO } from '../../utils/time.js'
import { newId } from '../../lib/id.js'
import { makeModalStyles } from './modalStyles.js'
import ModalShell from './ModalShell.jsx'

export default function AddSleepModal({ night, onSave, onClose }) {
  const p = palette(night)
  const { input: inputStyle, label: labelStyle } = makeModalStyles(p)

  const now          = new Date()
  const defaultEnd   = timeStr(now)
  const defaultStart = timeStr(new Date(now.getTime() - 60 * 60 * 1000))

  const [date,      setDate]      = useState(todayDateStr())
  const [startTime, setStartTime] = useState(defaultStart)
  const [endTime,   setEndTime]   = useState(defaultEnd)

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
    <ModalShell title="Add sleep" night={night} onClose={onClose}>
      <span style={labelStyle}>Date</span>
      <input type="date" value={date} onChange={e => setDate(e.target.value)} style={{ ...inputStyle, marginBottom: 14 }} />

      <span style={labelStyle}>Fell asleep</span>
      <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} style={{ ...inputStyle, marginBottom: 14 }} />

      <span style={labelStyle}>Woke up</span>
      <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} style={{ ...inputStyle, marginBottom: 8 }} />

      <span style={{ display: 'block', fontSize: 10, color: p.sub, marginBottom: 16, lineHeight: 1.5 }}>
        If the wake time is earlier than the start, we&apos;ll assume the sleep crossed midnight.
      </span>

      <button onClick={handleSave} style={{ width: '100%', padding: '14px', borderRadius: 13, border: 'none', background: brand.bark, color: brand.sand, cursor: 'pointer', fontSize: 14, fontWeight: 500 }}>
        Add sleep
      </button>
    </ModalShell>
  )
}
