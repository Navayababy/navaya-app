import { useState, useMemo } from 'react'
import { brand, palette } from '../theme.js'
import { getSessions, updateSession } from '../lib/storage.js'

const MOOD_EMOJI = ['😔', '😐', '🙂', '😊', '🤩']
const MOOD_LABEL = ['Tough', 'Okay', 'Good', 'Great', 'Amazing']

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

// Convert HH:MM string back to a full ISO string on the same date as the original
function applyTimeEdit(originalISO, newTimeStr) {
  const [h, m] = newTimeStr.split(':').map(Number)
  const d = new Date(originalISO)
  d.setHours(h, m, 0, 0)
  return d.toISOString()
}

// ── Edit modal ────────────────────────────────────────────────────────────────
function EditModal({ session, night, onSave, onClose }) {
  const p = palette(night)
  const [startTime, setStartTime] = useState(timeStr(session.startedAt))
  const [endTime,   setEndTime]   = useState(session.endedAt ? timeStr(session.endedAt) : '')
  const [side,      setSide]      = useState(session.side)

  const handleSave = () => {
    const newStartedAt = applyTimeEdit(session.startedAt, startTime)
    const newEndedAt   = endTime ? applyTimeEdit(session.endedAt || session.startedAt, endTime) : session.endedAt
    onSave(session.id, { side, startedAt: newStartedAt, endedAt: newEndedAt })
  }

  return (
    // Backdrop
    <div onClick={onClose} style={{
      position:   'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
      display:    'flex', alignItems: 'flex-end', justifyContent: 'center',
      zIndex:     100, padding: '0 0 env(safe-area-inset-bottom, 0)',
    }}>
      {/* Sheet — stop clicks propagating */}
      <div onClick={e => e.stopPropagation()} style={{
        width:        '100%', maxWidth: 430,
        background:   p.card, borderRadius: '20px 20px 0 0',
        padding:      '20px 20px 28px',
        border:       `1px solid ${p.border}`,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <span style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 20, color: night ? brand.parchment : brand.bark }}>Edit feed</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: p.sub }}>×</button>
        </div>

        {/* Side */}
        <span style={{ display: 'block', fontSize: 11, color: p.sub, letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 8 }}>Side</span>
        <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
          {['L', 'R'].map(s => (
            <button key={s} onClick={() => setSide(s)}
              style={{ flex: 1, padding: '12px', borderRadius: 11, border: `1.5px solid ${side === s ? brand.sand : p.border}`, background: side === s ? brand.bark : 'transparent', cursor: 'pointer', color: side === s ? brand.sand : p.sub, fontSize: 13, fontWeight: 500 }}>
              {s === 'L' ? 'Left' : 'Right'}
            </button>
          ))}
        </div>

        {/* Start time */}
        <span style={{ display: 'block', fontSize: 11, color: p.sub, letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 8 }}>Start time</span>
        <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)}
          style={{ width: '100%', background: p.bg, border: `1px solid ${p.border}`, borderRadius: 11, padding: '11px 13px', fontSize: 16, color: p.text, fontFamily: "'DM Sans', sans-serif", outline: 'none', marginBottom: 14 }} />

        {/* End time */}
        <span style={{ display: 'block', fontSize: 11, color: p.sub, letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 8 }}>End time</span>
        <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)}
          style={{ width: '100%', background: p.bg, border: `1px solid ${p.border}`, borderRadius: 11, padding: '11px 13px', fontSize: 16, color: p.text, fontFamily: "'DM Sans', sans-serif", outline: 'none', marginBottom: 20 }} />

        <button onClick={handleSave}
          style={{ width: '100%', padding: '14px', borderRadius: 13, border: 'none', background: brand.bark, color: brand.sand, cursor: 'pointer', fontSize: 14, fontWeight: 500 }}>
          Save changes
        </button>
      </div>
    </div>
  )
}

// ── Main screen ───────────────────────────────────────────────────────────────
export default function HistoryScreen({ night }) {
  const p = palette(night)
  const [sessions,    setSessions]    = useState(() => getSessions())
  const [openDay,     setOpenDay]     = useState(null)
  const [editSession, setEditSession] = useState(null)

  const grouped = useMemo(() => {
    const map = {}
    sessions.forEach(s => {
      const key = new Date(s.startedAt).toDateString()
      if (!map[key]) map[key] = { label: dayLabel(s.startedAt), sessions: [] }
      map[key].sessions.push(s)
    })
    return Object.values(map)
  }, [sessions])

  const weekSessions = useMemo(() => {
    const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000
    return sessions.filter(s => new Date(s.startedAt).getTime() > cutoff)
  }, [sessions])

  const totalSecs  = weekSessions.reduce((a, s) => a + (s.durationSecs || 0), 0)
  const avgPerDay  = weekSessions.length > 0 ? Math.round(totalSecs / 7) : 0
  const leftCount  = weekSessions.filter(s => s.side === 'L').length
  const rightCount = weekSessions.filter(s => s.side === 'R').length
  const mostUsed   = leftCount >= rightCount ? 'L' : 'R'

  const handleSaveEdit = (id, changes) => {
    const updated = updateSession(id, changes)
    setSessions(updated)
    setEditSession(null)
  }

  return (
    <div style={{ flex: 1, overflowY: 'auto', background: p.bg }}>

      <div style={{ padding: '20px 16px 12px' }}>
        <span style={{ display: 'block', fontFamily: "'Cormorant Garamond', serif", fontSize: 12, color: brand.sand, letterSpacing: '.12em', textTransform: 'uppercase' }}>Your journey</span>
        <span style={{ display: 'block', fontFamily: "'Cormorant Garamond', serif", fontSize: 26, fontWeight: 400, color: night ? brand.parchment : brand.bark, marginTop: 2 }}>History</span>
      </div>

      {/* Stats */}
      <div style={{ display: 'flex', gap: 8, padding: '0 14px 14px' }}>
        {[
          [weekSessions.length.toString(), 'feeds this week'],
          [fmtMins(avgPerDay),              'average daily'],
          [mostUsed,                         'most used side'],
        ].map(([val, lbl]) => (
          <div key={lbl} style={{ flex: 1, background: p.card, borderRadius: 13, padding: '11px 8px', border: `1px solid ${p.border}`, textAlign: 'center' }}>
            <span style={{ display: 'block', fontFamily: "'Cormorant Garamond', serif", fontSize: 20, color: brand.bark }}>{val}</span>
            <span style={{ display: 'block', fontSize: 9, color: p.sub, lineHeight: 1.3, marginTop: 2 }}>{lbl}</span>
          </div>
        ))}
      </div>

      {/* Day groups */}
      {grouped.length === 0 ? (
        <div style={{ padding: '20px 14px' }}>
          <span style={{ fontSize: 13, color: p.sub }}>No feeds logged yet. Your history will appear here.</span>
        </div>
      ) : (
        grouped.map(group => {
          const dayTotal = group.sessions.reduce((a, s) => a + (s.durationSecs || 0), 0)
          const isOpen   = openDay === group.label

          return (
            <div key={group.label} style={{ margin: '0 14px 10px', background: p.card, borderRadius: 16, border: `1px solid ${p.border}`, overflow: 'hidden' }}>
              <button onClick={() => setOpenDay(isOpen ? null : group.label)}
                style={{ width: '100%', padding: '13px 14px', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                <div style={{ flex: 1, textAlign: 'left' }}>
                  <span style={{ display: 'block', fontSize: 13, fontWeight: 600, color: p.text }}>{group.label}</span>
                  <span style={{ display: 'block', fontSize: 11, color: p.sub }}>{group.sessions.length} feed{group.sessions.length !== 1 ? 's' : ''} · {fmtMins(dayTotal)}</span>
                </div>
                <span style={{ color: p.sub, fontSize: 14, display: 'inline-block', transform: isOpen ? 'rotate(90deg)' : 'none', transition: 'transform .2s' }}>›</span>
              </button>

              {isOpen && (
                <div style={{ borderTop: `1px solid ${p.border}` }}>
                  {group.sessions.map((s, i) => (
                    <div key={s.id}
                      style={{ display: 'flex', alignItems: 'center', padding: '10px 14px', borderBottom: i < group.sessions.length - 1 ? `1px solid ${p.border}` : 'none', cursor: 'pointer' }}
                      onClick={() => setEditSession(s)}>
                      <span style={{ fontSize: 11, color: p.sub, width: 42, flexShrink: 0 }}>{timeStr(s.startedAt)}</span>
                      <div style={{ width: 26, height: 26, borderRadius: '50%', background: p.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 10px', flexShrink: 0 }}>
                        <span style={{ fontSize: 10, fontWeight: 600, color: brand.sand }}>{s.side}</span>
                      </div>
                      <div style={{ flex: 1 }}>
                        <span style={{ display: 'block', fontSize: 12, color: p.text }}>{s.side === 'L' ? 'Left' : 'Right'} breast</span>
                        {s.mood && (
                          <span style={{ display: 'block', fontSize: 10, color: p.sub, marginTop: 1 }}>
                            {MOOD_EMOJI[s.mood - 1]} {MOOD_LABEL[s.mood - 1]}
                          </span>
                        )}
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <span style={{ display: 'block', fontSize: 11, color: p.sub }}>{fmt(s.durationSecs || 0)}</span>
                        <span style={{ fontSize: 10, color: p.sub, opacity: 0.5 }}>edit</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })
      )}

      <div style={{ height: 20 }} />

      {/* Edit modal */}
      {editSession && (
        <EditModal
          session={editSession}
          night={night}
          onSave={handleSaveEdit}
          onClose={() => setEditSession(null)}
        />
      )}
    </div>
  )
}
