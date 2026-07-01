import { useEffect, useRef, useState } from 'react'
import { brand } from '../theme.js'

// Warm, general-parenting quotes — about savouring the moment, not surviving
// it. Relatable whether the day was about feeds, nappies, sleep or none of
// the above. Shown once, briefly, while the app loads — just the quote, on
// its own; the brand mark and any greeting live elsewhere (the native launch
// splash, and Home's own "Good afternoon" / "Welcome back"). Picked at
// random each time the app opens.
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
  const [fading, setFading] = useState(false)
  const [quote]  = useState(() => QUOTES[Math.floor(Math.random() * QUOTES.length)])

  // App passes a fresh inline function on every one of its own re-renders
  // (auth/household data settling in, etc). Keeping onDone out of the effect
  // dependencies — via a ref that's always current — means the countdown
  // starts once on mount and can't be silently restarted by an unrelated
  // parent re-render, which was leaving the splash stuck on screen.
  const onDoneRef = useRef(onDone)
  onDoneRef.current = onDone

  useEffect(() => {
    // A real pause so the quote can actually be read before the cross-fade.
    const fadeTimer = setTimeout(() => setFading(true), 4000)
    const doneTimer = setTimeout(() => onDoneRef.current(), 4500)
    return () => { clearTimeout(fadeTimer); clearTimeout(doneTimer) }
  }, [])

  return (
    <div style={{
      position:       'fixed',
      inset:          0,
      display:        'flex',
      alignItems:     'center',
      justifyContent: 'center',
      padding:        '0 36px',
      background:     brand.bark,
      zIndex:         9999,
      opacity:        fading ? 0 : 1,
      transition:     'opacity 0.5s ease',
      pointerEvents:  'none',
    }}>
      {/* Sits in the top third via absolute positioning so it never shifts
          where the quote lands — that stays perfectly centred either way. */}
      <div style={{ position: 'absolute', top: '13%', left: 0, right: 0, display: 'flex', justifyContent: 'center' }}>
        <svg width="240" height="240" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
          <rect width="512" height="512" fill={brand.bark} />
          <text
            x="256"
            y="256"
            textAnchor="middle"
            dominantBaseline="middle"
            fontFamily="'Avenir Next', 'Avenir', 'Century Gothic', 'Futura', sans-serif"
            fontWeight="500"
            fontSize="82"
            letterSpacing="18"
            fill={brand.sand}
          >NAVAYA</text>
        </svg>
      </div>

      <p className="fade-up" style={{ fontFamily: "'Cormorant Garamond', serif", fontStyle: 'italic', fontSize: 26, color: brand.parchment, opacity: 0.85, textAlign: 'center', lineHeight: 1.5, margin: 0 }}>
        "{quote}"
      </p>
    </div>
  )
}
