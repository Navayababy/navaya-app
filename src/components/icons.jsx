// Shared line-icon set — one consistent thin-stroke drawing language (used
// to already exist only for the bottle and pill glyphs on Home/Feed) instead
// of relying on the OS's own emoji font for the rest. Emoji render
// differently per platform and visually clash with these hand-drawn glyphs
// sitting right next to them, so every *functional* icon in the app now
// comes from here. Mood-rating faces are left as real emoji — there the
// expressiveness is the point, not a stand-in for missing artwork.

export function BottleIcon({ color = 'currentColor', size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="9" y="2" width="6" height="3.5" rx="1" />
      <path d="M9.5 5.5 8.3 8.6A3 3 0 0 0 7 11v9a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2v-9a3 3 0 0 0-1.3-2.4L14.5 5.5" />
      <path d="M7.3 13.5h9.4" />
    </svg>
  )
}

export function PillIcon({ color = 'currentColor', size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="4" y="8.5" width="16" height="7" rx="3.5" transform="rotate(-45 12 12)" />
      <line x1="12" y1="8.5" x2="12" y2="15.5" transform="rotate(-45 12 12)" />
    </svg>
  )
}

// Wee — a simple teardrop, the universal "liquid" glyph without the
// emoji-font rendering that differs across Android/iOS/desktop.
export function DropletIcon({ color = 'currentColor', size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3.5c3.2 4 6 7.4 6 10.8a6 6 0 1 1-12 0c0-3.4 2.8-6.8 6-10.8Z" />
    </svg>
  )
}

// Poo — a soft three-lobe swirl rather than the literal emoji, drawn in the
// same thin-stroke language as everything else on this screen.
export function PooIcon({ color = 'currentColor', size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M8 20h8a3 3 0 0 0 0-6 3.2 3.2 0 0 0-1-5.4A3.4 3.4 0 0 0 12 5a3.4 3.4 0 0 0-3.4 4.2A3.2 3.2 0 0 0 7 14a3 3 0 0 0 1 6Z" />
      <path d="M9.5 9.7c.5-.5 1.2-.7 1.8-.4" />
    </svg>
  )
}

// A gentle crescent — used wherever sleep needs a drawn glyph rather than the
// ☾ text character (which stays for tab bars and small inline labels).
export function MoonIcon({ color = 'currentColor', size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5Z" />
    </svg>
  )
}

export function ClockIcon({ color = 'currentColor', size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </svg>
  )
}

export function PhoneIcon({ color = 'currentColor', size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="6" y="2.5" width="12" height="19" rx="2.5" />
      <path d="M10.5 18.5h3" />
    </svg>
  )
}

// A four-point sparkle — the same mark Sage's ✦ text glyph draws, used where
// an announcement card needs it as artwork rather than inline text.
export function SparkleIcon({ color = 'currentColor', size = 17 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color} stroke="none" aria-hidden="true">
      <path d="M12 2c.7 5.4 2.3 7.9 8 8.6-5.7.7-7.3 3.2-8 8.6-.7-5.4-2.3-7.9-8-8.6 5.7-.7 7.3-3.2 8-8.6Z" />
    </svg>
  )
}

export function LeafIcon({ color = 'currentColor', size = 17 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 19c-1-6 1.5-12 13-14 1 8-3 14-13 14Z" />
      <path d="M6 18c3-3.5 5.5-7 7.5-10.5" />
    </svg>
  )
}

export function GiftIcon({ color = 'currentColor', size = 17 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="4" y="9.5" width="16" height="10" rx="1.5" />
      <path d="M4 13h16M12 9.5V20" />
      <path d="M12 9.5C10.5 6 8 6 7.3 7.5 6.7 8.8 8 9.5 12 9.5Zm0 0C13.5 6 16 6 16.7 7.5 17.3 8.8 16 9.5 12 9.5Z" />
    </svg>
  )
}
