import { useEffect, useRef, useState } from 'react'
import { brand } from '../theme.js'

// Uplifting, positive quotes about children and parenthood, each with its
// attribution. Shown once, briefly, while the app loads — the brand mark and
// any greeting live elsewhere (the native launch splash, and Home's own
// "Good afternoon" / "Welcome back"). Picked at random each time the app
// opens.
const QUOTES = [
  { text: 'Every child is an artist.', by: 'Pablo Picasso' },
  { text: 'Children learn more from what you are than what you teach.', by: 'W. E. B. Du Bois' },
  { text: 'The soul is healed by being with children.', by: 'Fyodor Dostoevsky' },
  { text: 'There are no seven wonders of the world in the eyes of a child. There are seven million.', by: 'Walt Streightiff' },
  { text: 'A baby fills a place in your heart you never knew was empty.', by: 'Anonymous' },
  { text: "Children are the world's most valuable resource.", by: 'Herbert Hoover' },
  { text: 'It is easier to build strong children than to repair broken men.', by: 'Frederick Douglass' },
  { text: 'Every child begins the world again.', by: 'Henry David Thoreau' },
  { text: 'Children see magic because they look for it.', by: 'Christopher Moore' },
  { text: 'A child can teach an adult three things: to be happy, to be curious, and to love without limits.', by: 'Anonymous' },
  { text: 'Children are not things to be moulded, but people to be unfolded.', by: 'Jess Lair' },
  { text: 'The best inheritance a parent can give is a little of their time each day.', by: 'Orlando Aloysius Battista' },
  { text: 'Too much love never spoils children.', by: 'Anthony Witham' },
  { text: 'Children are great imitators. So give them something great to imitate.', by: 'Anonymous' },
  { text: 'Play is the highest form of research.', by: 'Albert Einstein' },
  { text: "A person's a person, no matter how small.", by: 'Dr. Seuss' },
  { text: 'The way we talk to our children becomes their inner voice.', by: "Peggy O'Mara" },
  { text: 'Every baby is a fresh beginning.', by: 'Anonymous' },
  { text: 'Children make your life important.', by: 'Erma Bombeck' },
  { text: 'Sometimes the smallest things take up the most room in your heart.', by: 'A. A. Milne' },
]

export default function SplashScreen({ onDone }) {
  const [fading, setFading] = useState(false)
  const [quote]  = useState(() => QUOTES[Math.floor(Math.random() * QUOTES.length)])
  // Cormorant Garamond loads over the network; showing the quote before it's
  // ready renders it in a fallback serif first, then reflows to the real
  // font mid-splash — the "jolt" this screen exists to avoid. Wait for it
  // (capped, in case fonts.ready never settles) before revealing the text.
  const [fontsReady, setFontsReady] = useState(false)

  useEffect(() => {
    let cancelled = false
    const ready = document.fonts?.ready ?? Promise.resolve()
    const capped = Promise.race([ready, new Promise(r => setTimeout(r, 1500))])
    capped.then(() => { if (!cancelled) setFontsReady(true) })
    return () => { cancelled = true }
  }, [])

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

      {fontsReady && (
        <div className="fade-up" style={{ textAlign: 'center' }}>
          <p style={{ fontFamily: "'Cormorant Garamond', serif", fontStyle: 'italic', fontSize: 26, color: brand.parchment, opacity: 0.85, lineHeight: 1.5, margin: 0 }}>
            "{quote.text}"
          </p>
          {/* Attribution in the brand's small-caps sand lettering — a
              deliberate contrast with the italic serif above so the name
              reads as a signature, not a continuation of the quote. */}
          <span style={{ display: 'block', marginTop: 16, fontFamily: "'Jost', sans-serif", fontSize: 12.5, fontWeight: 500, color: brand.sand, letterSpacing: '.18em', textTransform: 'uppercase' }}>
            — {quote.by}
          </span>
        </div>
      )}
    </div>
  )
}
