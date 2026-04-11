import { useState, useEffect, useRef } from 'react'
import { brand, palette } from '../theme.js'

const SUGGESTIONS = [
  "My latch feels painful — is this normal?",
  "How do I know if my baby is getting enough milk?",
  "Can I take ibuprofen while breastfeeding?",
  "How do I manage a clogged duct?",
  "When should I introduce a bottle?",
  "My milk supply feels low — what can I do?",
]

export default function ChatScreen({ night }) {
  const p = palette(night)
  const [messages, setMessages] = useState([])
  const [input,    setInput]    = useState('')
  const [loading,  setLoading]  = useState(false)
  const bottomRef = useRef(null)
  const textareaRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  const send = async (text) => {
    const q = text.trim()
    if (!q || loading) return

    const userMsg  = { role: 'user', content: q }
    const history  = [...messages, userMsg]
    setMessages(history)
    setInput('')
    setLoading(true)

    try {
      // Call our Vercel serverless function, which keeps the API key secure
      const res = await fetch('/api/chat', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          messages: history.map(m => ({ role: m.role, content: m.content }))
        }),
      })

      const data = await res.json()

      if (!res.ok) throw new Error(data.error || 'API error')

      setMessages(h => [...h, { role: 'assistant', content: data.reply }])

    } catch (err) {
      setMessages(h => [...h, {
        role:    'assistant',
        content: 'Something went wrong. Please check your connection and try again.',
        error:   true,
      }])
    }

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

      {/* Header */}
      <div style={{ padding: '20px 16px 12px', flexShrink: 0 }}>
        <span style={{ display: 'block', fontFamily: "'Cormorant Garamond', serif", fontSize: 12, color: brand.sand, letterSpacing: '.12em', textTransform: 'uppercase' }}>Your breastfeeding companion</span>
        <span style={{ display: 'block', fontFamily: "'Cormorant Garamond', serif", fontSize: 26, fontWeight: 400, color: night ? brand.parchment : brand.bark, marginTop: 2 }}>Sage</span>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 14px' }}>

        {/* Empty state */}
        {messages.length === 0 && (
          <div className="fade-up">
            <div style={{ background: brand.bark, borderRadius: 14, padding: '14px', marginBottom: 14 }}>
              <span style={{ display: 'block', fontSize: 13, color: brand.parchment, lineHeight: 1.6 }}>
                Hi, I'm Sage — think of me as a knowledgeable friend who's always awake. Ask me anything about breastfeeding and I'll give you honest, practical answers grounded in NHS, WHO, NICE and IBCLC guidance.
              </span>
              <span style={{ display: 'block', fontSize: 10, color: brand.sand, marginTop: 8, lineHeight: 1.5 }}>
                For anything that feels medical or urgent, always follow up with your GP, midwife or health visitor.
              </span>
            </div>

            <span style={{ display: 'block', fontSize: 10, color: p.sub, letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 10 }}>What's on your mind?</span>
            {SUGGESTIONS.map((s, i) => (
              <button key={i} onClick={() => send(s)}
                style={{ width: '100%', textAlign: 'left', background: p.card, border: `1px solid ${p.border}`, borderRadius: 12, padding: '11px 12px', marginBottom: 7, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ color: brand.sand, fontSize: 12, flexShrink: 0 }}>✦</span>
                <span style={{ fontSize: 12, color: p.text, lineHeight: 1.4 }}>{s}</span>
              </button>
            ))}
          </div>
        )}

        {/* Message list */}
        {messages.map((m, i) => (
          <div key={i} className="fade-up" style={{ marginBottom: 10, display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
            {m.role === 'user' ? (
              <div style={{ background: brand.bark, borderRadius: '14px 14px 4px 14px', padding: '10px 13px', maxWidth: '84%' }}>
                <span style={{ fontSize: 13, color: brand.parchment, lineHeight: 1.5 }}>{m.content}</span>
              </div>
            ) : (
              <div style={{ background: p.card, border: `1px solid ${m.error ? '#C0392B' : p.border}`, borderRadius: '14px 14px 14px 4px', padding: '12px 13px', maxWidth: '92%' }}>
                <span style={{ display: 'block', fontSize: 9, color: brand.sand, letterSpacing: '.06em', textTransform: 'uppercase', fontWeight: 600, marginBottom: 6 }}>✦ Sage</span>
                <span style={{ fontSize: 13, color: p.text, lineHeight: 1.65 }}>{m.content}</span>
              </div>
            )}
          </div>
        ))}

        {/* Loading dots */}
        {loading && (
          <div className="fade-up" style={{ marginBottom: 10 }}>
            <div style={{ background: p.card, border: `1px solid ${p.border}`, borderRadius: '14px 14px 14px 4px', padding: '13px', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 9, color: brand.sand }}>✦</span>
              <span className="dot-1" style={{ width: 5, height: 5, borderRadius: '50%', background: brand.sand, display: 'inline-block' }} />
              <span className="dot-2" style={{ width: 5, height: 5, borderRadius: '50%', background: brand.sand, display: 'inline-block' }} />
              <span className="dot-3" style={{ width: 5, height: 5, borderRadius: '50%', background: brand.sand, display: 'inline-block' }} />
            </div>
          </div>
        )}

        <div ref={bottomRef} style={{ height: 4 }} />
      </div>

      {/* Input bar */}
      <div style={{ padding: '8px 14px 12px', background: p.bg, borderTop: `1px solid ${p.border}`, flexShrink: 0, display: 'flex', gap: 8, alignItems: 'flex-end' }}>
        <textarea
          ref={textareaRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKey}
          placeholder="Ask Sage anything…"
          rows={1}
          style={{
            flex:        1,
            background:  p.card,
            border:      `1px solid ${p.border}`,
            borderRadius: 12,
            padding:     '10px 13px',
            fontSize:    13,
            color:       p.text,
            fontFamily:  "'DM Sans', sans-serif",
            resize:      'none',
            outline:     'none',
            lineHeight:  1.4,
            maxHeight:   80,
          }}
        />
        <button
          onClick={() => send(input)}
          disabled={!input.trim() || loading}
          style={{
            width:        38,
            height:       38,
            borderRadius: 11,
            border:       'none',
            cursor:       input.trim() && !loading ? 'pointer' : 'default',
            background:   input.trim() && !loading ? brand.bark : p.border,
            display:      'flex',
            alignItems:   'center',
            justifyContent: 'center',
            flexShrink:   0,
            transition:   'background .2s',
          }}
        >
          <span style={{ color: input.trim() && !loading ? brand.sand : p.sub, fontSize: 16 }}>↑</span>
        </button>
      </div>
    </div>
  )
}
