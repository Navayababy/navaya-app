import { useState, useRef } from 'react'
import { brand, palette } from '../theme.js'
import { getSessions, addSession, getUserName, setUserName } from '../lib/storage.js'

const QUOTES = [
  // — Verified breast milk facts —
  "When your baby is unwell, their saliva signals your breast to produce milk with higher concentrations of the exact antibodies needed. Your body responds in real time.",
  "Breast milk changes during a single feed — thinner at the start to quench thirst, richer in fat towards the end to satisfy hunger. Your body already knows what your baby needs.",
  "Your milk contains over 700 distinct bacterial species that seed your baby's gut microbiome for life. No formula has ever come close to replicating it.",
  "Breast milk contains melatonin at night and almost none during the day — quietly teaching your baby the rhythm of light and dark.",
  "The fat content of your milk is measurably higher in the evening than in the morning, giving your baby a richer, more satisfying feed before sleep.",
  "Human milk oligosaccharides — the third most abundant component in breast milk — exist solely to feed your baby's gut bacteria. The design is that deliberate.",
  "Breast milk contains stem cells. Research from the University of Western Australia found they can differentiate into heart, brain, and bone tissue.",
  "Studies show breastfed babies have a 73% lower risk of SIDS. Every feed is protection. (Vennemann et al., 2009)",
  "Oxytocin released during every feed is actively helping your uterus contract back to its pre-pregnancy size. You are healing and nurturing at the same time.",
  "At peak production, your body makes up to a litre of milk a day — burning roughly 500 extra calories. That is a full-time metabolic job.",
  "Your colostrum contained more immunoglobulin A per millilitre than any milk you will ever produce. The timing was not a coincidence.",
  "Premature babies receive breast milk with a different composition — higher in protein and immune factors — because your body already knew they needed more.",
  "A single breastfeed can transfer hundreds of billions of living cells to your baby. It is the only food on earth that is biologically alive.",
  // — For the hard moments —
  "At 2am, in the dark, half-asleep — this is what devotion looks like. You are doing it.",
  "There is no feed too short, no latch too imperfect. It all counts.",
  "Your baby doesn't know the time. They only know you came.",
  "Even the feeds you nearly gave up on — you didn't. That matters more than you know.",
  "No one else on earth can give your baby exactly what you just did.",
  "The nights are long. But you will look back on these quiet hours with more love than you expect.",
  "Every feed is a conversation your body is having with your baby. One no one else can have for you.",
  "You are not just feeding your baby. You are building their immune system, their gut, and their brain. Feed by feed.",
  "Some days it flows. Some days it's a fight. Both versions of you are doing enough.",
  "The research is clear: what you are doing has effects that last decades. You just can't see them yet.",
]

function fmt(secs) {
  const m = Math.floor(secs / 60)
  const s = secs % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function timeAgo(isoString) {
  if (!isoString) return ''
  const diff = Math.floor((Date.now() - new Date(isoString).getTime()) / 1000)
  if (diff < 60)   return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  return `${Math.floor(diff / 3600)}h ${Math.floor((diff % 3600) / 60)}m ago`
}

function greeting() {
  const h = new Date().getHours()
  if (h < 12) return 'morning'
  if (h < 18) return 'afternoon'
  return 'evening'
}

export default function HomeScreen({ night, onNightToggle, timer }) {
  const p = palette(night)
  const { feedActive, feedSide, elapsed, startFeed, stopFeed } = timer

  const [sessions,     setSessions]     = useState(() => getSessions().slice(0, 3))
  const [showMood,     setShowMood]     = useState(false)
  const [pendingSession, setPending]    = useState(null)
  const [partnerFlash, setPartnerFlash] = useState(false)
  const [editingName,  setEditingName]  = useState(false)
  const [userName,     setUserNameState]= useState(() => getUserName() || '')
  const [nameInput,    setNameInput]    = useState('')
  const [quote] = useState(() => QUOTES[Math.floor(Math.random() * QUOTES.length)])
  const nameInputRef = useRef(null)

  const lastSession = getSessions()[0]
  const lastSide    = lastSession?.side || 'R'
  const suggested   = lastSide === 'L' ? 'R' : 'L'

  const timeSinceLast = lastSession?.endedAt && !feedActive
    ? Math.floor((Date.now() - new Date(lastSession.endedAt).getTime()) / 60000)
    : null

  const handleStop = () => {
    const sessionData = stopFeed()
    setPending(sessionData)
    setShowMood(true)
    setTimeout(() => { setPartnerFlash(true) }, 400)
    setTimeout(() => { setPartnerFlash(false) }, 3500)
  }

  const saveMood = (mood) => {
    if (!pendingSession) return
    const session = {
      id:           Date.now().toString(),
      ...pendingSession,
      mood,
    }
    const updated = addSession(session)
    setSessions(updated.slice(0, 3))
    setPending(null)
    setShowMood(false)
  }

  const skipMood = () => {
    if (!pendingSession) return
    const session = { id: Date.now().toString(), ...pendingSession, mood: null }
    const updated = addSession(session)
    setSessions(updated.slice(0, 3))
    setPending(null)
    setShowMood(false)
  }

  const saveName = () => {
    const trimmed = nameInput.trim()
    if (trimmed) {
      setUserName(trimmed)
      setUserNameState(trimmed)
    }
    setEditingName(false)
  }

  const openNameEdit = () => {
    setNameInput(userName)
    setEditingName(true)
    setTimeout(() => nameInputRef.current?.focus(), 80)
  }

  const displayName = userName || 'there'

  return (
    <div style={{ flex: 1, overflowY: 'auto', background: p.bg }}>

      {/* ── Header ── */}
      <div style={{ padding: '20px 16px 4px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <span style={{ display: 'block', fontFamily: "'Cormorant Garamond', serif", fontSize: 12, color: brand.sand, letterSpacing: '.12em', textTransform: 'uppercase' }}>
            Good {greeting()}
          </span>

          {/* Editable name */}
          {editingName ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
              <input
                ref={nameInputRef}
                value={nameInput}
                onChange={e => setNameInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') saveName() }}
                placeholder="Your name"
                style={{
                  fontFamily:   "'Cormorant Garamond', serif",
                  fontSize:     24,
                  fontWeight:   400,
                  color:        night ? brand.parchment : brand.bark,
                  background:   'transparent',
                  border:       'none',
                  borderBottom: `1.5px solid ${brand.sand}`,
                  outline:      'none',
                  width:        140,
                  lineHeight:   1.2,
                  padding:      '0 0 2px',
                }}
              />
              <button onClick={saveName}
                style={{ background: brand.bark, border: 'none', borderRadius: 8, padding: '4px 10px', cursor: 'pointer', color: brand.sand, fontSize: 11, fontWeight: 500 }}>
                Save
              </button>
            </div>
          ) : (
            <button onClick={openNameEdit}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 26, fontWeight: 400, color: night ? brand.parchment : brand.bark, lineHeight: 1.1 }}>
                {displayName}
              </span>
              <span style={{ fontSize: 11, color: p.sub, marginTop: 4 }}>✎</span>
            </button>
          )}
        </div>

        <button onClick={onNightToggle}
          style={{ background: 'none', border: `1px solid ${p.border}`, borderRadius: 20, padding: '5px 12px', cursor: 'pointer', color: p.sub, fontSize: 11, marginTop: 4 }}>
          {night ? '☀' : '☽'}
        </button>
      </div>

      {/* ── Motivational quote ── */}
      <div style={{ padding: '10px 16px 0' }}>
        <p style={{ fontSize: 12, color: p.sub, fontStyle: 'italic', lineHeight: 1.55, fontFamily: "'Cormorant Garamond', serif", fontSize: 15 }}>
          "{quote}"
        </p>
      </div>

      {/* ── Timer card ── */}
      <div style={{ margin: '14px 14px 0', background: p.card, borderRadius: 18, border: `1px solid ${p.border}` }}>

        <div style={{ padding: '12px 16px 0', display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: feedActive ? brand.accent : brand.sand, flexShrink: 0 }} />
          <span style={{ fontSize: 11, color: p.sub, letterSpacing: '.04em' }}>
            {feedActive
              ? `Feeding · ${feedSide === 'L' ? 'Left' : 'Right'} side`
              : `Next: ${suggested === 'L' ? 'Left' : 'Right'} side`}
          </span>
          {!feedActive && timeSinceLast !== null && (
            <span style={{ marginLeft: 'auto', fontSize: 11, color: p.sub }}>{timeSinceLast}m ago</span>
          )}
        </div>

        <div style={{ textAlign: 'center', padding: '18px 0 14px' }}>
          {feedActive ? (
            <>
              <span style={{ display: 'block', fontFamily: "'Cormorant Garamond', serif", fontSize: 68, fontWeight: 300, color: night ? brand.parchment : brand.bark, lineHeight: 1, letterSpacing: '-2px' }}>
                {fmt(elapsed)}
              </span>
              <span style={{ display: 'block', fontSize: 10, color: brand.sand, marginTop: 4, letterSpacing: '.08em', textTransform: 'uppercase' }}>
                in progress
              </span>
            </>
          ) : (
            <span style={{ display: 'block', fontFamily: "'Cormorant Garamond', serif", fontSize: 34, fontWeight: 300, color: p.sub, lineHeight: 1 }}>
              {timeSinceLast !== null ? `${timeSinceLast}m since last feed` : 'Ready to start'}
            </span>
          )}
        </div>

        {!feedActive ? (
          <div style={{ display: 'flex', gap: 8, padding: '0 14px 14px' }}>
            {['L', 'R'].map(side => {
              const isNext = side === suggested
              return (
                <button key={side} onClick={() => startFeed(side)}
                  style={{ flex: 1, padding: '16px 0', borderRadius: 13, border: 'none', cursor: 'pointer', background: isNext ? brand.bark : p.bg, transition: 'all .2s' }}>
                  <span style={{ display: 'block', fontSize: 10, fontWeight: 500, letterSpacing: '.06em', textTransform: 'uppercase', color: isNext ? brand.sand : p.sub }}>
                    {side === 'L' ? 'Left' : 'Right'}
                  </span>
                  {isNext && <span style={{ display: 'block', fontSize: 9, color: brand.sand, marginTop: 2 }}>suggested</span>}
                </button>
              )
            })}
          </div>
        ) : (
          <div style={{ padding: '0 14px 14px' }}>
            <button onClick={handleStop}
              style={{ width: '100%', padding: '15px', borderRadius: 13, border: `1.5px solid ${brand.bark}`, cursor: 'pointer', background: 'transparent', color: brand.bark, fontSize: 13, fontWeight: 500 }}>
              Finish feed
            </button>
          </div>
        )}
      </div>

      {/* ── Partner flash ── */}
      {partnerFlash && (
        <div className="fade-up" style={{ margin: '10px 14px 0', background: brand.green, borderRadius: 12, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ color: '#fff', fontSize: 13 }}>✓</span>
          <span style={{ fontSize: 12, color: '#fff', fontWeight: 500 }}>Parm can see this feed</span>
        </div>
      )}

      {/* ── Mood check-in ── */}
      {showMood && (
        <div className="fade-up" style={{ margin: '10px 14px 0', background: p.card, borderRadius: 14, border: `1px solid ${p.border}`, padding: '14px' }}>
          <span style={{ display: 'block', fontSize: 13, color: p.text, fontWeight: 500, marginBottom: 4 }}>How did that feed go?</span>
          <span style={{ display: 'block', fontSize: 11, color: p.sub, marginBottom: 12 }}>This gets saved to your history.</span>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            {[
              { emoji: '😔', label: 'Tough' },
              { emoji: '😐', label: 'Okay'  },
              { emoji: '🙂', label: 'Good'  },
              { emoji: '😊', label: 'Great' },
              { emoji: '🤩', label: 'Amazing'},
            ].map((m, i) => (
              <button key={i} onClick={() => saveMood(i + 1)}
                style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, background: 'none', border: 'none', cursor: 'pointer', padding: '4px 6px' }}>
                <span style={{ fontSize: 26 }}>{m.emoji}</span>
                <span style={{ fontSize: 9, color: p.sub }}>{m.label}</span>
              </button>
            ))}
          </div>
          <button onClick={skipMood}
            style={{ fontSize: 11, color: p.sub, background: 'none', border: 'none', cursor: 'pointer', marginTop: 10, letterSpacing: '.04em' }}>
            skip
          </button>
        </div>
      )}

      {/* ── Recent sessions ── */}
      <div style={{ padding: '14px 14px 0' }}>
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
              <div style={{ textAlign: 'right' }}>
                <span style={{ display: 'block', fontSize: 12, color: p.sub }}>{fmt(s.durationSecs)}</span>
                {s.mood && <span style={{ fontSize: 14 }}>{['😔','😐','🙂','😊','🤩'][s.mood - 1]}</span>}
              </div>
            </div>
          ))
        )}
      </div>

      {/* ── Instagram link ── */}
      <div style={{ padding: '20px 14px 28px', textAlign: 'center' }}>
        <a
          href="https://www.instagram.com/navaya.life"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            fontSize: 11,
            color: p.sub,
            textDecoration: 'none',
            letterSpacing: '.06em',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
            opacity: 0.7,
          }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/>
            <circle cx="12" cy="12" r="4"/>
            <circle cx="17.5" cy="6.5" r="0.5" fill="currentColor"/>
          </svg>
          @navaya.life
        </a>
      </div>

    </div>
  )
}
