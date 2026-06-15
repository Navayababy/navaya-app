import { brand, palette } from '../theme.js'

// Owner-published broadcast banner. Content is rendered as plain text (never
// HTML) plus one optional link, so a published message can carry no markup or
// script. Styling is keyed off the announcement type.
const TYPE_META = {
  info:    { icon: 'ℹ️', accent: brand.bark },
  feature: { icon: '✨', accent: brand.green },
  sale:    { icon: '🎉', accent: brand.accent },
}

export default function AnnouncementBanner({ night, announcement, onDismiss }) {
  const p = palette(night)
  const meta = TYPE_META[announcement.type] || TYPE_META.info
  const { title, body, action_url: url, action_label: label } = announcement

  return (
    <div style={{
      margin: '8px 14px 0',
      background: p.card,
      border: `1px solid ${p.border}`,
      borderLeft: `3px solid ${meta.accent}`,
      borderRadius: 12,
      padding: '11px 12px',
      display: 'flex',
      alignItems: 'flex-start',
      gap: 10,
    }}>
      <span style={{ fontSize: 18, lineHeight: 1.2, flexShrink: 0 }}>{meta.icon}</span>
      <div style={{ minWidth: 0, flex: 1 }}>
        {title && (
          <span style={{ display: 'block', fontSize: 13, fontWeight: 700, color: p.heading, marginBottom: 2 }}>
            {title}
          </span>
        )}
        <span style={{ display: 'block', fontSize: 12, color: p.text, lineHeight: 1.4 }}>
          {body}
        </span>
        {url && (
          <a href={url} target="_blank" rel="noopener noreferrer"
            style={{ display: 'inline-block', marginTop: 8, fontSize: 12, fontWeight: 600, color: meta.accent, textDecoration: 'none' }}>
            {label || 'Learn more'} →
          </a>
        )}
      </div>
      <button onClick={onDismiss} aria-label="Dismiss"
        style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: p.sub, padding: '0 2px', lineHeight: 1, flexShrink: 0 }}>
        ×
      </button>
    </div>
  )
}
