import { useState, useMemo } from 'react'
import { brand, palette } from '../theme.js'
import { FAQ_CATEGORIES } from '../lib/faqData.js'

const SUPPORT_EMAIL = 'support@navayababy.co.uk'

// Answers mention the support address in plain prose — make it tappable
// wherever it appears rather than asking a tired parent to retype it.
function AnswerText({ text, color }) {
  const parts = text.split(SUPPORT_EMAIL)
  return (
    <>
      {parts.map((part, i) => (
        <span key={i}>
          {part}
          {i < parts.length - 1 && (
            <a href={`mailto:${SUPPORT_EMAIL}`} style={{ color }}>{SUPPORT_EMAIL}</a>
          )}
        </span>
      ))}
    </>
  )
}

// Help & FAQ — reached from Settings, not the nav bar (like Prepare, it's an
// occasional lookup, not a many-times-a-day tab). One question open at a
// time keeps the page scannable; searching filters across every category.
export default function HelpScreen({ night, setScreen, backTo = 'settings' }) {
  const p = palette(night)

  const [query, setQuery] = useState('')
  const [openCategory, setOpenCategory] = useState(null)
  const [openQuestion, setOpenQuestion] = useState(null)

  const searching = query.trim().length > 0

  // While searching, categories collapse to only their matching questions
  // and all open up — the accordion is for browsing, not for hiding results.
  const visibleCategories = useMemo(() => {
    if (!searching) return FAQ_CATEGORIES
    const q = query.trim().toLowerCase()
    return FAQ_CATEGORIES
      .map(cat => ({ ...cat, items: cat.items.filter(item =>
        item.q.toLowerCase().includes(q) || item.a.toLowerCase().includes(q)
      ) }))
      .filter(cat => cat.items.length > 0)
  }, [query, searching])

  const toggleCategory = (id) => {
    setOpenCategory(open => (open === id ? null : id))
    setOpenQuestion(null)
  }

  const toggleQuestion = (key) => {
    setOpenQuestion(open => (open === key ? null : key))
  }

  return (
    <div style={{ flex: 1, overflowY: 'auto', background: p.bg, position: 'relative' }}>

      <button onClick={() => setScreen?.(backTo)}
        style={{ position: 'absolute', top: 18, left: 16, zIndex: 1, background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: 12, color: p.sub, letterSpacing: '.04em', display: 'flex', alignItems: 'center', gap: 4 }}>
        ‹ {backTo === 'home' ? 'Home' : 'Settings'}
      </button>

      {/* Header — centred, matching Feed/Nappy/Sleep/Logbook/Prepare */}
      <div style={{ padding: '20px 16px 12px', textAlign: 'center' }}>
        <div style={{ width: 52, height: 52, borderRadius: '50%', background: `${brand.sand}29`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
          <span style={{ fontSize: 24, color: brand.sand, lineHeight: 1 }}>?</span>
        </div>
        <span style={{ display: 'block', fontFamily: "'Cormorant Garamond', serif", fontSize: 12, color: brand.sand, letterSpacing: '.12em', textTransform: 'uppercase' }}>We&apos;re here to help</span>
        <span style={{ display: 'block', fontFamily: "'Cormorant Garamond', serif", fontSize: 34, fontWeight: 400, color: p.heading, marginTop: 4 }}>Help &amp; FAQ</span>
      </div>

      {/* Search */}
      <div style={{ padding: '0 14px 14px' }}>
        <input
          type="search"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search for an answer…"
          aria-label="Search the FAQ"
          style={{
            width: '100%', background: p.card, border: `1px solid ${p.border}`,
            borderRadius: 12, padding: '11px 13px', fontSize: 14, color: p.text,
            fontFamily: "'Jost', sans-serif", outline: 'none', boxSizing: 'border-box',
          }}
        />
      </div>

      {/* Categories */}
      {visibleCategories.map(cat => {
        const catOpen = searching || openCategory === cat.id
        return (
          <div key={cat.id} style={{ margin: '0 14px 10px', background: p.card, borderRadius: 18, border: `1px solid ${p.border}`, overflow: 'hidden' }}>
            <button onClick={() => toggleCategory(cat.id)} disabled={searching} aria-expanded={catOpen}
              style={{ display: 'flex', alignItems: 'center', width: '100%', background: 'none', border: 'none', cursor: searching ? 'default' : 'pointer', padding: '15px 16px', textAlign: 'left', WebkitTapHighlightColor: 'transparent' }}>
              <span style={{ flex: 1, fontFamily: "'Cormorant Garamond', serif", fontSize: 18, color: p.heading }}>
                {cat.title}
              </span>
              <span style={{ fontSize: 11, color: p.sub, marginRight: 10 }}>{cat.items.length}</span>
              {!searching && (
                <span aria-hidden="true" style={{ color: brand.sand, fontSize: 15, transform: catOpen ? 'rotate(90deg)' : 'none', transition: 'transform .2s', display: 'inline-block' }}>›</span>
              )}
            </button>

            {catOpen && cat.items.map((item, i) => {
              const key = `${cat.id}-${i}`
              const itemOpen = openQuestion === key
              return (
                <div key={key} style={{ borderTop: `1px solid ${p.border}` }}>
                  <button onClick={() => toggleQuestion(key)} aria-expanded={itemOpen}
                    style={{ display: 'flex', alignItems: 'flex-start', gap: 10, width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: '12px 16px', textAlign: 'left', WebkitTapHighlightColor: 'transparent' }}>
                    <span style={{ flex: 1, fontSize: 13, fontWeight: 500, color: p.text, lineHeight: 1.45 }}>
                      {item.q}
                    </span>
                    <span aria-hidden="true" style={{ color: p.sub, fontSize: 13, flexShrink: 0, transform: itemOpen ? 'rotate(90deg)' : 'none', transition: 'transform .2s', display: 'inline-block', marginTop: 1 }}>›</span>
                  </button>
                  {itemOpen && (
                    <span style={{ display: 'block', padding: '0 16px 14px', fontSize: 13, color: p.sub, lineHeight: 1.6 }}>
                      <AnswerText text={item.a} color={p.sub} />
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        )
      })}

      {/* No matches — keep the way to a human visible right where the search failed */}
      {searching && visibleCategories.length === 0 && (
        <div style={{ margin: '0 14px 12px', padding: '16px', background: p.card, borderRadius: 18, border: `1px solid ${p.border}`, textAlign: 'center' }}>
          <span style={{ display: 'block', fontSize: 13, color: p.text, marginBottom: 6 }}>
            No answers match &ldquo;{query.trim()}&rdquo;
          </span>
          <span style={{ display: 'block', fontSize: 12, color: p.sub, lineHeight: 1.5 }}>
            We&apos;re happy to help directly — email{' '}
            <a href={`mailto:${SUPPORT_EMAIL}`} style={{ color: p.sub }}>{SUPPORT_EMAIL}</a>
          </span>
        </div>
      )}

      <div style={{ height: 20 }} />
    </div>
  )
}
