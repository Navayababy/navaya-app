import { useState } from 'react'
import { brand, palette } from '../../theme.js'
import { timeStr, todayDateStr, timeAgo } from '../../utils/time.js'
import { newId } from '../../lib/id.js'
import { MEDICINE_OPTIONS } from '../../lib/constants.js'
import { makeModalStyles } from './modalStyles.js'
import ModalShell from './ModalShell.jsx'

export default function AddMedicineModal({ night, onSave, onClose, recentMedicines = [] }) {
  const p = palette(night)
  const { input: inputStyle, label: labelStyle } = makeModalStyles(p)

  const [medicineId, setMedicineId] = useState('paracetamol')
  const [customName, setCustomName] = useState('')
  const [doseMl,     setDoseMl]     = useState('')
  const [date,       setDate]       = useState(todayDateStr())
  const [logTime,    setLogTime]    = useState(timeStr())
  const [notes,      setNotes]      = useState('')
  const [error,      setError]      = useState(null)

  const selected = MEDICINE_OPTIONS.find(m => m.id === medicineId)

  // Purely informational: the most recent logged entry for the selected
  // medicine. A factual record only — never dosing advice or "due" times.
  const matchName = (medicineId === 'other' ? customName.trim() : selected.label).toLowerCase()
  const lastDose = matchName
    ? recentMedicines
        .filter(m => (m.name || '').toLowerCase() === matchName)
        .reduce((latest, m) => !latest || new Date(m.loggedAt) > new Date(latest.loggedAt) ? m : latest, null)
    : null

  const handleSave = () => {
    const [y, mo, d] = date.split('-').map(Number)
    const [h, m]     = logTime.split(':').map(Number)
    const loggedAt   = new Date(y, mo - 1, d, h, m, 0, 0).toISOString()
    const name       = medicineId === 'other' ? customName.trim() : selected.label
    if (!name) return
    // Matches the database constraint (0–50ml) so shared saves can't silently fail
    if (doseMl && (Number.isNaN(Number(doseMl)) || Number(doseMl) < 0 || Number(doseMl) > 50)) {
      setError('Dose must be between 0 and 50ml.')
      return
    }
    setError(null)
    onSave({
      id: newId(),
      name,
      medicineId,
      doseMl: doseMl ? Number(doseMl) : null,
      form: selected.form,
      notes: notes.trim() || null,
      loggedAt,
    })
  }

  return (
    <ModalShell title="Log medicine" night={night} onClose={onClose}>
      <span style={labelStyle}>Medicine</span>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
        {MEDICINE_OPTIONS.map(m => (
          <button key={m.id} onClick={() => setMedicineId(m.id)}
            style={{ padding: '11px 8px', borderRadius: 11, border: `1.5px solid ${medicineId === m.id ? brand.sand : p.border}`, background: medicineId === m.id ? brand.bark : 'transparent', color: medicineId === m.id ? brand.sand : p.sub, cursor: 'pointer', fontSize: 12, fontWeight: 500 }}>
            {m.label}
          </button>
        ))}
      </div>

      {medicineId === 'other' && (
        <>
          <span style={labelStyle}>Custom name</span>
          <input value={customName} maxLength={100} onChange={e => setCustomName(e.target.value)} placeholder="e.g. Vitamin D drops" style={{ ...inputStyle, marginBottom: 14 }} />
        </>
      )}

      {lastDose && (
        <div style={{ background: p.bg, border: `1px solid ${p.border}`, borderRadius: 10, padding: '9px 12px', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 13, flexShrink: 0 }} aria-hidden="true">🕐</span>
          <span style={{ fontSize: 12, color: p.text, lineHeight: 1.5 }}>
            Last logged: {lastDose.name}{lastDose.doseMl ? ` ${lastDose.doseMl}ml` : ''} · {timeAgo(lastDose.loggedAt)}
          </span>
        </div>
      )}

      <span style={labelStyle}>Dose (ml)</span>
      <input type="number" min="0" max="50" step="0.1" value={doseMl} onChange={e => setDoseMl(e.target.value)} placeholder="Optional" style={{ ...inputStyle, marginBottom: 14 }} />

      <span style={labelStyle}>Date & time</span>
      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        <input type="date" value={date}    onChange={e => setDate(e.target.value)}    style={{ ...inputStyle, flex: 1.4 }} />
        <input type="time" value={logTime} onChange={e => setLogTime(e.target.value)} style={{ ...inputStyle, flex: 1 }} />
      </div>

      <span style={labelStyle}>Notes</span>
      <textarea value={notes} maxLength={500} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Reason, temperature, or advice from clinician" style={{ ...inputStyle, resize: 'vertical', marginBottom: 16 }} />

      {error && (
        <div style={{ fontSize: 12, color: '#c0392b', marginBottom: 12, lineHeight: 1.4 }}>
          {error}
        </div>
      )}

      <div style={{ background: p.bg, border: `1px solid ${p.border}`, borderRadius: 10, padding: '10px 12px', marginBottom: 16 }}>
        <span style={{ display: 'block', fontSize: 11, color: p.sub, lineHeight: 1.5 }}>
          NHS quick reference (not prescribing advice): Paracetamol is usually every 4-6 hours (max 4 doses/24h). Ibuprofen is usually every 6-8 hours (max 3 doses/24h). Always follow the bottle label and your clinician advice.
        </span>
      </div>

      <button onClick={handleSave} style={{ width: '100%', padding: '14px', borderRadius: 13, border: 'none', background: brand.bark, color: brand.sand, cursor: 'pointer', fontSize: 14, fontWeight: 500 }}>
        Log medicine
      </button>
    </ModalShell>
  )
}
