import { useState, useMemo } from 'react'
import { brand, palette } from '../theme.js'
import { getNappies, addNappy, deleteNappy } from '../lib/storage.js'

// Poo colours — ordered lightest to darkest, with clinical notes where relevant
const POO_COLORS = [
  { id: 'mustard', hex: '#D4A843', label: 'Mustard',    note: null },
  { id: 'yellow',  hex: '#EDD050', label: 'Yellow',     note: null },
  { id: 'green',   hex: '#6B9E5C', label: 'Green',      note: 'Green poo can indicate a foremilk/hindmilk imbalance — try longer feeds on one side.' },
  { id: 'brown',   hex: '#8B6347', label: 'Brown',      note: null },
  { id: 'dark',    hex: '#2D1F14', label: 'Dark/Black', note: '⚠ Dark or black poo in a baby over 5 days old should be checked by your midwife or GP.' },
]

function timeSinceShort(iso) {
  if (!iso) return '—'
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (diff < 60) return '< 1m'
  const h = Math.floor(diff / 3600)
  const m = Math.floor((diff % 3600) / 60)
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

function timeSinceLabel(iso) {
  if (!iso) return ''
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (diff < 60) return 'just now'
  const h = Math.floor(diff / 3600)
  const m = Math.floor((diff % 3600) / 60)
  return h > 0 ? `${h}h ${m}m ago` : `${m}m ago`
}

function fmtDateTime(iso) {
  const d = new Date(iso)
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)
  const time = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  if (d.toDateString() === today.toDateString()) return time
  if (d.toDateString() === yesterday.toDateString()) return `Yesterday ${time}`
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) + ' · ' + time
}

function dateStr(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function timeStr(d = new Date()) {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function todayMidnight() {
  const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime()
}

// ── Main screen ───────────────────────────────────────────────────────────────
export default function NappyScreen({ night }) {
  const p = palette(night)

  const [nappies,      setNappies]      = useState(() => getNappies())
  const [type,         setType]         = useState(null)     // 'wet' | 'poo' | 'both'
  const [pooColor,     setPooColor]     = useState('mustard')
  const [logDate,      setLogDate]      = useState(() => dateStr())
  const [logTime,      setLogTime]      = useState(() => timeStr())
  const [editingTime,  setEditingTime]  = useState(false)
  const [justLogged,   setJustLogged]   = useState(false)
  const [confirmDel,   setConfirmDel]   = useState(null)

  const sortedNappies = useMemo(() =>
    [...nappies].sort((a, b) => new Date(b.loggedAt) - new Date(a.loggedAt)),
  [nappies])

  const todayNappies = useMemo(() => {
    const start = todayMidnight()
    return sortedNappies.filter(n => new Date(n.loggedAt).getTime() >= start)
  }, [sortedNappies])

  const wetToday  = todayNappies.filter(n => n.type === 'wet'  || n.type === 'both').length
  const pooToday  = todayNappies.filter(n => n.type === 'poo'  || n.type === 'both').length
  const lastNappy = sortedNappies[0] || null

  const needsColor = type === 'poo' || type === 'both'
  const selectedColor = POO_COLORS.find(c => c.id === pooColor)

  const handleLog = () => {
    if (!type) return
    const [y, mo, d] = logDate.split('-').map(Number)
    const [h, m]     = logTime.split(':').map(Number)
    const loggedAt   = new Date(y, mo - 1, d, h, m, 0, 0).toISOString()
    const nappy = {
      id:       Date.now().toString(),
      type,
      pooColor: needsColor ? pooColor : null,
      loggedAt,
    }
    setNappies(addNappy(nappy))
    setType(null)
    setEditingTime(false)
    setLogDate(dateStr())
    setLogTime(timeStr())
    setJustLogged(true)
    setTimeout(() => setJustLogged(false), 1800)
  }

  const handleDelete = (id) => {
    setNappies(deleteNappy(id))
    setConfirmDel(null)
  }

  // Colour and label for each nappy type
  const TYPE_META = {
    wet:  { bg: brand.sand,   fg: brand.bark,  dot: '#D4C070', emoji: '💧', label: 'Wee'  },
    poo:  { bg: brand.bark,   fg: brand.sand,  dot: brand.bark, emoji: '💩', label: 'Poo'  },
    both: { bg: brand.accent, fg: '#fff',       dot: brand.accent, emoji: '💧💩', label: 'Both' },
  }

  const btnStyle = (t) => ({
    flex: 1, padding: '15px 6px', borderRadius: 13, cursor: 'pointer',
    border:      `1.5px solid ${type === t ? TYPE_META[t].bg : p.border}`,
    background:  type === t ? TYPE_META[t].bg : 'transparent',
    color:       type === t ? TYPE_META[t].fg : p.sub,
    display:     'flex', flexDirection: 'column', alignItems: 'center', gap: 5,
    transition:  'all .18s',
    WebkitTapHighlightColor: 'transparent',
  })

  const inputStyle = {
    background: p.bg, border: `1px solid ${p.border}`, borderRadius: 11,
    padding: '10px 12px', fontSize: 14, color: p.text,
    fontFamily: "'DM Sans', sans-serif", outline: 'none',
  }

  return (
    <div style={{ flex: 1, overflowY: 'auto', background: p.bg }}>

      {/* Header */}
      <div style={{ padding: '20px 16px 12px' }}>
        <span style={{ display: 'block', fontFamily: "'Cormorant Garamond', serif", fontSize: 12, color: brand.sand, letterSpacing: '.12em', textTransform: 'uppercase' }}>Keep track</span>
        <span style={{ display: 'block', fontFamily: "'Cormorant Garamond', serif", fontSize: 26, fontWeight: 400, color: night ? brand.parchment : brand.bark, marginTop: 2 }}>Nappies</span>
      </div>

      {/* Stats */}
      <div style={{ display: 'flex', gap: 8, padding: '0 14px 14px' }}>
        {[
          [timeSinceShort(lastNappy?.loggedAt), 'last change'],
          [wetToday.toString(),                  'wees today' ],
          [pooToday.toString(),                  'poos today' ],
        ].map(([val, lbl]) => (
          <div key={lbl} style={{ flex: 1, background: p.card, borderRadius: 13, padding: '11px 8px', border: `1px solid ${p.border}`, textAlign: 'center' }}>
            <span style={{ display: 'block', fontFamily: "'Cormorant Garamond', serif", fontSize: val.length > 5 ? 15 : 20, color: brand.bark, lineHeight: 1.2 }}>{val}</span>
            <span style={{ display: 'block', fontSize: 9, color: p.sub, lineHeight: 1.3, marginTop: 3 }}>{lbl}</span>
          </div>
        ))}
      </div>

      {/* Log card */}
      <div style={{ margin: '0 14px 14px', background: p.card, borderRadius: 18, border: `1px solid ${p.border}`, padding: '16px 14px' }}>

        <span style={{ display: 'block', fontSize: 11, color: p.sub, letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 12 }}>Log a change</span>

        {/* Type buttons */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
          {['wet', 'poo', 'both'].map(t => (
            <button key={t} style={btnStyle(t)} onClick={() => setType(t)}>
              <span style={{ fontSize: t === 'both' ? 18 : 22, lineHeight: 1 }}>{TYPE_META[t].emoji}</span>
              <span style={{ fontSize: 12, fontWeight: 500, fontFamily: "'DM Sans', sans-serif" }}>{TYPE_META[t].label}</span>
            </button>
          ))}
        </div>

        {/* Poo colour picker */}
        {needsColor && (
          <div style={{ marginBottom: 14 }}>
            <span style={{ display: 'block', fontSize: 11, color: p.sub, letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 10 }}>Colour</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {POO_COLORS.map(c => (
                <button key={c.id} onClick={() => setPooColor(c.id)} style={{
                  width: 28, height: 28, borderRadius: '50%', background: c.hex, padding: 0,
                  border:   pooColor === c.id ? `2px solid ${brand.sand}` : `2px solid transparent`,
                  outline:  pooColor === c.id ? `2px solid ${brand.bark}` : 'none',
                  outlineOffset: 1,
                  cursor:  'pointer', flexShrink: 0, transition: 'all .15s',
                  WebkitTapHighlightColor: 'transparent',
                }} />
              ))}
              <span style={{ fontSize: 11, color: p.sub, marginLeft: 2 }}>{selectedColor?.label}</span>
            </div>
            {selectedColor?.note && (
              <div style={{ marginTop: 10, padding: '9px 11px', background: p.bg, borderRadius: 10, border: `1px solid ${p.border}` }}>
                <span style={{ fontSize: 11, color: p.sub, lineHeight: 1.55 }}>{selectedColor.note}</span>
              </div>
            )}
          </div>
        )}

        {/* Time */}
        <div style={{ marginBottom: 14 }}>
          {editingTime ? (
            <div style={{ display: 'flex', gap: 8 }}>
              <input type="date" value={logDate} onChange={e => setLogDate(e.target.value)} style={{ ...inputStyle, flex: 1.5 }} />
              <input type="time" value={logTime} onChange={e => setLogTime(e.target.value)} style={{ ...inputStyle, flex: 1   }} />
            </div>
          ) : (
            <button onClick={() => setEditingTime(true)} style={{
              width: '100%', ...inputStyle, cursor: 'pointer',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <span>🕐 {logTime} · {logDate === dateStr() ? 'Now' : logDate}</span>
              <span style={{ fontSize: 11, opacity: 0.45 }}>edit</span>
            </button>
          )}
        </div>

        {/* Log button / confirmation */}
        {justLogged ? (
          <div style={{ padding: '14px', borderRadius: 13, background: brand.green, textAlign: 'center' }}>
            <span style={{ color: '#fff', fontSize: 14, fontWeight: 500 }}>✓ Logged</span>
          </div>
        ) : (
          <button onClick={handleLog} disabled={!type} style={{
            width: '100%', padding: '14px', borderRadius: 13, border: 'none',
            background: type ? brand.bark : p.border,
            color:      type ? brand.sand : p.sub,
            cursor:     type ? 'pointer'  : 'default',
            fontSize: 14, fontWeight: 500,
            transition: 'all .2s',
            WebkitTapHighlightColor: 'transparent',
          }}>
            Log nappy
          </button>
        )}
      </div>

      {/* History */}
      <div style={{ padding: '0 14px' }}>
        <span style={{ display: 'block', fontSize: 10, color: p.sub, letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 10 }}>Recent</span>

        {nappies.length === 0 ? (
          <span style={{ fontSize: 13, color: p.sub }}>No nappies logged yet. Tap a type above to begin.</span>
        ) : (
          sortedNappies.slice(0, 20).map((n, i) => {
            const meta  = TYPE_META[n.type]
            const pooC  = POO_COLORS.find(c => c.id === n.pooColor)
            return (
              <div key={n.id} style={{
                display: 'flex', alignItems: 'center',
                padding: '10px 0',
                borderBottom: i < Math.min(sortedNappies.length, 20) - 1 ? `1px solid ${p.border}` : 'none',
              }}>
                {/* Type dot */}
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: meta.dot, marginRight: 10, flexShrink: 0 }} />

                {/* Labels */}
                <div style={{ flex: 1 }}>
                  <span style={{ display: 'block', fontSize: 13, color: p.text, fontWeight: 500 }}>{meta.label}</span>
                  {pooC && (
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: p.sub, marginTop: 1 }}>
                      <span style={{ width: 7, height: 7, borderRadius: '50%', background: pooC.hex, display: 'inline-block', flexShrink: 0 }} />
                      {pooC.label}
                    </span>
                  )}
                </div>

                {/* Time */}
                <div style={{ textAlign: 'right', marginRight: 12 }}>
                  <span style={{ display: 'block', fontSize: 11, color: p.sub }}>{timeSinceLabel(n.loggedAt)}</span>
                  <span style={{ display: 'block', fontSize: 10, color: p.sub, opacity: 0.55 }}>{fmtDateTime(n.loggedAt)}</span>
                </div>

                {/* Delete */}
                {confirmDel === n.id ? (
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    <button onClick={() => setConfirmDel(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: p.sub, padding: '2px 6px' }}>Cancel</button>
                    <button onClick={() => handleDelete(n.id)}  style={{ background: '#c0392b', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 11, color: '#fff', padding: '2px 8px', fontWeight: 500 }}>Delete</button>
                  </div>
                ) : (
                  <button onClick={() => setConfirmDel(n.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 17, color: p.sub, padding: '0 2px', lineHeight: 1, flexShrink: 0 }}>×</button>
                )}
              </div>
            )
          })
        )}
      </div>

      <div style={{ height: 24 }} />
    </div>
  )
}
