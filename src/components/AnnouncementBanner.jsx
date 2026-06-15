import { brand, palette } from '../theme.js'

// Owner-published broadcast banner. Content is rendered as plain text (never
// HTML) plus one optional link, so a published message can carry no markup or
// script. Styling follows the app's editorial card language: a soft tinted
// badge, an eyebrow label, a Cormorant Garamond title and a DM Sans body.
const TYPE_META = {
  info:    { eyebrow: 'Update',      icon: '🌿', accent: brand.sand },
  feature: { eyebrow: 'New',         icon: '✨', accent: brand.green },
  sale:    { eyebrow: 'Offer',       icon: '🎁', accent: brand.accent },
}

// Soft, mode-safe tint of an accent colour for badge/pill fills.
function tint(hex, alpha) {
  const n = parseInt(hex.slice(1), 16)
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`
}

export default function AnnouncementBanner({ night, announcement, onDismiss }) {
  const p = palette(night)
  const meta = TYPE_META[announcement.type] || TYPE_META.info
  const { title, body, action_url: url, action_label: label } = announcement

  return (
    <div className="fade-up" style={{
      margin: '8px 14px 0',
      background: p.card,
      border: `1px solid ${p.border}`,
      borderRadius: 16,
      padding: '13px 14px',
      display: 'flex',
      alignItems: 'flex-start',
      gap: 12,
      boxShadow: night ? 'none' : '0 6px 18px rgba(74,55,40,0.06)',
    }}>
      {/* Tinted badge — mirrors the mood chip elsewhere in the app */}
      <div style={{
        width: 36, height: 36, borderRadius: '50%',
        background: tint(meta.accent, night ? 0.22 : 0.14),
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 17, lineHeight: 1, flexShrink: 0, marginTop: 1,
      }}>
        {meta.icon}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <span style={{
          display: 'block', fontFamily: "'Cormorant Garamond', serif",
          fontSize: 11, color: meta.accent, letterSpacing: '.12em',
          textTransform: 'uppercase', marginBottom: 2,
        }}>
          {meta.eyebrow}
        </span>

        {title && (
          <span style={{
            display: 'block', fontFamily: "'Cormorant Garamond', serif",
            fontSize: 18, fontWeight: 400, color: p.heading,
            lineHeight: 1.2, marginBottom: 3,
          }}>
            {title}
          </span>
        )}

        <span style={{ display: 'block', fontSize: 13, color: p.sub, lineHeight: 1.45 }}>
          {body}
        </span>

        {url && (
          <a href={url} target="_blank" rel="noopener noreferrer" style={{
            display: 'inline-flex', alignItems: 'center', gap: 5, marginTop: 10,
            padding: '7px 13px', borderRadius: 999,
            background: tint(meta.accent, night ? 0.24 : 0.13),
            color: p.heading, fontSize: 12, fontWeight: 600, textDecoration: 'none',
          }}>
            {label || 'Learn more'}
            <span aria-hidden="true" style={{ color: meta.accent }}>→</span>
          </a>
        )}
      </div>

      <button onClick={onDismiss} aria-label="Dismiss" style={{
        width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
        marginTop: -2, marginRight: -2,
        background: 'none', border: 'none', cursor: 'pointer',
        fontSize: 18, color: p.sub, lineHeight: 1,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        ×
      </button>
    </div>
  )
}
