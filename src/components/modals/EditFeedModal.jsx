import { useState } from 'react'
import { brand, palette } from '../../theme.js'
import { dateStr, timeStr, buildISO } from '../../utils/time.js'
import { MOOD_EMOJI, MOOD_LABEL } from '../../lib/constants.js'
import { makeModalStyles } from './modalStyles.js'
import ModalShell from './ModalShell.jsx'

export default function EditFeedModal({ session, night, onSave, onDelete, onClose }) {
  const p = palette(night)
  const { input: inputStyle, label: labelStyle } = makeModalStyles(p)

  const [startDate,  setStartDate]  = useState(dateStr(session.startedAt))
  const [startTime,  setStartTime]  = useState(timeStr(session.startedAt))
  const [endDate,    setEndDate]    = useState(session.endedAt ? dateStr(session.endedAt) : dateStr(session.startedAt))
  const [endTime,    setEndTime]    = useState(session.endedAt ? timeStr(session.endedAt) : '')
  const [side,       setSide]       = useState(session.side)
  const [mood,       setMood]       = useState(session.mood ? Number(session.mood) : null)
  const [confirmDel, setConfirmDel] = useState(false)

  const handleSave = () => {
    const newStartedAt = buildISO(startDate, startTime)
    const newEndedAt   = endTime ? buildISO(endDate, endTime) : session.endedAt
    const durationSecs = newEndedAt
      ? Math.max(0, Math.round((new Date(newEndedAt) - new Date(newStartedAt)) / 1000))
      : session.durationSecs
    onSave(session.id, { side, startedAt: newStartedAt, endedAt: newEndedAt, durationSecs, mood })
  }

  return (
    <ModalShell title="Edit feed" night={night} onClose={onClose}>
      <span style={labelStyle}>Side</span>
      <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
        {['L', 'R'].map(s => (
          <button key={s} onClick={() => setSide(s)} style={{ flex: 1, padding: '12px', borderRadius: 11, border: `1.5px solid ${side === s ? brand.sand : p.border}`, background: side === s ? brand.bark : 'transparent', cursor: 'pointer', color: side === s ? brand.sand : p.sub, fontSize: 13, fontWeight: 500 }}>
            {s === 'L' ? 'Left' : 'Right'}
          </button>
        ))}
      </div>

      <span style={labelStyle}>Start</span>
      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={{ ...inputStyle, flex: 1.4 }} />
        <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} style={{ ...inputStyle, flex: 1 }} />
      </div>

      <span style={labelStyle}>End</span>
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} style={{ ...inputStyle, flex: 1.4 }} />
        <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} style={{ ...inputStyle, flex: 1 }} />
      </div>

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

      <button onClick={handleSave} style={{ width: '100%', padding: '14px', borderRadius: 13, border: 'none', background: brand.bark, color: brand.sand, cursor: 'pointer', fontSize: 14, fontWeight: 500, marginBottom: 10 }}>
        Save changes
      </button>

      {confirmDel ? (
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setConfirmDel(false)} style={{ flex: 1, padding: '12px', borderRadius: 13, border: `1px solid ${p.border}`, background: 'transparent', cursor: 'pointer', fontSize: 13, color: p.sub }}>Cancel</button>
          <button onClick={() => onDelete(session.id)} style={{ flex: 1, padding: '12px', borderRadius: 13, border: 'none', background: '#c0392b', cursor: 'pointer', fontSize: 13, color: '#fff', fontWeight: 500 }}>Confirm delete</button>
        </div>
      ) : (
        <button onClick={() => setConfirmDel(true)} style={{ width: '100%', padding: '12px', borderRadius: 13, border: `1px solid ${p.border}`, background: 'transparent', cursor: 'pointer', fontSize: 13, color: '#c0392b' }}>
          Delete this feed
        </button>
      )}
    </ModalShell>
  )
}
