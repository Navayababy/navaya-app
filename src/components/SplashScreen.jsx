import { useEffect, useState } from 'react'
import { brand } from '../theme.js'
import { getBabyName } from '../lib/storage.js'

// Warm, general-parenting quotes — about savouring the moment, not surviving
// it. Relatable whether the day was about feeds, nappies, sleep or none of
// the above. Shown once, briefly, while the app loads, so Home can stay
// uncluttered. Picked at random each time the app opens.
const QUOTES = [
  "Blink and this stage will be gone — so notice it, today, while it's still here.",
  "One day this will simply be a memory. Right now, it's still happening. Enjoy it.",
  "This is their childhood. Quietly, it's also one of the best chapters of yours.",
  "The ordinary days are the ones they'll remember as magic.",
  "They will only be this little once. You get to be here for all of it.",
  "Years from now, this is the story you'll tell — the early, tender, unrepeatable start.",
  "An ordinary day like today is quietly becoming one of their favourite memories.",
  "This little stretch of time is fleeting, and irreplaceable. Savour it.",
]

export default function SplashScreen({ onDone }) {
  const [fading, setFading]   = useState(false)
  const [revealed, setRevealed] = useState(false)
  const [quote]    = useState(() => QUOTES[Math.floor(Math.random() * QUOTES.length)])
  const [babyName] = useState(() => getBabyName())

  useEffect(() => {
    // Staggered reveal — logo blooms in first, the welcome and quote settle
    // in a beat later — then a real pause so it can actually be read before
    // the cross-fade into Home.
    const revealTimer = setTimeout(() => setRevealed(true), 500)
    const fadeTimer    = setTimeout(() => setFading(true),  4000)
    const doneTimer    = setTimeout(() => onDone(),         4500)
    return () => { clearTimeout(revealTimer); clearTimeout(fadeTimer); clearTimeout(doneTimer) }
  }, [onDone])

  return (
    <div style={{
      position:       'fixed',
      inset:          0,
      display:        'flex',
      flexDirection:  'column',
      alignItems:     'center',
      justifyContent: 'center',
      gap:            26,
      padding:        '0 36px',
      background:     brand.sand,
      zIndex:         9999,
      opacity:        fading ? 0 : 1,
      transition:     'opacity 0.5s ease',
      pointerEvents:  'none',
    }}>
      <svg className="splash-logo" width="200" height="200" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
        <rect width="512" height="512" fill={brand.sand} />
        <text
          x="256"
          y="256"
          textAnchor="middle"
          dominantBaseline="middle"
          fontFamily="'Avenir Next', 'Avenir', 'Century Gothic', 'Futura', sans-serif"
          fontWeight="500"
          fontSize="82"
          letterSpacing="18"
          fill={brand.bark}
        >NAVAYA</text>
      </svg>

      {revealed && (
        <div className="fade-up" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 22 }}>
          {/* A warm welcome-back line, addressed to the parent, kept clearly
              separate from the quote below so it never reads as if the
              quote itself were dedicated to the baby. */}
          {babyName && (
            <span style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 19, fontWeight: 400, color: brand.bark, opacity: 0.85, textAlign: 'center', lineHeight: 1.4 }}>
              Welcome back — here for you and {babyName}
            </span>
          )}
          <p style={{ fontFamily: "'Cormorant Garamond', serif", fontStyle: 'italic', fontSize: 17, color: brand.bark, opacity: 0.75, textAlign: 'center', lineHeight: 1.5, margin: 0 }}>
            "{quote}"
          </p>
        </div>
      )}
    </div>
  )
}
