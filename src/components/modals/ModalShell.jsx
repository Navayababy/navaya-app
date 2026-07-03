import { palette, shadow } from '../../theme.js'

export default function ModalShell({ title, night, onClose, children }) {
  const p = palette(night)
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 100, padding: '0 0 env(safe-area-inset-bottom, 0)' }}>
      <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 430, background: p.card, borderRadius: '20px 20px 0 0', padding: '20px 20px 28px', border: `1px solid ${p.border}`, boxShadow: shadow(night, 3), maxHeight: '85vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <span style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 20, color: p.heading }}>{title}</span>
          <button onClick={onClose} aria-label="Close" style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: p.sub }}>×</button>
        </div>
        {children}
      </div>
    </div>
  )
}
