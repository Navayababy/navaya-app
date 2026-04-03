import { useState, useMemo } from 'react'
import { brand, palette } from '../theme.js'
import { getSessions } from '../lib/storage.js'

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
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)

  if (d.toDateString() === today.toDateString())     return 'Today'
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday'
  return d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' })
}

function timeStr(isoString) {
  return new Date(isoString).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

export default function HistoryScreen({ night }) {
  const p        = palette(night)
  const sessions = getSessions()
  const [openDay, setOpenDay] = useState(null)

  // Group sessions by day
  const grouped = useMemo(() => {
    const map = {}
    sessions.forEach(s => {
      const key = new Date(s.startedAt).toDateString()
      if (!map[key]) map[key] = { label: dayLabel(s.startedAt), sessions: [] }
      map[key].sessions.push(s)
    })
    return Object.values(map)
  }, [sessions])

  // Week stats
  const weekSessions = useMemo(() => {
    const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000
    return sessions.filter(s => new Date(s.startedAt).getTime() > cutoff)
  }, [sessions])

  const totalSecs  = weekSessions.reduce((a, s) => a + s.durationSecs, 0)
  const avgPerDay  = weekSessions.length > 0 ? Math.round(totalSecs / 7) : 0
  const leftCount  = weekSessions.filter(s => s.side === 'L').length
  const rightCount = weekSessions.filter(s => s.side === 'R').length
  const mostUsed   = leftCount >= rightCount ? 'L' : 'R'

  return (
    <div style={{ flex: 1, overflowY: 'auto', background: p.bg }}>

      {/* Header */}
      <div style={{ padding: '20px 16px 12px' }}>
        <span style={{ display: 'block', fontFamily: "'Cormorant Garamond', serif", fontSize: 12, color: brand.sand, letterSpacing: '.12em', textTransform: 'uppercase' }}>Your journey</span>
        <span style={{ display: 'block', fontFamily: "'Cormorant Garamond', serif", fontSize: 26, fontWeight: 400, color: night ? brand.parchment : brand.bark, marginTop: 2 }}>History</span>
      </div>

      {/* Stats row */}
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
          const dayTotal = group.sessions.reduce((a, s) => a + s.durationSecs, 0)
          const isOpen   = openDay === group.label

          return (
            <div key={group.label} style={{ margin: '0 14px 10px', background: p.card, borderRadius: 16, border: `1px solid ${p.border}`, overflow: 'hidden' }}>

              {/* Day header — tap to expand */}
              <button onClick={() => setOpenDay(isOpen ? null : group.label)}
                style={{ width: '100%', padding: '13px 14px', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                <div style={{ flex: 1, textAlign: 'left' }}>
                  <span style={{ display: 'block', fontSize: 13, fontWeight: 600, color: p.text }}>{group.label}</span>
                  <span style={{ display: 'block', fontSize: 11, color: p.sub }}>{group.sessions.length} feed{group.sessions.length !== 1 ? 's' : ''} · {fmtMins(dayTotal)}</span>
                </div>
                <span style={{ color: p.sub, fontSize: 14, display: 'inline-block', transform: isOpen ? 'rotate(90deg)' : 'none', transition: 'transform .2s' }}>›</span>
              </button>

              {/* Session list */}
              {isOpen && (
                <div style={{ borderTop: `1px solid ${p.border}` }}>
                  {group.sessions.map((s, i) => (
                    <div key={s.id} style={{ display: 'flex', alignItems: 'center', padding: '10px 14px', borderBottom: i < group.sessions.length - 1 ? `1px solid ${p.border}` : 'none' }}>
                      <span style={{ fontSize: 11, color: p.sub, width: 42, flexShrink: 0 }}>{timeStr(s.startedAt)}</span>
                      <div style={{ width: 26, height: 26, borderRadius: '50%', background: p.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 10px', flexShrink: 0 }}>
                        <span style={{ fontSize: 10, fontWeight: 600, color: brand.sand }}>{s.side}</span>
                      </div>
                      <span style={{ flex: 1, fontSize: 12, color: p.text }}>{s.side === 'L' ? 'Left' : 'Right'} breast</span>
                      <span style={{ fontSize: 11, color: p.sub }}>{fmt(s.durationSecs)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })
      )}

      <div style={{ height: 20 }} />
    </div>
  )
}
