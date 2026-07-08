import { useState, useEffect } from 'react'
import { brand, palette, shadow, iconWellBg } from '../theme.js'

// Full-width warning shown while a device that has synced with a household
// before is signed out: everything logged now stays on this phone until the
// user signs back in. The Home screen's corner chip carries the same state,
// but it proved easy to miss — this sits above every screen instead.
//
// Dismissal is deliberately session-only, unlike the announcement and
// install banners (persisted) and the one-time hints: "signed out" is a
// live problem, not a notice, so it must come back on the next launch if
// still unresolved — and re-arm after a sign-in so a later session expiry
// mid-use warns afresh rather than staying muted.
// `hidden` suppresses rendering without touching the dismissal (used while
// the settings screen — home of the actual sign-in form — is open); only a
// genuine change back to signed-in re-arms a dismissal.
export default function SignedOutBanner({ night, signedOut, hidden, onSignIn }) {
  const p = palette(night)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    if (!signedOut) setDismissed(false)
  }, [signedOut])

  if (!signedOut || hidden || dismissed) return null

  return (
    <div className="fade-up" style={{
      margin: '8px 14px 0', background: p.card, border: `1px solid ${brand.rose}`, boxShadow: shadow(night, 1),
      borderRadius: 16, padding: '13px 14px', display: 'flex', alignItems: 'center', gap: 12,
    }}>
      <div style={{ width: 36, height: 36, borderRadius: '50%', background: iconWellBg(brand.rose), display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <span aria-hidden="true" style={{ fontSize: 16, color: brand.rose, lineHeight: 1 }}>⚠</span>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: 13, fontWeight: 600, color: p.text }}>You&apos;re signed out</span>
        <span style={{ display: 'block', fontSize: 12, color: p.sub, lineHeight: 1.45, marginTop: 2 }}>
          New entries stay on this phone and won&apos;t reach your household until you sign back in.
        </span>
      </div>
      <button onClick={onSignIn} style={{ background: brand.barkGradient, boxShadow: shadow(night, 1), border: 'none', borderRadius: 12, padding: '9px 14px', cursor: 'pointer', color: brand.sand, fontSize: 13, fontWeight: 600, flexShrink: 0 }}>
        Sign in
      </button>
      <button onClick={() => setDismissed(true)} aria-label="Dismiss" style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: p.sub, lineHeight: 1, flexShrink: 0 }}>
        ×
      </button>
    </div>
  )
}
