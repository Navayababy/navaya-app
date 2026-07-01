import { useEffect, useState } from 'react'
import { brand } from '../theme.js'

// Broad, general-parenting quotes — relatable whether the day was about
// feeds, nappies, sleep or none of the above. Shown once, briefly, while
// the app loads, so Home itself can stay uncluttered.
const QUOTES = [
  "You don't have to have it figured out. You just have to keep showing up.",
  "Some days are survived, not conquered. Both count.",
  "The small, repeated things are the ones that raise a child.",
  "No one is doing this perfectly. You are doing it well enough, and that's enough.",
  "Every tired parent before you got through today. So will you.",
  "You are allowed to find this hard and still be doing a wonderful job.",
  "The days are long, but you won't remember most of the hard parts — only that you were there.",
]

export default function SplashScreen({ onDone }) {
  const [fading, setFading] = useState(false)
  const [quote] = useState(() => QUOTES[Math.floor(Math.random() * QUOTES.length)])

  useEffect(() => {
    const fadeTimer  = setTimeout(() => setFading(true),  1400)
    const doneTimer  = setTimeout(() => onDone(),         2000)
    return () => { clearTimeout(fadeTimer); clearTimeout(doneTimer) }
  }, [onDone])

  return (
    <div style={{
      position:       'fixed',
      inset:          0,
      display:        'flex',
      flexDirection:  'column',
      alignItems:     'center',
      justifyContent: 'center',
      gap:            22,
      padding:        '0 40px',
      background:     brand.sand,
      zIndex:         9999,
      opacity:        fading ? 0 : 1,
      transition:     'opacity 0.5s ease',
      pointerEvents:  'none',
    }}>
      <svg width="160" height="160" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
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
      <p style={{ fontFamily: "'Cormorant Garamond', serif", fontStyle: 'italic', fontSize: 16, color: brand.bark, opacity: 0.75, textAlign: 'center', lineHeight: 1.5, margin: 0 }}>
        "{quote}"
      </p>
    </div>
  )
}
