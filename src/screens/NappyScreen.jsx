import { useState, useMemo, useEffect } from 'react'
import { brand, palette } from '../theme.js'
import { getNappies, addNappy } from '../lib/storage.js'
import { syncWrite } from '../lib/sync.js'
import { dateStr, timeStr } from '../utils/time.js'
import { POO_COLORS } from '../lib/constants.js'
import { newId } from '../lib/id.js'

function timeSinceShort(iso) {
  if (!iso) return '—'
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (diff < 60) return '< 1m'
  // Compact stat — roll over to days past 24h ("14d" rather than "350h")
  const days = Math.floor(diff / 86400)
  if (days >= 1) return `${days}d`
  const h = Math.floor(diff / 3600)
  const m = Math.floor((diff % 3600) / 60)
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

function todayMidnight() {
  const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime()
}

// Log-only screen — no history list here — that's what the Logbook is for.
export default function NappyScreen({ night, authUser, profile, sharedNappies, onNappySaved }) {
  const p = palette(night)

  const [nappies,      setNappies]      = useState(() => getNappies())
  const [type,         setType]         = useState(null)     // 'wet' | 'poo' | 'both'
  const [pooColor,     setPooColor]     = useState('mustard')
  const [logDate,      setLogDate]      = useState(() => dateStr())
  const [logTime,      setLogTime]      = useState(() => timeStr())
  const [editingTime,  setEditingTime]  = useState(false)
  const [justLogged,   setJustLogged]   = useState(false)

  // Guard: don't overwrite state while user is actively composing a nappy entry.
  // Runs for an empty array too, so the list clears when the household has no entries.
  useEffect(() => {
    if (!sharedNappies) return
    if (type !== null) return
    setNappies(sharedNappies.map(n => ({
      id: n.id, type: n.type, pooColor: n.poo_color ?? n.pooColor, loggedAt: n.logged_at ?? n.loggedAt,
    })))
  }, [sharedNappies, type])

  // Re-render every 30s so "last change" stays current
  const [, setClockTick] = useState(0)
  useEffect(() => {
    const tick = setInterval(() => setClockTick(t => t + 1), 30000)
    return () => clearInterval(tick)
  }, [])

  const todayNappies = useMemo(() => {
    const start = todayMidnight()
    return nappies.filter(n => new Date(n.loggedAt).getTime() >= start)
  }, [nappies])

  const wetToday  = todayNappies.filter(n => n.type === 'wet'  || n.type === 'both').length
  const pooToday  = todayNappies.filter(n => n.type === 'poo'  || n.type === 'both').length
  const lastNappy = nappies.reduce((latest, n) =>
    !latest || new Date(n.loggedAt) > new Date(latest.loggedAt) ? n : latest
  , null)

  const needsColor = type === 'poo' || type === 'both'
  const selectedColor = POO_COLORS.find(c => c.id === pooColor)

  const handleLog = () => {
    if (!type) return
    const [y, mo, d] = logDate.split('-').map(Number)
    const [h, m]     = logTime.split(':').map(Number)
    const loggedAt   = new Date(y, mo - 1, d, h, m, 0, 0).toISOString()
    const nappy = { id: newId(), type, pooColor: needsColor ? pooColor : null, loggedAt }
    setNappies(addNappy(nappy))
    if (authUser && profile?.household_id) {
      syncWrite('nappy.insert', { id: nappy.id, householdId: profile.household_id, loggedBy: authUser.id, type, pooColor: nappy.pooColor, loggedAt })
        .then(({ ok }) => { if (ok) onNappySaved?.() })
    }
    setType(null)
    setEditingTime(false)
    setLogDate(dateStr())
    setLogTime(timeStr())
    setJustLogged(true)
    setTimeout(() => setJustLogged(false), 1800)
  }

  // Colour and label for each nappy type
  const TYPE_META = {
    wet:  { bg: brand.sand,   fg: brand.bark,  emoji: '💧', label: 'Wee'  },
    poo:  { bg: brand.bark,   fg: brand.sand,  emoji: '💩', label: 'Poo'  },
    both: { bg: brand.accent, fg: '#fff',       emoji: '💧💩', label: 'Both' },
  }

  const btnStyle = (t) => ({
    flex: 1, padding: '22px 6px', borderRadius: 16, cursor: 'pointer',
    border:      `1.5px solid ${type === t ? TYPE_META[t].bg : p.border}`,
    background:  type === t ? TYPE_META[t].bg : 'transparent',
    color:       type === t ? TYPE_META[t].fg : p.sub,
    display:     'flex', flexDirection: 'column', alignItems: 'center', gap: 7,
    transition:  'all .18s',
    WebkitTapHighlightColor: 'transparent',
  })

  const inputStyle = {
    background: p.bg, border: `1px solid ${p.border}`, borderRadius: 12,
    padding: '13px 14px', fontSize: 15, color: p.text,
    fontFamily: "'Jost', sans-serif", outline: 'none',
  }

  return (
    <div style={{ flex: 1, overflowY: 'auto', background: p.bg }}>
      <div style={{ minHeight: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-evenly', padding: '12px 0' }}>

      {/* Header */}
      <div style={{ padding: '8px 16px 16px', textAlign: 'center' }}>
        <div style={{ width: 52, height: 52, borderRadius: '50%', background: `${brand.mist}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
          <span style={{ fontSize: 24, color: brand.mist, lineHeight: 1 }}>◈</span>
        </div>
        <span style={{ display: 'block', fontFamily: "'Cormorant Garamond', serif", fontSize: 12, color: brand.sand, letterSpacing: '.12em', textTransform: 'uppercase' }}>Keep track</span>
        <span style={{ display: 'block', fontFamily: "'Cormorant Garamond', serif", fontSize: 34, fontWeight: 400, color: p.heading, marginTop: 4 }}>Nappies</span>
      </div>

      {/* Stats — bigger, roomier tiles */}
      <div style={{ display: 'flex', gap: 10, padding: '0 16px 20px' }}>
        {[
          [timeSinceShort(lastNappy?.loggedAt), 'last change'],
          [wetToday.toString(),                  'wees today' ],
          [pooToday.toString(),                  'poos today' ],
        ].map(([val, lbl]) => (
          <div key={lbl} style={{ flex: 1, background: p.card, borderRadius: 16, padding: '18px 8px', border: `1px solid ${p.border}`, textAlign: 'center' }}>
            <span style={{ display: 'block', fontFamily: "'Cormorant Garamond', serif", fontSize: val.length > 5 ? 20 : 28, color: p.heading, lineHeight: 1.2 }}>{val}</span>
            <span style={{ display: 'block', fontSize: 11, color: p.sub, lineHeight: 1.3, marginTop: 5 }}>{lbl}</span>
          </div>
        ))}
      </div>

      {/* Log card */}
      <div style={{ margin: '0 16px 16px', background: p.card, borderRadius: 20, border: `1px solid ${p.border}`, padding: '18px 16px' }}>

        <span style={{ display: 'block', fontSize: 12, color: p.sub, letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 14 }}>Log a change</span>

        {/* Type buttons */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
          {['wet', 'poo', 'both'].map(t => (
            <button key={t} style={btnStyle(t)} onClick={() => setType(t)}>
              <span style={{ fontSize: t === 'both' ? 22 : 26, lineHeight: 1 }}>{TYPE_META[t].emoji}</span>
              <span style={{ fontSize: 14, fontWeight: 600, fontFamily: "'Jost', sans-serif" }}>{TYPE_META[t].label}</span>
            </button>
          ))}
        </div>

        {/* Poo colour picker */}
        {needsColor && (
          <div style={{ marginBottom: 16 }}>
            <span style={{ display: 'block', fontSize: 11, color: p.sub, letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 10 }}>Colour</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {POO_COLORS.map(c => (
                <button key={c.id} onClick={() => setPooColor(c.id)} style={{
                  width: 32, height: 32, borderRadius: '50%', background: c.hex, padding: 0,
                  border:   pooColor === c.id ? `2px solid ${brand.sand}` : `2px solid transparent`,
                  outline:  pooColor === c.id ? `2px solid ${brand.bark}` : 'none',
                  outlineOffset: 1,
                  cursor:  'pointer', flexShrink: 0, transition: 'all .15s',
                  WebkitTapHighlightColor: 'transparent',
                }} />
              ))}
              <span style={{ fontSize: 12, color: p.sub, marginLeft: 2 }}>{selectedColor?.label}</span>
            </div>
            {selectedColor?.note && (
              <div style={{ marginTop: 10, padding: '10px 12px', background: p.bg, borderRadius: 11, border: `1px solid ${p.border}` }}>
                <span style={{ fontSize: 12, color: p.sub, lineHeight: 1.55 }}>{selectedColor.note}</span>
              </div>
            )}
          </div>
        )}

        {/* Time */}
        <div style={{ marginBottom: 16 }}>
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
              <span style={{ fontSize: 12, opacity: 0.45 }}>edit</span>
            </button>
          )}
        </div>

        {/* Log button / confirmation */}
        {justLogged ? (
          <div style={{ padding: '16px', borderRadius: 14, background: brand.green, textAlign: 'center' }}>
            <span style={{ color: '#fff', fontSize: 15, fontWeight: 600 }}>✓ Logged</span>
          </div>
        ) : (
          <button onClick={handleLog} disabled={!type} style={{
            width: '100%', padding: '16px', borderRadius: 14, border: 'none',
            background: type ? brand.bark : p.border,
            color:      type ? brand.sand : p.sub,
            cursor:     type ? 'pointer'  : 'default',
            fontSize: 15, fontWeight: 600,
            transition: 'all .2s',
            WebkitTapHighlightColor: 'transparent',
          }}>
            Log nappy
          </button>
        )}
      </div>

      </div>
    </div>
  )
}
