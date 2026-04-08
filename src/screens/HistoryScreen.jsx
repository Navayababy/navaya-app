import { useState, useMemo } from 'react'
import { brand, palette } from '../theme.js'
import { getSessions, updateSession, deleteSession, addSession } from '../lib/storage.js'

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

function dateStr(isoString) {
  const d = new Date(isoString)
  const y = d.getFullYear()
  const mo = String(d.getMonth() + 1).padStart(2, '0')
  const dy = String(d.getDate()).padStart(2, '0')
  return `${y}-${mo}-${dy}`
}

function todayDateStr() {
  return dateStr(new Date().toISOString())
}

// Build ISO string from separate date (YYYY-MM-DD) and time (HH:MM) inputs
function buildISO(dateVal, timeVal) {
  const [y, mo, d] = dateVal.split('-').map(Number)
  const [h, m] = timeVal.split(':').map(Number)
  return new Date(y, mo - 1, d, h, m, 0, 0).toISOString()
}

// ── Edit modal ────────────────────────────────────────────────────────────────
function EditModal({ session, night, onSave, onDelete, onClose }) {
  const p = palette(night)
  const [startDate, setStartDate] = useState(dateStr(session.startedAt))
  const [startTime, setStartTime] = useState(timeStr(session.startedAt))
  const [endDate,   setEndDate]   = useState(session.endedAt ? dateStr(session.endedAt) : dateStr(session.startedAt))
  const [endTime,   setEndTime]   = useState(session.endedAt ? timeStr(session.endedAt) : '')
  const [side,      setSide]      = useState(session.side)
  const [confirmDel, setConfirmDel] = useState(false)

  const handleSave = () => {
    const newStartedAt = buildISO(startDate, startTime)
    const newEndedAt   = endTime ? buildISO(endDate, endTime) : session.endedAt
    onSave(session.id, { side, startedAt: newStartedAt, endedAt: newEndedAt })
  }

  const inputStyle = {
    width: '100%', background: p.bg, border: `1px solid ${p.border}`,
    borderRadius: 11, padding: '11px 13px', fontSize: 16, color: p.text,
    fontFamily: "'DM Sans', sans-serif", outline: 'none', boxSizing: 'border-box',
  }

  const labelStyle = {
    display: 'block', fontSize: 11, color: p.sub,
    letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 8,
  }

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      zIndex: 100, padding: '0 0 env(safe-area-inset-bottom, 0)',
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        width: '100%', maxWidth: 430,
        background: p.card, borderRadius: '20px 20px 0 0',
        padding: '20px 20px 28px',
        border: `1px solid ${p.border}`,
        maxHeight: '85vh', overflowY: 'auto',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <span style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 20, color: night ? brand.parchment : brand.bark }}>Edit feed</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: p.sub }}>×</button>
        </div>

        {/* Side */}
        <span style={labelStyle}>Side</span>
        <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
          {['L', 'R'].map(s => (
            <button key={s} onClick={() => setSide(s)}
              style={{ flex: 1, padding: '12px', borderRadius: 11, border: `1.5px solid ${side === s ? brand.sand : p.border}`, background: side === s ? brand.bark : 'transparent', cursor: 'pointer', color: side === s ? brand.sand : p.sub, fontSize: 13, fontWeight: 500 }}>
              {s === 'L' ? 'Left' : 'Right'}
            </button>
          ))}
        </div>

        {/* Start date + time */}
        <span style={labelStyle}>Start</span>
        <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
          <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
            style={{ ...inputStyle, flex: 1.4 }} />
          <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)}
            style={{ ...inputStyle, flex: 1 }} />
        </div>

        {/* End date + time */}
        <span style={labelStyle}>End</span>
        <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
          <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
            style={{ ...inputStyle, flex: 1.4 }} />
          <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)}
            style={{ ...inputStyle, flex: 1 }} />
        </div>

        <button onClick={handleSave}
          style={{ width: '100%', padding: '14px', borderRadius: 13, border: 'none', background: brand.bark, color: brand.sand, cursor: 'pointer', fontSize: 14, fontWeight: 500, marginBottom: 10 }}>
          Save changes
        </button>

        {/* Delete */}
        {confirmDel ? (
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setConfirmDel(false)}
              style={{ flex: 1, padding: '12px', borderRadius: 13, border: `1px solid ${p.border}`, background: 'transparent', cursor: 'pointer', fontSize: 13, color: p.sub }}>
              Cancel
            </button>
            <button onClick={() => onDelete(session.id)}
              style={{ flex: 1, padding: '12px', borderRadius: 13, border: 'none', background: '#c0392b', cursor: 'pointer', fontSize: 13, color: '#fff', fontWeight: 500 }}>
              Confirm delete
            </button>
          </div>
        ) : (
          <button onClick={() => setConfirmDel(true)}
            style={{ width: '100%', padding: '12px', borderRadius: 13, border: `1px solid ${p.border}`, background: 'transparent', cursor: 'pointer', fontSize: 13, color: '#c0392b' }}>
            Delete this feed
          </button>
        )}
      </div>
    </div>
  )
}

// ── Add Feed modal ─────────────────────────────────────────────────────────────
function AddFeedModal({ night, onSave, onClose }) {
  const p = palette(night)
  const now = new Date()
  const defaultEnd = timeStr(now.toISOString())
  const defaultStart = (() => {
    const d = new Date(now.getTime() - 20 * 60 * 1000)
    return timeStr(d.toISOString())
  })()

  const [date,      setDate]      = useState(todayDateStr())
  const [startTime, setStartTime] = useState(defaultStart)
  const [endTime,   setEndTime]   = useState(defaultEnd)
  const [side,      setSide]      = useState('L')

  const handleSave = () => {
    const startedAt = buildISO(date, startTime)
    const endedAt   = buildISO(date, endTime)
    const durationSecs = Math.max(0, Math.round((new Date(endedAt) - new Date(startedAt)) / 1000))
    const session = {
      id: Date.now().toString(),
      side,
      startedAt,
      endedAt,
      durationSecs,
      mood: null,
    }
    onSave(session)
  }

  const inputStyle = {
    width: '100%', background: p.bg, border: `1px solid ${p.border}`,
    borderRadius: 11, padding: '11px 13px', fontSize: 16, color: p.text,
    fontFamily: "'DM Sans', sans-serif", outline: 'none', boxSizing: 'border-box',
  }

  const labelStyle = {
    display: 'block', fontSize: 11, color: p.sub,
    letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 8,
  }

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      zIndex: 100, padding: '0 0 env(safe-area-inset-bottom, 0)',
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        width: '100%', maxWidth: 430,
        background: p.card, borderRadius: '20px 20px 0 0',
        padding: '20px 20px 28px',
        border: `1px solid ${p.border}`,
        maxHeight: '85vh', overflowY: 'auto',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <span style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 20, color: night ? brand.parchment : brand.bark }}>Add feed</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: p.sub }}>×</button>
        </div>

        {/* Side */}
        <span style={labelStyle}>Side</span>
        <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
          {['L', 'R'].map(s => (
            <button key={s} onClick={() => setSide(s)}
              style={{ flex: 1, padding: '12px', borderRadius: 11, border: `1.5px solid ${side === s ? brand.sand : p.border}`, background: side === s ? brand.bark : 'transparent', cursor: 'pointer', color: side === s ? brand.sand : p.sub, fontSize: 13, fontWeight: 500 }}>
              {s === 'L' ? 'Left' : 'Right'}
            </button>
          ))}
        </div>

        {/* Date */}
        <span style={labelStyle}>Date</span>
        <input type="date" value={date} onChange={e => setDate(e.target.value)}
          style={{ ...inputStyle, marginBottom: 14 }} />

        {/* Start time */}
        <span style={labelStyle}>Start time</span>
        <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)}
          style={{ ...inputStyle, marginBottom: 14 }} />

        {/* End time */}
        <span style={labelStyle}>End time</span>
        <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)}
          style={{ ...inputStyle, marginBottom: 20 }} />

        <button onClick={handleSave}
          style={{ width: '100%', padding: '14px', borderRadius: 13, border: 'none', background: brand.bark, color: brand.sand, cursor: 'pointer', fontSize: 14, fontWeight: 500 }}>
          Add feed
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
  const [showAdd,     setShowAdd]     = useState(false)

  const grouped = useMemo(() => {
    const map = {}
    sessions.forEach(s => {
      const key = new Date(s.startedAt).toDateString()
      if (!map[key]) map[key] = { label: dayLabel(s.startedAt), sessions: [] }
      map[key].sessions.push(s)
    })
    return Object.values(map)
  }, [sessions])

  // Monday–Sunday week (resets every Monday at 00:00)
  const weekSessions = useMemo(() => {
    const now = new Date()
    const daysFromMonday = (now.getDay() + 6) % 7  // Mon=0 … Sun=6
    const monday = new Date(now)
    monday.setHours(0, 0, 0, 0)
    monday.setDate(now.getDate() - daysFromMonday)
    return sessions.filter(s => new Date(s.startedAt) >= monday)
  }, [sessions])

  const totalSecs  = weekSessions.reduce((a, s) => a + (s.durationSecs || 0), 0)
  const daysElapsed = (() => {
    const now = new Date()
    const daysFromMonday = (now.getDay() + 6) % 7
    return daysFromMonday + 1  // at least 1
  })()
  const avgPerDay  = weekSessions.length > 0 ? Math.round(totalSecs / daysElapsed) : 0
  const leftCount  = weekSessions.filter(s => s.side === 'L').length
  const rightCount = weekSessions.filter(s => s.side === 'R').length
  const mostUsed   = leftCount >= rightCount ? 'L' : 'R'

  const handleSaveEdit = (id, changes) => {
    const updated = updateSession(id, changes)
    setSessions(updated)
    setEditSession(null)
  }

  const handleDelete = (id) => {
    const updated = deleteSession(id)
    setSessions(updated)
    setEditSession(null)
  }

  const handleAddFeed = (session) => {
    const updated = addSession(session)
    setSessions(updated)
    setShowAdd(false)
  }

  return (
    <div style={{ flex: 1, overflowY: 'auto', background: p.bg }}>

      <div style={{ padding: '20px 16px 12px', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <div>
          <span style={{ display: 'block', fontFamily: "'Cormorant Garamond', serif", fontSize: 12, color: brand.sand, letterSpacing: '.12em', textTransform: 'uppercase' }}>Your journey</span>
          <span style={{ display: 'block', fontFamily: "'Cormorant Garamond', serif", fontSize: 26, fontWeight: 400, color: night ? brand.parchment : brand.bark, marginTop: 2 }}>History</span>
        </div>
        <button onClick={() => setShowAdd(true)}
          style={{ width: 36, height: 36, borderRadius: '50%', background: brand.bark, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 4 }}>
          <span style={{ color: brand.sand, fontSize: 22, lineHeight: 1, marginTop: -1 }}>+</span>
        </button>
      </div>

      {/* Stats */}
      <div style={{ display: 'flex', gap: 8, padding: '0 14px 14px' }}>
        {[
          [weekSessions.length.toString(), 'feeds this week'],
          [fmtMins(avgPerDay),              'avg per day'],
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
          onDelete={handleDelete}
          onClose={() => setEditSession(null)}
        />
      )}

      {/* Add feed modal */}
      {showAdd && (
        <AddFeedModal
          night={night}
          onSave={handleAddFeed}
          onClose={() => setShowAdd(false)}
        />
      )}
    </div>
  )
}
