import { useState, useEffect } from 'react'
import { brand, palette, shadow, iconWellBg } from '../theme.js'
import { getUserName, getChecked, getCustomItems, getHiddenDefaults, getLastOpenedAt, setLastOpenedAt, getHouseholdLinked } from '../lib/storage.js'
import { isSupabaseConfigured } from '../lib/supabase.js'
import { useOneTimeHint } from '../hooks/useOneTimeHint.js'
import { PREPARE_DEFAULT_ITEMS } from '../lib/constants.js'
import { BottleIcon, PillIcon } from '../components/icons.jsx'

function greeting() {
  const h = new Date().getHours()
  if (h < 12) return 'morning'
  if (h < 18) return 'afternoon'
  return 'evening'
}

// The launch screen: answers "what do you want to do" and nothing else.
// Feed, Nappy, Sleep and Sage each own their real logging UI on their own
// tab — this screen only routes to them, it never re-implements them.
export default function HomeScreen({ night, setScreen, onAskSage, onLogMedicine, onOpenHelp, authUser, profile }) {
  const p = palette(night)

  const [userName] = useState(() => getUserName() || '')

  // This device has synced to a shared household before, but the current
  // session isn't signed in — logs made now stay local-only and won't reach
  // the rest of the household until they sign back in. The name shown above
  // still comes from local storage regardless of auth state, so without this
  // it looks like everything's working as normal.
  const signedOutOfHousehold = isSupabaseConfigured && !authUser && getHouseholdLinked()

  // One-time guest-mode note: no account needed, but data lives on this
  // device only. Never shown to devices that have synced before (they get
  // the signed-out warning above instead), and gone forever once dismissed.
  const [guestHintUnseen, dismissGuestHint] = useOneTimeHint('guest_notice_dismissed')
  const guestNotice = guestHintUnseen && isSupabaseConfigured && !getHouseholdLinked()

  // "Welcome back" replaces the time-of-day greeting once a day or more has
  // passed since the app was last opened — otherwise it's just "Good
  // afternoon" as usual. Read once per visit, then record this visit for
  // next time.
  const [welcomeBack] = useState(() => {
    const last = getLastOpenedAt()
    return last ? (Date.now() - new Date(last).getTime()) >= 24 * 60 * 60 * 1000 : false
  })
  useEffect(() => { setLastOpenedAt() }, [])

  // Prepare checklist progress for the secondary card below.
  const [prepProgress] = useState(() => {
    const checked = getChecked()
    const hidden  = getHiddenDefaults()
    const items   = [...PREPARE_DEFAULT_ITEMS.filter(i => !hidden.includes(i.id)), ...getCustomItems()]
    return { done: items.filter(i => checked[i.id]).length, total: items.length }
  })

  // Full-width rows rather than a 2x2 grid — each action reads as its own
  // clear, oversized button rather than a tile in a dense grid.
  // Every row keeps the same dark-brown fill (that's the "high contrast,
  // oversized" foundation) — each action's own accent only tints its
  // border and icon badge, so the four read as a family with a hero each,
  // not identical blocks distinguished by text alone.
  const rowStyle = (accent) => ({ display: 'flex', alignItems: 'center', gap: 16, width: '100%', minHeight: 76, borderRadius: 20, border: `1.5px solid ${accent}`, background: brand.barkGradient, boxShadow: shadow(night, 1), cursor: 'pointer', padding: '0 20px', textAlign: 'left', WebkitTapHighlightColor: 'transparent' })
  const iconWrapStyle = (accent) => ({ width: 42, height: 42, borderRadius: '50%', background: iconWellBg(accent), display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 })
  // Parchment (near-white) rather than sand for the label itself — sand's
  // tan-on-brown contrast (~5:1) reads as soft since both are the same warm
  // hue. Bold weight made it worse, not better: light text on a dark fill
  // "blooms" at heavier weights (the halation/irradiation effect — bright
  // strokes visually bleed into the dark background), so medium weight at
  // the higher-contrast colour is what actually reads crisp.
  // Labels are single bare nouns (icon + chevron + accent colour already
  // signal "tap to log this") — a size bump uses the row's width on purpose
  // now that there's less text, rather than stretching letter-spacing, which
  // hurts legibility more than it helps fill space.
  const primaryLabel = { fontSize: 21, fontWeight: 500, color: brand.parchment, fontFamily: "'Jost', sans-serif", letterSpacing: '.01em' }
  const primaryChevron = { marginLeft: 'auto', color: brand.sand, opacity: 0.55, fontSize: 18, flexShrink: 0 }
  // Secondary pair (Sage, Going out) sit side by side, together spanning the
  // same width as the four rows above — a matched, quieter pair rather than
  // two full-width rows adrift with space between them.
  const secondaryCard = { flex: 1, minHeight: 76, borderRadius: 18, border: `1px solid ${p.border}`, background: p.card, boxShadow: shadow(night, 1), cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, WebkitTapHighlightColor: 'transparent' }

  return (
    <div style={{ flex: 1, overflowY: 'auto', background: p.bg, position: 'relative' }}>
      {/* Help — the corner opposite Settings, so the way to answers is
          always one tap from the launch screen rather than buried two
          levels deep behind the settings button */}
      <button onClick={() => onOpenHelp?.()} aria-label="Help and FAQ"
        style={{ position: 'absolute', top: 16, left: 16, zIndex: 1, background: 'none', border: `1px solid ${p.border}`, borderRadius: 20, padding: '6px 13px', cursor: 'pointer', color: p.sub, fontSize: 12 }}>
        ? Help
      </button>

      {/* Settings — pinned to the corner, out of the main flow so it doesn't
          claim one of the evenly-spread content slots below */}
      <button onClick={() => setScreen('settings')}
        style={{ position: 'absolute', top: 16, right: 16, zIndex: 1, background: 'none', border: `1px solid ${signedOutOfHousehold ? brand.rose : p.border}`, borderRadius: 20, padding: '6px 13px', cursor: 'pointer', color: signedOutOfHousehold ? brand.rose : profile?.household_id ? brand.green : p.sub, fontSize: 12 }}>
        {signedOutOfHousehold ? '⚠ Sign in to sync' : profile?.household_id ? '● Sharing' : '⚙ Settings'}
      </button>

      <div style={{ minHeight: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-evenly', padding: '48px 0 16px' }}>

      {/* ── Greeting — the one moment of warmth, given real room ── */}
      <div style={{ padding: '4px 16px 4px', textAlign: 'center' }}>
        <span style={{ display: 'block', fontFamily: "'Cormorant Garamond', serif", fontSize: 14, color: brand.sand, letterSpacing: '.14em', textTransform: 'uppercase' }}>
          {welcomeBack ? 'Welcome back' : `Good ${greeting()}`}
        </span>
        <span style={{ display: 'block', fontFamily: "'Cormorant Garamond', serif", fontSize: 40, fontWeight: 400, color: p.heading, lineHeight: 1.15, marginTop: 4 }}>
          {userName || 'Welcome'}
        </span>
        {/* No name yet — invite adding one rather than faking familiarity
            with a placeholder like "there". */}
        {!userName && (
          <button onClick={() => setScreen('settings')}
            style={{ display: 'block', margin: '4px auto 0', background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: p.sub, letterSpacing: '.02em' }}>
            + Add your name
          </button>
        )}
      </div>

      {/* ── What do you want to do? — the four things logged every day ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '10px 16px 0' }}>
        <button onClick={() => setScreen('feed')} style={rowStyle(brand.accent)}>
          <span style={iconWrapStyle(brand.accent)}><BottleIcon color={brand.accent} size={22} /></span>
          <span style={primaryLabel}>Feed</span>
          <span style={primaryChevron}>›</span>
        </button>
        <button onClick={() => setScreen('nappy')} style={rowStyle(brand.mist)}>
          <span style={iconWrapStyle(brand.mist)}><span style={{ fontSize: 20, color: brand.mist, lineHeight: 1 }}>◈</span></span>
          <span style={primaryLabel}>Nappy</span>
          <span style={primaryChevron}>›</span>
        </button>
        <button onClick={() => setScreen('sleep')} style={rowStyle(brand.green)}>
          <span style={iconWrapStyle(brand.green)}><span style={{ fontSize: 20, color: brand.green, lineHeight: 1 }}>☾</span></span>
          <span style={primaryLabel}>Sleep</span>
          <span style={primaryChevron}>›</span>
        </button>
        <button onClick={onLogMedicine} style={rowStyle(brand.rose)}>
          <span style={iconWrapStyle(brand.rose)}><PillIcon color={brand.rose} size={20} /></span>
          <span style={primaryLabel}>Medicine</span>
          <span style={primaryChevron}>›</span>
        </button>
      </div>

      {/* ── Secondary: Sage and Going out — a matched pair, available but
          not competing with the four logging actions above ── */}
      <div style={{ display: 'flex', gap: 10, padding: '10px 16px 0' }}>
        <button onClick={() => onAskSage('')} style={secondaryCard}>
          <span style={{ color: brand.sand, fontSize: 18, lineHeight: 1 }}>✦</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: p.text }}>Ask Sage</span>
        </button>
        <button onClick={() => setScreen('prepare')} style={secondaryCard}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={brand.sand} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="3" y="7" width="18" height="13" rx="2" />
            <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            <path d="M3 13h18" />
          </svg>
          <span style={{ fontSize: 13, fontWeight: 600, color: p.text }}>Going out</span>
          <span style={{ fontSize: 10, color: prepProgress.done === prepProgress.total && prepProgress.total > 0 ? brand.green : p.sub, fontWeight: 500 }}>
            {prepProgress.done === prepProgress.total && prepProgress.total > 0 ? '✓ Packed' : `${prepProgress.done}/${prepProgress.total}`}
          </span>
        </button>
      </div>

      {/* ── Guest-mode note — reassurance plus the honest caveat, once ── */}
      {guestNotice && !authUser && (
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, margin: '10px 16px 0', padding: '11px 13px', background: p.card, border: `1px solid ${p.border}`, borderRadius: 14 }}>
          <span style={{ flex: 1, fontSize: 11, color: p.sub, lineHeight: 1.5 }}>
            No account needed — everything is saved on this device only. If the device is lost or reset, so is your logbook. Sign in from Settings any time to back it up and share with a partner.
          </span>
          <button onClick={dismissGuestHint} aria-label="Dismiss"
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: p.sub, lineHeight: 1, padding: 0, flexShrink: 0 }}>
            ×
          </button>
        </div>
      )}

      </div>
    </div>
  )
}
