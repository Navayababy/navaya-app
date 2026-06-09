import { useState } from 'react'
import { brand, palette } from '../../theme.js'
import { timeStr, buildISO, todayDateStr } from '../../utils/time.js'
import { MOOD_EMOJI, MOOD_LABEL } from '../../lib/constants.js'
import { makeModalStyles } from './modalStyles.js'
import ModalShell from './ModalShell.jsx'

export default function AddFeedModal({ night, onSave, onClose }) {
  const p = palette(night)
  const { input: inputStyle, label: labelStyle } = makeModalStyles(p)

  const now          = new Date()
  const defaultEnd   = timeStr(now)
  const defaultStart = timeStr(new Date(now.getTime() - 20 * 60 * 1000))

  const [date,      setDate]      = useState(todayDateStr())
  const [startTime, setStartTime] = useState(defaultStart)
  const [endTime,   setEndTime]   = useState(defaultEnd)
  const [side,      setSide]      = useState('L')
  const [mood,      setMood]      = useState(null)

  const handleSave = () => {
    const startedAt    = buildISO(date, startTime)
    const endedAt      = buildISO(date, endTime)
    const durationSecs = Math.max(0, Math.round((new Date(endedAt) - new Date(startedAt)) / 1000))
    onSave({ id: Date.now().toString(), side, startedAt, endedAt, durationSecs, mood })
  }

  return (
    <ModalShell title="Add feed" night={night} onClose={onClose}>
      <span style={labelStyle}>Side</span>
      <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
        {['L', 'R'].map(s => (
          <button key={s} onClick={() => setSide(s)} style={{ flex: 1, padding: '12px', borderRadius: 11, border: `1.5px solid ${side === s ? brand.sand : p.border}`, background: side === s ? brand.bark : 'transparent', cursor: 'pointer', color: side === s ? brand.sand : p.sub, fontSize: 13, fontWeight: 500 }}>
            {s === 'L' ? 'Left' : 'Right'}
          </button>
        ))}
      </div>

      <span style={labelStyle}>Date</span>
      <input type="date" value={date} onChange={e => setDate(e.target.value)} style={{ ...inputStyle, marginBottom: 14 }} />

      <span style={labelStyle}>Start time</span>
      <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} style={{ ...inputStyle, marginBottom: 14 }} />

      <span style={labelStyle}>End time</span>
      <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} style={{ ...inputStyle, marginBottom: 14 }} />

      <span style={labelStyle}>Feed rating</span>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 6, marginBottom: 20 }}>
        {MOOD_LABEL.map((label, i) => {
          const score = i + 1
          const active = mood === score
          return (
            <button key={label} onClick={() => setMood(active ? null : score)} style={{ flex: 1, padding: '8px 4px', borderRadius: 11, border: `1.5px solid ${active ? brand.sand : p.border}`, background: active ? brand.bark : 'transparent', cursor: 'pointer', color: active ? brand.sand : p.sub, fontSize: 9 }}>
              <span style={{ display: 'block', fontSize: 20 }}>{MOOD_EMOJI[i]}</span>
              {label}
            </button>
          )
        })}
      </div>

      <button onClick={handleSave} style={{ width: '100%', padding: '14px', borderRadius: 13, border: 'none', background: brand.bark, color: brand.sand, cursor: 'pointer', fontSize: 14, fontWeight: 500 }}>
        Add feed
      </button>
    </ModalShell>
  )
}
