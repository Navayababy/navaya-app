import { useState, useEffect, useRef } from 'react'
import { brand, palette } from '../theme.js'
import { getSessions, addSession } from '../lib/storage.js'

// Format seconds as MM:SS
function fmt(secs) {
  const m = Math.floor(secs / 60)
  const s = secs % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

// How long ago was a timestamp (in plain English)
function timeAgo(isoString) {
  const diff = Math.floor((Date.now() - new Date(isoString).getTime()) / 1000)
  if (diff < 60)  return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  return `${Math.floor(diff / 3600)}h ${Math.floor((diff % 3600) / 60)}m ago`
}

export default function HomeScreen({ night, onNightToggle }) {
  const p       = palette(night)
  const allSess = getSessions()

  // Derive next suggested side from last session
  const lastSide   = allSess[0]?.side || 'R'
  const suggestedSide = lastSide === 'L' ? 'R' : 'L'

  const [feeding,     setFeeding]     = useState(false)
  const [activeSide,  setActiveSide]  = useState(suggestedSide)
  const [elapsed,     setElapsed]     = useState(0)
  const [sessions,    setSessions]    = useState(allSess.slice(0, 3))
  const [showMood,    setShowMood]    = useState(false)
  const [lastSession, setLastSession] = useState(null)
  const [partnerFlash,setPartnerFlash]= useState(false)

  const timerRef = useRef(null)
  const startRef = useRef(null)

  // Keep timer running
  useEffect(() => {
    if (feeding) {
      startRef.current = Date.now() - elapsed * 1000
      timerRef.current = setInterval(() => {
        setElapsed(Math.floor((Date.now() - startRef.current) / 1000))
      }, 500)
    } else {
      clearInterval(timerRef.current)
    }
    return () => clearInterval(timerRef.current)
  }, [feeding])

  const startFeed = (side) => {
    setActiveSide(side)
    setElapsed(0)
    setFeeding(true)
    setShowMood(false)
    setLastSession(null)
  }

  const stopFeed = () => {
    clearInterval(timerRef.current)
    const session = {
      id:           Date.now().toString(),
      side:         activeSide,
      startedAt:    new Date(Date.now() - elapsed * 1000).toISOString(),
      endedAt:      new Date().toISOString(),
      durationSecs: elapsed,
      mood:         null,
    }
    const updated = addSession(session)
    setSessions(updated.slice(0, 3))
    setLastSession(session)
    setFeeding(false)
    setElapsed(0)

    // Show partner flash briefly
    setTimeout(() => { setPartnerFlash(true) }, 500)
    setTimeout(() => { setPartnerFlash(false) }, 3500)

    // Show mood check-in
    setTimeout(() => { setShowMood(true) }, 300)
  }

  const recordMood = (score) => {
    setShowMood(false)
    // In a full version this would update the session record
  }

  const timeSinceLast = sessions[0]
    ? Math.floor((Date.now() - new Date(sessions[0].endedAt).getTime()) / 60000)
    : null

  return (
    <div style={{ flex: 1, overflowY: 'auto', background: p.bg }}>

      {/* Header */}
      <div style={{ padding: '20px 16px 4px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <span style={{ display: 'block', fontFamily: "'Cormorant Garamond', serif", fontSize: 12, color: brand.sand, letterSpacing: '.12em', textTransform: 'uppercase' }}>
            Good {greeting()}
          </span>
          <span style={{ display: 'block', fontFamily: "'Cormorant Garamond', serif", fontSize: 26, fontWeight: 400, color: night ? brand.parchment : brand.bark, lineHeight: 1.1, marginTop: 2 }}>
            Vin
          </span>
        </div>
        <button onClick={onNightToggle}
          style={{ background: 'none', border: `1px solid ${p.border}`, borderRadius: 20, padding: '5px 12px', cursor: 'pointer', color: p.sub, fontSize: 11 }}>
          {night ? '☀' : '☽'}
        </button>
      </div>

      {/* Timer card */}
      <div style={{ margin: '14px 14px 0', background: p.card, borderRadius: 18, border: `1px solid ${p.border}` }}>

        {/* Status row */}
        <div style={{ padding: '12px 16px 0', display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: feeding ? brand.accent : brand.sand, flexShrink: 0 }} />
          <span style={{ fontSize: 11, color: p.sub, letterSpacing: '.04em' }}>
            {feeding
              ? `Feeding · ${activeSide === 'L' ? 'Left' : 'Right'} side`
              : `Next: ${suggestedSide === 'L' ? 'Left' : 'Right'} side`}
          </span>
          {!feeding && timeSinceLast !== null && (
            <span style={{ marginLeft: 'auto', fontSize: 11, color: p.sub }}>{timeSinceLast}m ago</span>
          )}
        </div>

        {/* Timer display */}
        <div style={{ textAlign: 'center', padding: '18px 0 14px' }}>
          {feeding ? (
            <>
              <span style={{ display: 'block', fontFamily: "'Cormorant Garamond', serif", fontSize: 68, fontWeight: 300, color: night ? brand.parchment : brand.bark, lineHeight: 1, letterSpacing: '-2px' }}>
                {fmt(elapsed)}
              </span>
              <span style={{ display: 'block', fontSize: 10, color: brand.sand, marginTop: 4, letterSpacing: '.08em', textTransform: 'uppercase' }}>
                in progress
              </span>
            </>
          ) : (
            <span style={{ display: 'block', fontFamily: "'Cormorant Garamond', serif", fontSize: 36, fontWeight: 300, color: p.sub, lineHeight: 1 }}>
              {timeSinceLast !== null ? `${timeSinceLast}m since last feed` : 'Ready to start'}
            </span>
          )}
        </div>

        {/* Buttons */}
        {!feeding ? (
          <div style={{ display: 'flex', gap: 8, padding: '0 14px 14px' }}>
            {['L', 'R'].map(side => {
              const isNext = side === suggestedSide
              return (
                <button key={side} onClick={() => startFeed(side)}
                  style={{
                    flex:       1,
                    padding:    '16px 0',
                    borderRadius: 13,
                    border:     'none',
                    cursor:     'pointer',
                    background: isNext ? brand.bark : p.bg,
                    transition: 'all .2s',
                  }}>
                  <span style={{ display: 'block', fontSize: 10, fontWeight: 500, letterSpacing: '.06em', textTransform: 'uppercase', color: isNext ? brand.sand : p.sub }}>
                    {side === 'L' ? 'Left' : 'Right'}
                  </span>
                  {isNext && (
                    <span style={{ display: 'block', fontSize: 9, color: brand.sand, marginTop: 2 }}>suggested</span>
                  )}
                </button>
              )
            })}
          </div>
        ) : (
          <div style={{ padding: '0 14px 14px' }}>
            <button onClick={stopFeed}
              style={{ width: '100%', padding: '15px', borderRadius: 13, border: `1.5px solid ${brand.bark}`, cursor: 'pointer', background: 'transparent', color: brand.bark, fontSize: 13, fontWeight: 500 }}>
              Finish feed
            </button>
          </div>
        )}
      </div>

      {/* Partner flash */}
      {partnerFlash && (
        <div className="fade-up" style={{ margin: '10px 14px 0', background: brand.green, borderRadius: 12, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ color: '#fff', fontSize: 13 }}>✓</span>
          <span style={{ fontSize: 12, color: '#fff', fontWeight: 500 }}>Parm can see this feed</span>
        </div>
      )}

      {/* Mood check-in */}
      {showMood && (
        <div className="fade-up" style={{ margin: '10px 14px 0', background: p.card, borderRadius: 14, border: `1px solid ${p.border}`, padding: '14px' }}>
          <span style={{ display: 'block', fontSize: 13, color: p.text, fontWeight: 500, marginBottom: 12 }}>How did that feel?</span>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            {['😔', '😐', '🙂', '😊', '🤩'].map((emoji, i) => (
              <button key={i} onClick={() => recordMood(i + 1)}
                style={{ fontSize: 24, background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}>
                {emoji}
              </button>
            ))}
          </div>
          <button onClick={() => setShowMood(false)}
            style={{ fontSize: 11, color: p.sub, background: 'none', border: 'none', cursor: 'pointer', marginTop: 8, letterSpacing: '.04em' }}>
            skip
          </button>
        </div>
      )}

      {/* Recent sessions */}
      <div style={{ padding: '14px 14px 20px' }}>
        <span style={{ display: 'block', fontSize: 10, color: p.sub, letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 8 }}>Recent</span>
        {sessions.length === 0 ? (
          <span style={{ fontSize: 13, color: p.sub }}>No feeds logged yet. Tap Left or Right to begin.</span>
        ) : (
          sessions.map((s, i) => (
            <div key={s.id} style={{ display: 'flex', alignItems: 'center', padding: '10px 0', borderBottom: i < sessions.length - 1 ? `1px solid ${p.border}` : 'none' }}>
              <div style={{ width: 30, height: 30, borderRadius: '50%', background: p.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: 10, flexShrink: 0 }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: brand.sand }}>{s.side}</span>
              </div>
              <div style={{ flex: 1 }}>
                <span style={{ display: 'block', fontSize: 13, color: p.text, fontWeight: 500 }}>{s.side === 'L' ? 'Left' : 'Right'} side</span>
                <span style={{ display: 'block', fontSize: 11, color: p.sub }}>{timeAgo(s.endedAt)}</span>
              </div>
              <span style={{ fontSize: 12, color: p.sub }}>{fmt(s.durationSecs)}</span>
            </div>
          ))
        )}
      </div>

    </div>
  )
}

function greeting() {
  const h = new Date().getHours()
  if (h < 12) return 'morning'
  if (h < 18) return 'afternoon'
  return 'evening'
}
