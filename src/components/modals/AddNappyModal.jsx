import { useState } from 'react'
import { brand, palette } from '../../theme.js'
import { timeStr, todayDateStr } from '../../utils/time.js'
import { newId } from '../../lib/id.js'
import { POO_COLORS } from '../../lib/constants.js'
import { makeModalStyles } from './modalStyles.js'
import ModalShell from './ModalShell.jsx'

export default function AddNappyModal({ night, onSave, onClose }) {
  const p = palette(night)
  const { input: inputStyle, label: labelStyle } = makeModalStyles(p)

  const [type,     setType]     = useState('wet')
  const [pooColor, setPooColor] = useState('mustard')
  const [date,     setDate]     = useState(todayDateStr())
  const [logTime,  setLogTime]  = useState(timeStr())

  const needsColor = type === 'poo' || type === 'both'

  const handleSave = () => {
    const [y, mo, d] = date.split('-').map(Number)
    const [h, m]     = logTime.split(':').map(Number)
    const loggedAt   = new Date(y, mo - 1, d, h, m, 0, 0).toISOString()
    onSave({ id: newId(), type, pooColor: needsColor ? pooColor : null, loggedAt })
  }

  return (
    <ModalShell title="Log nappy" night={night} onClose={onClose}>
      <span style={labelStyle}>Type</span>
      <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
        {[
          { t: 'wet',  emoji: '💧',   label: 'Wee'  },
          { t: 'poo',  emoji: '💩',   label: 'Poo'  },
          { t: 'both', emoji: '💧💩', label: 'Both' },
        ].map(({ t, emoji, label }) => (
          <button key={t} onClick={() => setType(t)}
            style={{ flex: 1, padding: '12px 6px', borderRadius: 11, border: `1.5px solid ${type === t ? brand.sand : p.border}`, background: type === t ? brand.bark : 'transparent', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <span style={{ fontSize: 18, lineHeight: 1 }}>{emoji}</span>
            <span style={{ fontSize: 12, color: type === t ? brand.sand : p.sub, fontWeight: 500 }}>{label}</span>
          </button>
        ))}
      </div>

      {needsColor && (
        <>
          <span style={labelStyle}>Colour</span>
          <div style={{ display: 'flex', gap: 10, marginBottom: 18, alignItems: 'center' }}>
            {POO_COLORS.map(c => (
              <button key={c.id} onClick={() => setPooColor(c.id)} style={{
                width: 28, height: 28, borderRadius: '50%', background: c.hex, padding: 0,
                border:       pooColor === c.id ? `2px solid ${brand.sand}` : '2px solid transparent',
                outline:      pooColor === c.id ? `2px solid ${brand.bark}` : 'none',
                outlineOffset: 1, cursor: 'pointer', flexShrink: 0,
                WebkitTapHighlightColor: 'transparent',
              }} />
            ))}
            <span style={{ fontSize: 11, color: p.sub }}>
              {POO_COLORS.find(c => c.id === pooColor)?.label}
            </span>
          </div>
        </>
      )}

      <span style={labelStyle}>Date & time</span>
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        <input type="date" value={date}    onChange={e => setDate(e.target.value)}    style={{ ...inputStyle, flex: 1.4 }} />
        <input type="time" value={logTime} onChange={e => setLogTime(e.target.value)} style={{ ...inputStyle, flex: 1   }} />
      </div>

      <button onClick={handleSave} style={{ width: '100%', padding: '14px', borderRadius: 13, border: 'none', background: brand.bark, color: brand.sand, cursor: 'pointer', fontSize: 14, fontWeight: 500 }}>
        Log nappy
      </button>
    </ModalShell>
  )
}
