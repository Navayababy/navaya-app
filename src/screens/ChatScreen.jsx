import { useState, useEffect, useRef } from 'react'
import { brand, palette, shadow, iconWellBg } from '../theme.js'

const SUGGESTIONS = [
  { label: 'Painful latch',     q: "My latch feels painful — is this normal?" },
  { label: 'Enough milk?',      q: "How do I know if my baby is getting enough milk?" },
  { label: 'Medication safety', q: "Can I take ibuprofen while breastfeeding?" },
  { label: 'Clogged duct',      q: "How do I manage a clogged duct?" },
  { label: 'Bottle timing',     q: "When should I introduce a bottle?" },
  { label: 'Low supply',        q: "My milk supply feels low — what can I do?" },
]

export default function ChatScreen({ night, messages, setMessages, seed = '', onSeedConsumed }) {
  const p = palette(night)
  const [input,     setInput]     = useState('')
  const [loading,   setLoading]   = useState(false)
  const [streaming, setStreaming] = useState(false)
  const bottomRef = useRef(null)
  const textareaRef = useRef(null)

  // A seeded question from a Home nudge is prefilled (not auto-sent) so the
  // parent decides whether to ask it. Consumed once on open.
  useEffect(() => {
    if (!seed) return
    setInput(seed)
    onSeedConsumed?.()
    const el = textareaRef.current
    if (el) { el.focus(); el.setSelectionRange(seed.length, seed.length) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  const send = async (text) => {
    const q = text.trim()
    if (!q || loading) return

    const userMsg = { id: `${Date.now()}-user`, role: 'user', content: q }
    const history = [...messages, userMsg]
    setMessages(history)
    setInput('')
    setLoading(true)

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 20000)

    // Send only recent turns (excluding error bubbles) to stay under the API
    // limits; the API requires the first message to be from the user.
    let recent = history.filter(m => !m.error).slice(-20)
    while (recent.length && recent[0].role !== 'user') recent = recent.slice(1)

    try {
      const res = await fetch('/api/chat', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          messages: recent.map(m => ({ role: m.role, content: m.content }))
        }),
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setMessages(h => [...h, { id: `${Date.now()}-error`, role: 'assistant', content: data.error || 'Something went wrong. Please try again.', error: true }])
        setLoading(false)
        return
      }

      // The reply streams as plain text — grow the bubble as words arrive
      const id = `${Date.now()}-assistant`
      setMessages(h => [...h, { id, role: 'assistant', content: '' }])
      setStreaming(true)

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let received = ''
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        const text = decoder.decode(value, { stream: true })
        if (!text) continue
        received += text
        setMessages(h => h.map(m => m.id === id ? { ...m, content: m.content + text } : m))
      }

      if (!received.trim()) {
        setMessages(h => h.map(m => m.id === id
          ? { ...m, content: 'Something went wrong. Please try again.', error: true }
          : m))
      }

    } catch (err) {
      clearTimeout(timeoutId)
      const msg = err.name === 'AbortError'
        ? 'The request timed out. Please check your connection and try again.'
        : 'Something went wrong. Please check your connection and try again.'
      setMessages(h => [...h, { id: `${Date.now()}-error`, role: 'assistant', content: msg, error: true }])
    }

    setStreaming(false)
    setLoading(false)
  }

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send(input)
    }
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: p.bg, minHeight: 0 }}>

      {/* Header — centred, matching Feed/Nappy/Sleep/Logbook/Prepare */}
      <div style={{ padding: '20px 16px 12px', flexShrink: 0, textAlign: 'center' }}>
        <div style={{ width: 52, height: 52, borderRadius: '50%', background: iconWellBg(brand.sand), boxShadow: shadow(night, 1), display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
          <span style={{ fontSize: 24, color: brand.sand, lineHeight: 1 }}>✦</span>
        </div>
        <span style={{ display: 'block', fontFamily: "'Cormorant Garamond', serif", fontSize: 12, color: brand.sand, letterSpacing: '.12em', textTransform: 'uppercase' }}>Your breastfeeding companion</span>
        <span style={{ display: 'block', fontFamily: "'Cormorant Garamond', serif", fontSize: 34, fontWeight: 400, color: p.heading, marginTop: 4 }}>Sage</span>
      </div>

      {/* Messages */}
      <div role="log" aria-live="polite" aria-label="Conversation with Sage" style={{ flex: 1, overflowY: 'auto', padding: '0 14px', display: 'flex', flexDirection: 'column' }}>

        {/* Empty state — a short greeting plus a scrollable row of shortcuts
            sitting right above the input, instead of a stacked intro card
            and six full-width questions dominating the screen. */}
        {messages.length === 0 && (
          <div className="fade-up" style={{ marginTop: 'auto' }}>
            <p style={{ textAlign: 'center', fontSize: 13, color: p.sub, lineHeight: 1.6, margin: '0 auto 16px', maxWidth: 280 }}>
              Hi, I&apos;m <span style={{ color: p.heading, fontWeight: 500 }}>Sage</span>. Ask anything about breastfeeding — grounded in NHS, WHO and IBCLC guidance.
            </p>

            <span style={{ display: 'block', fontSize: 10, color: p.sub, letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: 8, marginLeft: 2 }}>Try asking</span>
            <div style={{
              display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4,
              WebkitMaskImage: 'linear-gradient(to right, black 0%, black 88%, transparent 100%)',
              maskImage: 'linear-gradient(to right, black 0%, black 88%, transparent 100%)',
            }}>
              {SUGGESTIONS.map((s) => (
                <button key={s.label} onClick={() => send(s.q)} aria-label={s.q}
                  style={{ flexShrink: 0, whiteSpace: 'nowrap', background: p.card, border: `1px solid ${p.border}`, borderRadius: 999, padding: '9px 15px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ color: brand.sand, fontSize: 11 }}>✦</span>
                  <span style={{ fontSize: 12.5, color: p.text }}>{s.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Message list */}
        {messages.map((m) => (
          <div key={m.id} className="fade-up" style={{ marginBottom: 10, display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
            {m.role === 'user' ? (
              <div style={{ background: brand.barkGradient, boxShadow: shadow(night, 1), borderRadius: '14px 14px 4px 14px', padding: '10px 13px', maxWidth: '84%' }}>
                <span style={{ fontSize: 13, color: brand.parchment, lineHeight: 1.5 }}>{m.content}</span>
              </div>
            ) : (
              <div style={{ background: p.card, border: `1px solid ${m.error ? brand.danger : p.border}`, boxShadow: shadow(night, 1), borderRadius: '14px 14px 14px 4px', padding: '12px 13px', maxWidth: '92%' }}>
                <span style={{ display: 'block', fontSize: 9, color: p.sub, letterSpacing: '.06em', textTransform: 'uppercase', fontWeight: 600, marginBottom: 6 }}>✦ Sage</span>
                <span style={{ fontSize: 13, color: p.text, lineHeight: 1.65 }}>{m.content}</span>
              </div>
            )}
          </div>
        ))}

        {/* Loading dots — only while waiting for the first words */}
        {loading && !streaming && (
          <div className="fade-up" style={{ marginBottom: 10 }}>
            <div style={{ background: p.card, border: `1px solid ${p.border}`, boxShadow: shadow(night, 1), borderRadius: '14px 14px 14px 4px', padding: '13px', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 9, color: brand.sand }}>✦</span>
              <span className="dot-1" style={{ width: 5, height: 5, borderRadius: '50%', background: brand.sand, display: 'inline-block' }} />
              <span className="dot-2" style={{ width: 5, height: 5, borderRadius: '50%', background: brand.sand, display: 'inline-block' }} />
              <span className="dot-3" style={{ width: 5, height: 5, borderRadius: '50%', background: brand.sand, display: 'inline-block' }} />
            </div>
          </div>
        )}

        <div ref={bottomRef} style={{ height: 4 }} />
      </div>

      {/* Input — the biggest, clearest thing on screen: a sand-bordered
          compose bar with an explicit label, instead of a slim textarea
          easy to miss below a wall of suggestions. */}
      <div style={{ padding: '10px 14px 4px', background: p.bg, flexShrink: 0 }}>
        <span style={{ display: 'block', fontSize: 10, color: p.sub, letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: 6, marginLeft: 2 }}>Type your question</span>
        <div style={{
          display:      'flex',
          alignItems:   'flex-end',
          gap:          8,
          background:   p.card,
          border:       `1.5px solid ${brand.sand}`,
          borderRadius: 18,
          padding:      '6px 6px 6px 15px',
          boxShadow:    `0 0 0 4px ${brand.sand}1F, ${shadow(night, 1)}`,
        }}>
          <textarea
            ref={textareaRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Ask Sage anything…"
            rows={1}
            style={{
              flex:        1,
              background:  'transparent',
              border:      'none',
              padding:     '9px 0',
              fontSize:    14.5,
              color:       p.text,
              fontFamily:  "'Jost', sans-serif",
              resize:      'none',
              outline:     'none',
              lineHeight:  1.4,
              maxHeight:   100,
            }}
          />
          <button
            onClick={() => send(input)}
            disabled={!input.trim() || loading}
            style={{
              width:        42,
              height:       42,
              borderRadius: 14,
              border:       'none',
              cursor:       input.trim() && !loading ? 'pointer' : 'default',
              background:   input.trim() && !loading ? brand.barkGradient : p.border,
              display:      'flex',
              alignItems:   'center',
              justifyContent: 'center',
              flexShrink:   0,
              transition:   'background .2s',
            }}
          >
            <span style={{ color: input.trim() && !loading ? brand.sand : p.sub, fontSize: 17 }}>↑</span>
          </button>
        </div>
      </div>

      {/* Always-visible, single quiet line — folds the old dismissible
          privacy note and the persistent medical disclaimer into one
          sentence instead of two separate cards competing for attention. */}
      <div style={{ padding: '6px 14px 12px', background: p.bg, flexShrink: 0 }}>
        <span style={{ display: 'block', fontSize: 9.5, color: p.sub, opacity: .75, textAlign: 'center', lineHeight: 1.4 }}>
          Private to you, not saved once you leave — and not a substitute for medical advice. For anything urgent, contact your GP, midwife or 111.
        </span>
      </div>
    </div>
  )
}
