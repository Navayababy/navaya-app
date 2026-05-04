import { useState, useMemo } from 'react'
import { brand, palette } from '../theme.js'
import { getSessions, getNappies, getMedicines, updateSession, deleteSession, addSession, deleteNappy, addNappy, addMedicine, deleteMedicine } from '../lib/storage.js'

const MOOD_EMOJI = ['😔', '😐', '🙂', '😊', '🤩']
const MOOD_LABEL = ['Tough', 'Okay', 'Good', 'Great', 'Amazing']

const POO_HEX    = { mustard: '#D4A843', yellow: '#EDD050', green: '#6B9E5C', brown: '#8B6347', dark: '#2D1F14' }
const POO_LABEL  = { mustard: 'Mustard', yellow: 'Yellow',  green: 'Green',   brown: 'Brown',   dark: 'Dark/Black' }
const POO_COLORS = [
  { id: 'mustard', hex: '#D4A843', label: 'Mustard'    },
  { id: 'yellow',  hex: '#EDD050', label: 'Yellow'     },
  { id: 'green',   hex: '#6B9E5C', label: 'Green'      },
  { id: 'brown',   hex: '#8B6347', label: 'Brown'      },
  { id: 'dark',    hex: '#2D1F14', label: 'Dark/Black' },
]

const MEDICINE_OPTIONS = [
  { id: 'paracetamol', label: 'Paracetamol', form: '120mg/5ml' },
  { id: 'ibuprofen',   label: 'Ibuprofen',   form: '100mg/5ml' },
  { id: 'amoxicillin', label: 'Amoxicillin', form: 'Prescription' },
  { id: 'other',       label: 'Other',       form: 'Custom' },
]

function fmt(secs) {
  const m = Math.floor(secs / 60)
  const s = secs % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function fmtMins(secs) {
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

function dayLabel(isoString) {
  const d = new Date(isoString)
  const today     = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)
  if (d.toDateString() === today.toDateString())     return 'Today'
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday'
  return d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' })
}

function timeStr(isoString) {
  return new Date(isoString).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

function dateStr(isoString) {
  const d = new Date(isoString)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function buildISO(dateVal, timeVal) {
  const [y, mo, d] = dateVal.split('-').map(Number)
  const [h, m]     = timeVal.split(':').map(Number)
  return new Date(y, mo - 1, d, h, m, 0, 0).toISOString()
}

function todayDateStr() { return dateStr(new Date().toISOString()) }
function dayKey(isoString) { return dateStr(isoString) }

function moodSummary(avg) {
  if (!avg) return null
  const idx = Math.min(MOOD_EMOJI.length - 1, Math.max(0, Math.round(avg) - 1))
  return { emoji: MOOD_EMOJI[idx], label: MOOD_LABEL[idx], score: avg.toFixed(1) }
}

// ── Shared modal shell ────────────────────────────────────────────────────────
function ModalShell({ title, night, onClose, children }) {
  const p = palette(night)
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 100, padding: '0 0 env(safe-area-inset-bottom, 0)' }}>
      <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 430, background: p.card, borderRadius: '20px 20px 0 0', padding: '20px 20px 28px', border: `1px solid ${p.border}`, maxHeight: '85vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <span style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 20, color: night ? brand.parchment : brand.bark }}>{title}</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: p.card === '#fff' ? '#666' : '#aaa' }}>×</button>
        </div>
        {children}
      </div>
    </div>
  )
}

// ── Edit modal (feeds only) ───────────────────────────────────────────────────
function EditModal({ session, night, onSave, onDelete, onClose }) {
  const p = palette(night)
  const [startDate,  setStartDate]  = useState(dateStr(session.startedAt))
  const [startTime,  setStartTime]  = useState(timeStr(session.startedAt))
  const [endDate,    setEndDate]    = useState(session.endedAt ? dateStr(session.endedAt) : dateStr(session.startedAt))
  const [endTime,    setEndTime]    = useState(session.endedAt ? timeStr(session.endedAt) : '')
  const [side,       setSide]       = useState(session.side)
  const [confirmDel, setConfirmDel] = useState(false)

  const handleSave = () => {
    const newStartedAt = buildISO(startDate, startTime)
    const newEndedAt   = endTime ? buildISO(endDate, endTime) : session.endedAt
    onSave(session.id, { side, startedAt: newStartedAt, endedAt: newEndedAt })
  }

  const inputStyle = { width: '100%', background: p.bg, border: `1px solid ${p.border}`, borderRadius: 11, padding: '11px 13px', fontSize: 16, color: p.text, fontFamily: "'DM Sans', sans-serif", outline: 'none', boxSizing: 'border-box' }
  const labelStyle = { display: 'block', fontSize: 11, color: p.sub, letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 8 }

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

// ── Add Feed modal ─────────────────────────────────────────────────────────────
function AddFeedModal({ night, onSave, onClose }) {
  const p = palette(night)
  const now          = new Date()
  const defaultEnd   = timeStr(now.toISOString())
  const defaultStart = timeStr(new Date(now.getTime() - 20 * 60 * 1000).toISOString())

  const [date,      setDate]      = useState(todayDateStr())
  const [startTime, setStartTime] = useState(defaultStart)
  const [endTime,   setEndTime]   = useState(defaultEnd)
  const [side,      setSide]      = useState('L')

  const handleSave = () => {
    const startedAt    = buildISO(date, startTime)
    const endedAt      = buildISO(date, endTime)
    const durationSecs = Math.max(0, Math.round((new Date(endedAt) - new Date(startedAt)) / 1000))
    onSave({ id: Date.now().toString(), side, startedAt, endedAt, durationSecs, mood: null })
  }

  const inputStyle = { width: '100%', background: p.bg, border: `1px solid ${p.border}`, borderRadius: 11, padding: '11px 13px', fontSize: 16, color: p.text, fontFamily: "'DM Sans', sans-serif", outline: 'none', boxSizing: 'border-box' }
  const labelStyle = { display: 'block', fontSize: 11, color: p.sub, letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 8 }

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
      <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} style={{ ...inputStyle, marginBottom: 20 }} />

      <button onClick={handleSave} style={{ width: '100%', padding: '14px', borderRadius: 13, border: 'none', background: brand.bark, color: brand.sand, cursor: 'pointer', fontSize: 14, fontWeight: 500 }}>
        Add feed
      </button>
    </ModalShell>
  )
}

// ── Add Nappy modal ────────────────────────────────────────────────────────────
function AddNappyModal({ night, onSave, onClose }) {
  const p = palette(night)
  const [type,     setType]     = useState('wet')
  const [pooColor, setPooColor] = useState('mustard')
  const [date,     setDate]     = useState(todayDateStr())
  const [logTime,  setLogTime]  = useState(timeStr(new Date().toISOString()))

  const needsColor = type === 'poo' || type === 'both'

  const handleSave = () => {
    const [y, mo, d] = date.split('-').map(Number)
    const [h, m]     = logTime.split(':').map(Number)
    const loggedAt   = new Date(y, mo - 1, d, h, m, 0, 0).toISOString()
    onSave({ id: Date.now().toString(), type, pooColor: needsColor ? pooColor : null, loggedAt })
  }

  const inputStyle = { width: '100%', background: p.bg, border: `1px solid ${p.border}`, borderRadius: 11, padding: '11px 13px', fontSize: 16, color: p.text, fontFamily: "'DM Sans', sans-serif", outline: 'none', boxSizing: 'border-box' }
  const labelStyle = { display: 'block', fontSize: 11, color: p.sub, letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 8 }

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

function AddMedicineModal({ night, onSave, onClose }) {
  const p = palette(night)
  const [medicineId, setMedicineId] = useState('paracetamol')
  const [customName, setCustomName] = useState('')
  const [doseMl,     setDoseMl]     = useState('')
  const [date,       setDate]       = useState(todayDateStr())
  const [logTime,    setLogTime]    = useState(timeStr(new Date().toISOString()))
  const [notes,      setNotes]      = useState('')

  const selected = MEDICINE_OPTIONS.find(m => m.id === medicineId)
  const inputStyle = { width: '100%', background: p.bg, border: `1px solid ${p.border}`, borderRadius: 11, padding: '11px 13px', fontSize: 16, color: p.text, fontFamily: "'DM Sans', sans-serif", outline: 'none', boxSizing: 'border-box' }
  const labelStyle = { display: 'block', fontSize: 11, color: p.sub, letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 8 }

  const handleSave = () => {
    const [y, mo, d] = date.split('-').map(Number)
    const [h, m]     = logTime.split(':').map(Number)
    const loggedAt   = new Date(y, mo - 1, d, h, m, 0, 0).toISOString()
    const name       = medicineId === 'other' ? customName.trim() : selected.label
    if (!name) return
    onSave({
      id: Date.now().toString(),
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
          <input value={customName} onChange={e => setCustomName(e.target.value)} placeholder="e.g. Vitamin D drops" style={{ ...inputStyle, marginBottom: 14 }} />
        </>
      )}

      <span style={labelStyle}>Dose (ml)</span>
      <input type="number" min="0" step="0.1" value={doseMl} onChange={e => setDoseMl(e.target.value)} placeholder="Optional" style={{ ...inputStyle, marginBottom: 14 }} />

      <span style={labelStyle}>Date & time</span>
      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        <input type="date" value={date}    onChange={e => setDate(e.target.value)}    style={{ ...inputStyle, flex: 1.4 }} />
        <input type="time" value={logTime} onChange={e => setLogTime(e.target.value)} style={{ ...inputStyle, flex: 1 }} />
      </div>

      <span style={labelStyle}>Notes</span>
      <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Reason, temperature, or advice from clinician" style={{ ...inputStyle, resize: 'vertical', marginBottom: 16 }} />

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

// ── Main screen ───────────────────────────────────────────────────────────────
export default function HistoryScreen({ night }) {
  const p = palette(night)

  const [sessions,    setSessions]    = useState(() => getSessions())
  const [nappies,     setNappies]     = useState(() => getNappies())
  const [medicines,   setMedicines]   = useState(() => getMedicines())
  const [openDay,     setOpenDay]     = useState(null)
  const [editSession, setEditSession] = useState(null)
  const [addMode,     setAddMode]     = useState(null)   // null | 'picker' | 'feed' | 'nappy' | 'medicine'
  const [confirmDel,  setConfirmDel]  = useState(null)   // { id, type }
  const [showInsights, setShowInsights] = useState(false)

  // ── Merge all entry types into one sorted timeline ────────────────────────
  const allEntries = useMemo(() => {
    const f = sessions.map(s => ({ ...s, _type: 'feed',  _time: s.startedAt }))
    const n = nappies.map(n  => ({ ...n, _type: 'nappy', _time: n.loggedAt  }))
    const m = medicines.map(m => ({ ...m, _type: 'medicine', _time: m.loggedAt }))
    return [...f, ...n, ...m].sort((a, b) => new Date(b._time) - new Date(a._time))
  }, [sessions, nappies, medicines])

  const grouped = useMemo(() => {
    const map = {}
    allEntries.forEach(entry => {
      const key = new Date(entry._time).toDateString()
      if (!map[key]) map[key] = { label: dayLabel(entry._time), entries: [] }
      map[key].entries.push(entry)
    })
    return Object.values(map)
  }, [allEntries])

  // ── Stats ─────────────────────────────────────────────────────────────────
  const todayStart = useMemo(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d }, [])

  const feedsToday = useMemo(() =>
    sessions.filter(s => new Date(s.startedAt) >= todayStart)
  , [sessions, todayStart])

  const feedTimeTodaySecs = useMemo(() =>
    feedsToday.reduce((a, s) => a + (s.durationSecs || 0), 0)
  , [feedsToday])

  const wetToday = useMemo(() =>
    nappies.filter(n => new Date(n.loggedAt) >= todayStart && (n.type === 'wet' || n.type === 'both')).length
  , [nappies, todayStart])

  const dirtyToday = useMemo(() =>
    nappies.filter(n => new Date(n.loggedAt) >= todayStart && (n.type === 'poo' || n.type === 'both')).length
  , [nappies, todayStart])

  const weekFeeds = useMemo(() => {
    const now    = new Date()
    const monday = new Date(now)
    monday.setHours(0, 0, 0, 0)
    monday.setDate(now.getDate() - (now.getDay() + 6) % 7)
    return sessions.filter(s => new Date(s.startedAt) >= monday)
  }, [sessions])

  const weekAvgDuration = useMemo(() => {
    if (!weekFeeds.length) return 0
    return Math.round(weekFeeds.reduce((a, s) => a + (s.durationSecs || 0), 0) / weekFeeds.length)
  }, [weekFeeds])

  const leftCount  = weekFeeds.filter(s => s.side === 'L').length
  const rightCount = weekFeeds.filter(s => s.side === 'R').length

  const insights = useMemo(() => {
    const days = []
    for (let i = 6; i >= 0; i--) {
      const d = new Date()
      d.setHours(0, 0, 0, 0)
      d.setDate(d.getDate() - i)
      days.push(d)
    }

    const byDay = Object.fromEntries(days.map(d => [dateStr(d.toISOString()), { feeds: 0, feedMins: 0, meds: 0, dirty: 0, moodTotal: 0, moodCount: 0 }]))
    sessions.forEach(s => {
      const k = dayKey(s.startedAt)
      if (!byDay[k]) return
      byDay[k].feeds += 1
      byDay[k].feedMins += Math.round((s.durationSecs || 0) / 60)
      if (s.mood) {
        byDay[k].moodTotal += s.mood
        byDay[k].moodCount += 1
      }
    })
    medicines.forEach(m => {
      const k = dayKey(m.loggedAt)
      if (!byDay[k]) return
      byDay[k].meds += 1
    })
    nappies.forEach(n => {
      const k = dayKey(n.loggedAt)
      if (!byDay[k]) return
      if (n.type === 'poo' || n.type === 'both') byDay[k].dirty += 1
    })

    const rows = days.map(d => {
      const k = dateStr(d.toISOString())
      const v = byDay[k]
      return {
        key: k,
        label: d.toLocaleDateString('en-GB', { weekday: 'short' }),
        ...v,
        avgMood: v.moodCount ? v.moodTotal / v.moodCount : null,
      }
    })

    const totalFeeds = rows.reduce((a, r) => a + r.feeds, 0)
    const totalMeds  = rows.reduce((a, r) => a + r.meds, 0)
    const ratedFeeds = rows.reduce((a, r) => a + r.moodCount, 0)
    const avgMood = ratedFeeds ? rows.reduce((a, r) => a + r.moodTotal, 0) / ratedFeeds : null
    const avgFeedMins = totalFeeds ? Math.round(rows.reduce((a, r) => a + r.feedMins, 0) / totalFeeds) : 0
    return { rows, totalFeeds, totalMeds, ratedFeeds, avgMood, avgFeedMins }
  }, [sessions, nappies, medicines])

  const weeklyMood = moodSummary(insights.avgMood)

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handleSaveEdit   = (id, changes) => { setSessions(updateSession(id, changes)); setEditSession(null) }
  const handleDeleteFeed = (id)          => { setSessions(deleteSession(id));           setEditSession(null) }
  const handleAddFeed    = (session)     => { setSessions(addSession(session));          setAddMode(null) }
  const handleAddNappy   = (nappy)       => { setNappies(addNappy(nappy));               setAddMode(null) }
  const handleAddMedicine = (medicine)   => { setMedicines(addMedicine(medicine));       setAddMode(null) }

  const handleDelete = ({ id, type }) => {
    if (type === 'nappy') setNappies(deleteNappy(id))
    if (type === 'medicine') setMedicines(deleteMedicine(id))
    setConfirmDel(null)
  }

  // ── Day summary line ──────────────────────────────────────────────────────
  function daySummary(entries) {
    const feeds   = entries.filter(e => e._type === 'feed').length
    const nappies = entries.filter(e => e._type === 'nappy').length
    const meds    = entries.filter(e => e._type === 'medicine').length
    const feedDur = entries.filter(e => e._type === 'feed').reduce((a, e) => a + (e.durationSecs || 0), 0)
    const parts   = []
    if (feeds   > 0) parts.push(`${feeds} feed${feeds !== 1 ? 's' : ''}`)
    if (nappies > 0) parts.push(`${nappies} napp${nappies !== 1 ? 'ies' : 'y'}`)
    if (meds > 0) parts.push(`${meds} med${meds !== 1 ? 's' : ''}`)
    if (feedDur > 0) parts.push(fmtMins(feedDur))
    return parts.join(' · ')
  }

  return (
    <div style={{ flex: 1, overflowY: 'auto', background: p.bg }}>

      <div style={{ padding: '20px 16px 12px', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <div>
          <span style={{ display: 'block', fontFamily: "'Cormorant Garamond', serif", fontSize: 12, color: brand.sand, letterSpacing: '.12em', textTransform: 'uppercase' }}>Your journey</span>
          <span style={{ display: 'block', fontFamily: "'Cormorant Garamond', serif", fontSize: 26, fontWeight: 400, color: night ? brand.parchment : brand.bark, marginTop: 2 }}>Logbook</span>
        </div>
        <button onClick={() => setAddMode('picker')} style={{ width: 36, height: 36, borderRadius: '50%', background: brand.bark, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 4 }}>
          <span style={{ color: brand.sand, fontSize: 22, lineHeight: 1, marginTop: -1 }}>+</span>
        </button>
      </div>

      {/* ── Today stats ── */}
      <div style={{ display: 'flex', gap: 8, padding: '0 14px 8px' }}>
        {[
          { val: feedsToday.length.toString(), lbl: 'feeds today',  sub: feedTimeTodaySecs > 0 ? fmtMins(feedTimeTodaySecs) : null },
          { val: wetToday.toString(),          lbl: 'wet today',    sub: null },
          { val: dirtyToday.toString(),        lbl: 'dirty today',  sub: null },
        ].map(({ val, lbl, sub }) => (
          <div key={lbl} style={{ flex: 1, background: p.card, borderRadius: 13, padding: '11px 8px', border: `1px solid ${p.border}`, textAlign: 'center' }}>
            <span style={{ display: 'block', fontFamily: "'Cormorant Garamond', serif", fontSize: 20, color: brand.bark }}>{val}</span>
            <span style={{ display: 'block', fontSize: 9, color: p.sub, lineHeight: 1.3, marginTop: 2 }}>{lbl}</span>
            {sub && <span style={{ display: 'block', fontSize: 9, color: p.sub, opacity: 0.65, marginTop: 1 }}>{sub}</span>}
          </div>
        ))}
      </div>

      <div style={{ padding: '0 14px 10px' }}>
        <button onClick={() => setShowInsights(v => !v)} style={{ width: '100%', border: `1px solid ${p.border}`, borderRadius: 12, background: p.card, color: p.text, padding: '10px 12px', fontSize: 12, fontWeight: 500, cursor: 'pointer' }}>
          {showInsights ? 'Back to logbook' : 'View weekly insights'}
        </button>
      </div>

      {showInsights && (
        <div style={{ margin: '0 14px 12px', background: p.card, borderRadius: 14, border: `1px solid ${p.border}`, padding: '12px' }}>
          <span style={{ display: 'block', fontSize: 11, color: p.sub, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 10 }}>
            Last 7 days
          </span>
          <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end', height: 120, marginBottom: 8 }}>
            {insights.rows.map(r => {
              const h = Math.max(8, r.feeds * 16)
              const dayMood = moodSummary(r.avgMood)
              return (
                <div key={r.key} style={{ flex: 1, textAlign: 'center' }}>
                  <div style={{ height: h, borderRadius: 8, background: brand.bark, opacity: .9 }} />
                  <span style={{ display: 'block', fontSize: 10, color: p.sub, marginTop: 4 }}>{r.label}</span>
                  <span style={{ display: 'block', fontSize: 10, color: p.sub }}>{r.feeds}</span>
                  <span style={{ display: 'block', fontSize: 11, lineHeight: 1.1 }}>{dayMood?.emoji || '·'}</span>
                </div>
              )
            })}
          </div>
          <span style={{ display: 'block', fontSize: 10, color: p.sub, marginBottom: 10 }}>Bars show feeds/day. Emoji shows the day's average feed feel when rated.</span>

          <div style={{ background: p.bg, border: `1px solid ${p.border}`, borderRadius: 12, padding: '10px 12px', marginBottom: 10 }}>
            <span style={{ display: 'block', fontSize: 10, color: p.sub, textTransform: 'uppercase', letterSpacing: '.06em' }}>Average feed feel</span>
            {weeklyMood ? (
              <span style={{ display: 'block', fontSize: 13, color: p.text, marginTop: 4 }}>
                <span style={{ fontSize: 20, verticalAlign: 'middle', marginRight: 6 }}>{weeklyMood.emoji}</span>
                {weeklyMood.label} · {weeklyMood.score}/5 across {insights.ratedFeeds} rated feed{insights.ratedFeeds !== 1 ? 's' : ''}
              </span>
            ) : (
              <span style={{ display: 'block', fontSize: 12, color: p.sub, marginTop: 4 }}>Rate a feed after stopping the timer to see this.</span>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
            <div style={{ background: p.bg, border: `1px solid ${p.border}`, borderRadius: 10, padding: 8 }}>
              <span style={{ display: 'block', fontSize: 10, color: p.sub }}>Feeds</span>
              <span style={{ fontSize: 16, color: p.text }}>{insights.totalFeeds}</span>
            </div>
            <div style={{ background: p.bg, border: `1px solid ${p.border}`, borderRadius: 10, padding: 8 }}>
              <span style={{ display: 'block', fontSize: 10, color: p.sub }}>Avg feed</span>
              <span style={{ fontSize: 16, color: p.text }}>{insights.avgFeedMins}m</span>
            </div>
            <div style={{ background: p.bg, border: `1px solid ${p.border}`, borderRadius: 10, padding: 8 }}>
              <span style={{ display: 'block', fontSize: 10, color: p.sub }}>Meds</span>
              <span style={{ fontSize: 16, color: p.text }}>{insights.totalMeds}</span>
            </div>
          </div>
        </div>
      )}

      {/* ── This week summary ── */}
      {weekFeeds.length > 0 && (
        <div style={{ margin: '0 14px 14px', background: p.card, borderRadius: 10, border: `1px solid ${p.border}`, padding: '8px 12px' }}>
          <span style={{ fontSize: 10, color: p.sub }}>
            {'This week · '}
            <span style={{ color: p.text, fontWeight: 500 }}>{weekFeeds.length} feed{weekFeeds.length !== 1 ? 's' : ''}</span>
            {weekAvgDuration > 0 && <>{' · avg '}<span style={{ color: p.text, fontWeight: 500 }}>{fmtMins(weekAvgDuration)}</span>{' each'}</>}
            {(leftCount + rightCount) > 0 && <>{' · L/R: '}<span style={{ color: p.text, fontWeight: 500 }}>{leftCount}/{rightCount}</span></>}
          </span>
        </div>
      )}

      {/* ── Day groups ── */}
      {!showInsights && (grouped.length === 0 ? (
        <div style={{ padding: '20px 14px' }}>
          <span style={{ fontSize: 13, color: p.sub }}>No entries yet. Your history will appear here.</span>
        </div>
      ) : (
        grouped.map(group => {
          const isOpen = openDay === group.label
          return (
            <div key={group.label} style={{ margin: '0 14px 10px', background: p.card, borderRadius: 16, border: `1px solid ${p.border}`, overflow: 'hidden' }}>
              <button onClick={() => setOpenDay(isOpen ? null : group.label)}
                style={{ width: '100%', padding: '13px 14px', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                <div style={{ flex: 1, textAlign: 'left' }}>
                  <span style={{ display: 'block', fontSize: 13, fontWeight: 600, color: p.text }}>{group.label}</span>
                  <span style={{ display: 'block', fontSize: 11, color: p.sub }}>{daySummary(group.entries)}</span>
                </div>
                <span style={{ color: p.sub, fontSize: 14, display: 'inline-block', transform: isOpen ? 'rotate(90deg)' : 'none', transition: 'transform .2s' }}>›</span>
              </button>

              {isOpen && (
                <div style={{ borderTop: `1px solid ${p.border}` }}>
                  {group.entries.map((entry, i) => {
                    const isLast      = i === group.entries.length - 1
                    const borderStyle = isLast ? 'none' : `1px solid ${p.border}`

                    // ── Feed row ──────────────────────────────────────────
                    if (entry._type === 'feed') return (
                      <div key={entry.id}
                        style={{ display: 'flex', alignItems: 'center', padding: '10px 14px', borderBottom: borderStyle, cursor: 'pointer' }}
                        onClick={() => setEditSession(entry)}>
                        <span style={{ fontSize: 11, color: p.sub, width: 42, flexShrink: 0 }}>{timeStr(entry.startedAt)}</span>
                        <div style={{ width: 26, height: 26, borderRadius: '50%', background: p.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 10px', flexShrink: 0 }}>
                          <span style={{ fontSize: 10, fontWeight: 600, color: brand.sand }}>{entry.side}</span>
                        </div>
                        <div style={{ flex: 1 }}>
                          <span style={{ display: 'block', fontSize: 12, color: p.text }}>{entry.side === 'L' ? 'Left' : 'Right'} breast</span>
                          {entry.mood && <span style={{ display: 'block', fontSize: 10, color: p.sub, marginTop: 1 }}>{MOOD_EMOJI[entry.mood - 1]} {MOOD_LABEL[entry.mood - 1]}</span>}
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <span style={{ display: 'block', fontSize: 11, color: p.sub }}>{fmt(entry.durationSecs || 0)}</span>
                          <span style={{ fontSize: 10, color: p.sub, opacity: 0.5 }}>edit</span>
                        </div>
                      </div>
                    )

                    // ── Nappy row ─────────────────────────────────────────
                    if (entry._type === 'nappy') {
                      const nappyEmoji = entry.type === 'wet' ? '💧' : entry.type === 'poo' ? '💩' : '💧💩'
                      const nappyLabel = entry.type === 'wet' ? 'Wee' : entry.type === 'poo' ? 'Poo' : 'Wee & Poo'
                      const isDel      = confirmDel?.id === entry.id
                      return (
                        <div key={entry.id} style={{ display: 'flex', alignItems: 'center', padding: '10px 14px', borderBottom: borderStyle }}>
                          <span style={{ fontSize: 11, color: p.sub, width: 42, flexShrink: 0 }}>{timeStr(entry.loggedAt)}</span>
                          <div style={{ width: 26, height: 26, borderRadius: '50%', background: p.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 10px', flexShrink: 0, fontSize: 13 }}>
                            {nappyEmoji}
                          </div>
                          <div style={{ flex: 1 }}>
                            <span style={{ display: 'block', fontSize: 12, color: p.text }}>{nappyLabel}</span>
                            {entry.pooColor && (
                              <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: p.sub, marginTop: 1 }}>
                                <span style={{ width: 7, height: 7, borderRadius: '50%', background: POO_HEX[entry.pooColor], display: 'inline-block' }} />
                                {POO_LABEL[entry.pooColor]}
                              </span>
                            )}
                          </div>
                          {isDel ? (
                            <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                              <button onClick={() => setConfirmDel(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: p.sub, padding: '2px 6px' }}>Cancel</button>
                              <button onClick={() => handleDelete({ id: entry.id, type: 'nappy' })} style={{ background: '#c0392b', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 11, color: '#fff', padding: '2px 8px', fontWeight: 500 }}>Delete</button>
                            </div>
                          ) : (
                            <button onClick={() => setConfirmDel({ id: entry.id, type: 'nappy' })} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 17, color: p.sub, padding: '0 2px', lineHeight: 1, flexShrink: 0 }}>×</button>
                          )}
                        </div>
                      )
                    }

                    if (entry._type === 'medicine') {
                      const isDel = confirmDel?.id === entry.id
                      return (
                        <div key={entry.id} style={{ display: 'flex', alignItems: 'center', padding: '10px 14px', borderBottom: borderStyle }}>
                          <span style={{ fontSize: 11, color: p.sub, width: 42, flexShrink: 0 }}>{timeStr(entry.loggedAt)}</span>
                          <div style={{ width: 26, height: 26, borderRadius: '50%', background: p.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 10px', flexShrink: 0, fontSize: 12 }}>
                            💊
                          </div>
                          <div style={{ flex: 1 }}>
                            <span style={{ display: 'block', fontSize: 12, color: p.text }}>{entry.name}{entry.doseMl ? ` · ${entry.doseMl}ml` : ''}</span>
                            {entry.notes && <span style={{ display: 'block', fontSize: 10, color: p.sub, marginTop: 1 }}>{entry.notes}</span>}
                          </div>
                          {isDel ? (
                            <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                              <button onClick={() => setConfirmDel(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: p.sub, padding: '2px 6px' }}>Cancel</button>
                              <button onClick={() => handleDelete({ id: entry.id, type: 'medicine' })} style={{ background: '#c0392b', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 11, color: '#fff', padding: '2px 8px', fontWeight: 500 }}>Delete</button>
                            </div>
                          ) : (
                            <button onClick={() => setConfirmDel({ id: entry.id, type: 'medicine' })} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 17, color: p.sub, padding: '0 2px', lineHeight: 1, flexShrink: 0 }}>×</button>
                          )}
                        </div>
                      )
                    }

                    return null
                  })}
                </div>
              )}
            </div>
          )
        })
      ))}

      <div style={{ height: 20 }} />

      {/* ── Edit feed modal ── */}
      {editSession && (
        <EditModal session={editSession} night={night} onSave={handleSaveEdit} onDelete={handleDeleteFeed} onClose={() => setEditSession(null)} />
      )}

      {/* ── Add type picker ── */}
      {addMode === 'picker' && (
        <div onClick={() => setAddMode(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 100, padding: '0 0 env(safe-area-inset-bottom, 0)' }}>
          <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 430, background: p.card, borderRadius: '20px 20px 0 0', padding: '20px 20px 32px', border: `1px solid ${p.border}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <span style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 20, color: night ? brand.parchment : brand.bark }}>Add entry</span>
              <button onClick={() => setAddMode(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: p.sub }}>×</button>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              {[
                { mode: 'feed',  icon: '🍼', label: 'Feed'  },
                { mode: 'nappy', icon: '💧', label: 'Nappy' },
                { mode: 'medicine', icon: '💊', label: 'Medicine' },
              ].map(({ mode, icon, label }) => (
                <button key={mode} onClick={() => setAddMode(mode)}
                  style={{ flex: 1, padding: '18px 8px', borderRadius: 14, border: `1px solid ${p.border}`, background: p.bg, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, WebkitTapHighlightColor: 'transparent' }}>
                  <span style={{ fontSize: 26, lineHeight: 1 }}>{icon}</span>
                  <span style={{ fontSize: 13, color: p.text, fontWeight: 500 }}>{label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Add modals ── */}
      {addMode === 'feed'  && <AddFeedModal  night={night} onSave={handleAddFeed}  onClose={() => setAddMode(null)} />}
      {addMode === 'nappy' && <AddNappyModal night={night} onSave={handleAddNappy} onClose={() => setAddMode(null)} />}
      {addMode === 'medicine' && <AddMedicineModal night={night} onSave={handleAddMedicine} onClose={() => setAddMode(null)} />}
    </div>
  )
}
