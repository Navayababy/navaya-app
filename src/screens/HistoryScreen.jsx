import { useState, useMemo } from 'react'
import { brand, palette } from '../theme.js'
import { getSessions, getNappies, getSleeps, updateSession, deleteSession, addSession, deleteNappy, deleteSleep } from '../lib/storage.js'

const MOOD_EMOJI = ['😔', '😐', '🙂', '😊', '🤩']
const MOOD_LABEL = ['Tough', 'Okay', 'Good', 'Great', 'Amazing']

const POO_HEX   = { mustard: '#D4A843', yellow: '#EDD050', green: '#6B9E5C', brown: '#8B6347', dark: '#2D1F14' }
const POO_LABEL = { mustard: 'Mustard', yellow: 'Yellow',  green: 'Green',   brown: 'Brown',   dark: 'Dark/Black' }

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

  const inputStyle = {
    width: '100%', background: p.bg, border: `1px solid ${p.border}`,
    borderRadius: 11, padding: '11px 13px', fontSize: 16, color: p.text,
    fontFamily: "'DM Sans', sans-serif", outline: 'none', boxSizing: 'border-box',
  }
  const labelStyle = { display: 'block', fontSize: 11, color: p.sub, letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 8 }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 100, padding: '0 0 env(safe-area-inset-bottom, 0)' }}>
      <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 430, background: p.card, borderRadius: '20px 20px 0 0', padding: '20px 20px 28px', border: `1px solid ${p.border}`, maxHeight: '85vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <span style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 20, color: night ? brand.parchment : brand.bark }}>Edit feed</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: p.sub }}>×</button>
        </div>

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
      </div>
    </div>
  )
}

// ── Add Feed modal ─────────────────────────────────────────────────────────────
function AddFeedModal({ night, onSave, onClose }) {
  const p = palette(night)
  const now = new Date()
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
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 100, padding: '0 0 env(safe-area-inset-bottom, 0)' }}>
      <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 430, background: p.card, borderRadius: '20px 20px 0 0', padding: '20px 20px 28px', border: `1px solid ${p.border}`, maxHeight: '85vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <span style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 20, color: night ? brand.parchment : brand.bark }}>Add feed</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: p.sub }}>×</button>
        </div>

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
      </div>
    </div>
  )
}

// ── Main screen ───────────────────────────────────────────────────────────────
export default function HistoryScreen({ night }) {
  const p = palette(night)

  const [sessions,    setSessions]    = useState(() => getSessions())
  const [nappies,     setNappies]     = useState(() => getNappies())
  const [sleeps,      setSleeps]      = useState(() => getSleeps())
  const [openDay,     setOpenDay]     = useState(null)
  const [editSession, setEditSession] = useState(null)
  const [showAdd,     setShowAdd]     = useState(false)
  const [confirmDel,  setConfirmDel]  = useState(null)   // { id, type }

  // ── Merge all entry types into one sorted timeline ────────────────────────
  const allEntries = useMemo(() => {
    const f = sessions.map(s => ({ ...s, _type: 'feed',  _time: s.startedAt }))
    const n = nappies.map(n  => ({ ...n, _type: 'nappy', _time: n.loggedAt  }))
    const sl = sleeps.map(s  => ({ ...s, _type: 'sleep', _time: s.startedAt }))
    return [...f, ...n, ...sl].sort((a, b) => new Date(b._time) - new Date(a._time))
  }, [sessions, nappies, sleeps])

  const grouped = useMemo(() => {
    const map = {}
    allEntries.forEach(entry => {
      const key = new Date(entry._time).toDateString()
      if (!map[key]) map[key] = { label: dayLabel(entry._time), entries: [] }
      map[key].entries.push(entry)
    })
    return Object.values(map)
  }, [allEntries])

  // ── Stats: feeds this week (Mon–Sun), nappies today, last nap ────────────
  const weekFeeds = useMemo(() => {
    const now = new Date()
    const monday = new Date(now)
    monday.setHours(0, 0, 0, 0)
    monday.setDate(now.getDate() - (now.getDay() + 6) % 7)
    return sessions.filter(s => new Date(s.startedAt) >= monday)
  }, [sessions])

  const nappyToday = useMemo(() => {
    const start = new Date(); start.setHours(0, 0, 0, 0)
    return nappies.filter(n => new Date(n.loggedAt) >= start).length
  }, [nappies])

  const lastSleep = useMemo(() =>
    [...sleeps].sort((a, b) => new Date(b.startedAt) - new Date(a.startedAt))[0] || null
  , [sleeps])

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handleSaveEdit = (id, changes) => {
    setSessions(updateSession(id, changes))
    setEditSession(null)
  }

  const handleDeleteFeed = (id) => {
    setSessions(deleteSession(id))
    setEditSession(null)
  }

  const handleAddFeed = (session) => {
    setSessions(addSession(session))
    setShowAdd(false)
  }

  const handleDelete = ({ id, type }) => {
    if (type === 'nappy') setNappies(deleteNappy(id))
    if (type === 'sleep') setSleeps(deleteSleep(id))
    setConfirmDel(null)
  }

  // ── Day summary line ──────────────────────────────────────────────────────
  function daySummary(entries) {
    const feeds   = entries.filter(e => e._type === 'feed').length
    const naps    = entries.filter(e => e._type === 'nappy').length
    const sls     = entries.filter(e => e._type === 'sleep').length
    const feedDur = entries.filter(e => e._type === 'feed').reduce((a, e) => a + (e.durationSecs || 0), 0)
    const parts   = []
    if (feeds > 0)  parts.push(`${feeds} feed${feeds !== 1 ? 's' : ''}`)
    if (naps > 0)   parts.push(`${naps} napp${naps !== 1 ? 'ies' : 'y'}`)
    if (sls > 0)    parts.push(`${sls} nap${sls !== 1 ? 's' : ''}`)
    if (feedDur > 0) parts.push(fmtMins(feedDur))
    return parts.join(' · ')
  }

  return (
    <div style={{ flex: 1, overflowY: 'auto', background: p.bg }}>

      <div style={{ padding: '20px 16px 12px', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <div>
          <span style={{ display: 'block', fontFamily: "'Cormorant Garamond', serif", fontSize: 12, color: brand.sand, letterSpacing: '.12em', textTransform: 'uppercase' }}>Your journey</span>
          <span style={{ display: 'block', fontFamily: "'Cormorant Garamond', serif", fontSize: 26, fontWeight: 400, color: night ? brand.parchment : brand.bark, marginTop: 2 }}>History</span>
        </div>
        <button onClick={() => setShowAdd(true)} style={{ width: 36, height: 36, borderRadius: '50%', background: brand.bark, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 4 }}>
          <span style={{ color: brand.sand, fontSize: 22, lineHeight: 1, marginTop: -1 }}>+</span>
        </button>
      </div>

      {/* Stats */}
      <div style={{ display: 'flex', gap: 8, padding: '0 14px 14px' }}>
        {[
          [weekFeeds.length.toString(),                              'feeds this week'],
          [nappyToday.toString(),                                    'nappies today'  ],
          [lastSleep ? fmtMins(lastSleep.durationSecs || 0) : '—',  'last nap'       ],
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
                    const isLast = i === group.entries.length - 1
                    const borderStyle = isLast ? 'none' : `1px solid ${p.border}`

                    // ── Feed row ────────────────────────────────────────────
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

                    // ── Nappy row ───────────────────────────────────────────
                    if (entry._type === 'nappy') {
                      const nappyEmoji = entry.type === 'wet' ? '💧' : entry.type === 'poo' ? '💩' : '💧💩'
                      const nappyLabel = entry.type === 'wet' ? 'Wee' : entry.type === 'poo' ? 'Poo' : 'Wee & Poo'
                      const isDel = confirmDel?.id === entry.id
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

                    // ── Sleep row ───────────────────────────────────────────
                    if (entry._type === 'sleep') {
                      const isDel = confirmDel?.id === entry.id
                      return (
                        <div key={entry.id} style={{ display: 'flex', alignItems: 'center', padding: '10px 14px', borderBottom: borderStyle }}>
                          <span style={{ fontSize: 11, color: p.sub, width: 42, flexShrink: 0 }}>{timeStr(entry.startedAt)}</span>
                          <div style={{ width: 26, height: 26, borderRadius: '50%', background: p.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 10px', flexShrink: 0, fontSize: 13 }}>
                            💤
                          </div>
                          <div style={{ flex: 1 }}>
                            <span style={{ display: 'block', fontSize: 12, color: p.text }}>Nap</span>
                            {entry.endedAt && <span style={{ display: 'block', fontSize: 10, color: p.sub, marginTop: 1 }}>{timeStr(entry.startedAt)} – {timeStr(entry.endedAt)}</span>}
                          </div>
                          <div style={{ textAlign: 'right', marginRight: isDel ? 8 : 0 }}>
                            <span style={{ display: 'block', fontSize: 11, color: p.sub }}>{fmt(entry.durationSecs || 0)}</span>
                          </div>
                          {isDel ? (
                            <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                              <button onClick={() => setConfirmDel(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: p.sub, padding: '2px 6px' }}>Cancel</button>
                              <button onClick={() => handleDelete({ id: entry.id, type: 'sleep' })} style={{ background: '#c0392b', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 11, color: '#fff', padding: '2px 8px', fontWeight: 500 }}>Delete</button>
                            </div>
                          ) : (
                            <button onClick={() => setConfirmDel({ id: entry.id, type: 'sleep' })} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 17, color: p.sub, padding: '0 2px', lineHeight: 1, flexShrink: 0 }}>×</button>
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
      )}

      <div style={{ height: 20 }} />

      {editSession && (
        <EditModal session={editSession} night={night} onSave={handleSaveEdit} onDelete={handleDeleteFeed} onClose={() => setEditSession(null)} />
      )}

      {showAdd && (
        <AddFeedModal night={night} onSave={handleAddFeed} onClose={() => setShowAdd(false)} />
      )}
    </div>
  )
}
