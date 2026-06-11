import { useState } from 'react'
import { brand, palette } from '../../theme.js'
import { dateStr, timeStr, buildISO } from '../../utils/time.js'
import { MOOD_EMOJI, MOOD_LABEL, MILK_TYPE_LABEL } from '../../lib/constants.js'
import { feedTypeOf } from '../../lib/normalize.js'
import { makeModalStyles } from './modalStyles.js'
import ModalShell from './ModalShell.jsx'

export default function EditFeedModal({ session, night, onSave, onDelete, onClose }) {
  const p = palette(night)
  const { input: inputStyle, label: labelStyle } = makeModalStyles(p)

  const [feedType,   setFeedType]   = useState(feedTypeOf(session))
  const [startDate,  setStartDate]  = useState(dateStr(session.startedAt))
  const [startTime,  setStartTime]  = useState(timeStr(session.startedAt))
  const [endDate,    setEndDate]    = useState(session.endedAt ? dateStr(session.endedAt) : dateStr(session.startedAt))
  const [endTime,    setEndTime]    = useState(session.endedAt ? timeStr(session.endedAt) : '')
  const [side,       setSide]       = useState(session.side || 'L')
  const [amount,     setAmount]     = useState(session.amountMl ? String(session.amountMl) : '')
  const [milkType,   setMilkType]   = useState(session.milkType || 'expressed')
  const [mood,       setMood]       = useState(session.mood ? Number(session.mood) : null)
  const [confirmDel, setConfirmDel] = useState(false)

  const toggleBtn = (active) => ({
    flex: 1, padding: '12px', borderRadius: 11,
    border: `1.5px solid ${active ? brand.sand : p.border}`,
    background: active ? brand.bark : 'transparent',
    cursor: 'pointer', color: active ? brand.sand : p.sub,
    fontSize: 13, fontWeight: 500,
  })

  const handleSave = () => {
    const newStartedAt = buildISO(startDate, startTime)
    const newEndedAt   = endTime ? buildISO(endDate, endTime) : session.endedAt
    const durationSecs = newEndedAt
      ? Math.max(0, Math.round((new Date(newEndedAt) - new Date(newStartedAt)) / 1000))
      : session.durationSecs
    const parsed = Math.round(Number(amount))
    // Switching type clears the other type's fields so a converted entry never
    // carries a stale side or amount.
    onSave(session.id, {
      feedType,
      side:     feedType === 'bottle' ? null : side,
      startedAt: newStartedAt, endedAt: newEndedAt, durationSecs,
      amountMl: feedType === 'bottle' && parsed >= 1 ? Math.min(500, parsed) : null,
      milkType: feedType === 'bottle' ? milkType : null,
      mood,
    })
  }

  return (
    <ModalShell title="Edit feed" night={night} onClose={onClose}>
      <span style={labelStyle}>Type</span>
      <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
        {[['breast', 'Breast'], ['bottle', '🍼 Bottle']].map(([id, label]) => (
          <button key={id} onClick={() => setFeedType(id)} style={toggleBtn(feedType === id)}>
            {label}
          </button>
        ))}
      </div>

      {feedType === 'breast' ? (
        <>
          <span style={labelStyle}>Side</span>
          <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
            {['L', 'R'].map(s => (
              <button key={s} onClick={() => setSide(s)} style={toggleBtn(side === s)}>
                {s === 'L' ? 'Left' : 'Right'}
              </button>
            ))}
          </div>
        </>
      ) : (
        <>
          <span style={labelStyle}>Amount (ml)</span>
          <input
            type="number" inputMode="numeric" min="1" max="500"
            value={amount} onChange={e => setAmount(e.target.value)}
            placeholder="e.g. 120"
            style={{ ...inputStyle, marginBottom: 14 }}
          />
          <span style={labelStyle}>Milk</span>
          <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
            {Object.entries(MILK_TYPE_LABEL).map(([id, label]) => (
              <button key={id} onClick={() => setMilkType(id)} style={toggleBtn(milkType === id)}>
                {label}
              </button>
            ))}
          </div>
        </>
      )}

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
