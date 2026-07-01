import { useEffect, useState } from 'react'
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

  useEffect(() => {
    // A real pause so the quote can actually be read before the cross-fade.
    const fadeTimer = setTimeout(() => setFading(true), 4000)
    const doneTimer = setTimeout(() => onDone(),        4500)
    return () => { clearTimeout(fadeTimer); clearTimeout(doneTimer) }
  }, [onDone])

  return (
    <div style={{
      position:       'fixed',
      inset:          0,
      display:        'flex',
      alignItems:     'center',
      justifyContent: 'center',
      padding:        '0 36px',
      background:     brand.sand,
      zIndex:         9999,
      opacity:        fading ? 0 : 1,
      transition:     'opacity 0.5s ease',
      pointerEvents:  'none',
    }}>
      <p className="fade-up" style={{ fontFamily: "'Cormorant Garamond', serif", fontStyle: 'italic', fontSize: 24, color: brand.bark, opacity: 0.85, textAlign: 'center', lineHeight: 1.5, margin: 0 }}>
        "{quote}"
      </p>
    </div>
  )
}
