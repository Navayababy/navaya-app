import { useEffect, useState } from 'react'
import { brand } from '../theme.js'

export default function SplashScreen({ onDone }) {
  const [fading, setFading] = useState(false)

  useEffect(() => {
    const fadeTimer  = setTimeout(() => setFading(true),  1400)
    const doneTimer  = setTimeout(() => onDone(),         1900)
    return () => { clearTimeout(fadeTimer); clearTimeout(doneTimer) }
  }, [onDone])

  return (
    <div style={{
      position:       'fixed',
      inset:          0,
      display:        'flex',
      alignItems:     'center',
      justifyContent: 'center',
      background:     brand.cream,
      zIndex:         9999,
      opacity:        fading ? 0 : 1,
      transition:     'opacity 0.5s ease',
      pointerEvents:  'none',
    }}>
      <svg width="160" height="160" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
        <rect width="512" height="512" rx="114" fill={brand.sand} />
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
    </div>
  )
}
