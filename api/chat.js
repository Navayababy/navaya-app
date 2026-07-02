// api/chat.js
// Vercel serverless function — proxies to Anthropic keeping the API key server-side.

const SYSTEM = `You are Sage — a warm, knowledgeable breastfeeding companion built into the Navaya app. Navaya is a premium UK parenting brand founded by Vin and Parm, created to help mothers breastfeed with confidence and dignity.

Your personality: you feel like a best friend who happens to have deep expertise in breastfeeding. You're honest, never preachy, and you meet mothers exactly where they are — whether that's 2am and exhausted, or calmly planning ahead. You use "you" not "mothers". You never lecture.

Your role is to give honest, practical, evidence-based breastfeeding support. You draw exclusively from reputable sources including NHS UK guidelines, WHO breastfeeding recommendations, NICE clinical guidelines, UNICEF UK Baby Friendly Initiative, La Leche League International, and IBCLC consensus guidance.

Many of the parents you support combine breastfeeding with bottle feeds of expressed milk or formula. Treat mixed feeding as completely normal and never something to apologise for — support it without judgement. You can draw on NHS guidance for safe formula preparation and storage, responsive (paced) bottle feeding, expressing and storing breast milk, and protecting milk supply while combination feeding.

Tone: warm, direct, grounded — never clinical or robotic. Lead with the practical answer in plain language, then add context if it helps. 3 to 5 sentences for most questions, more only when truly needed. Always recommend a GP, midwife, health visitor or IBCLC for anything that sounds medical or urgent. Never make up statistics or give diagnoses.`;

// In-memory rate limiting — 10 requests per minute per IP.
// Note: per-instance only; Vercel edge middleware with KV would enforce cross-instance limits.
const RATE_LIMIT_WINDOW_MS = 60 * 1000
const RATE_LIMIT_MAX = 10
const rateLimitMap = new Map()

// Payload limits — keeps a misbehaving client from running up the token bill
const MAX_MESSAGES = 50
const MAX_MESSAGE_CHARS = 4000
const MAX_TOTAL_CHARS = 24000

function isRateLimited(ip) {
  const now = Date.now()
  // Drop expired entries so the map can't grow without bound
  if (rateLimitMap.size > 1000) {
    for (const [key, value] of rateLimitMap) {
      if (now - value.windowStart > RATE_LIMIT_WINDOW_MS) rateLimitMap.delete(key)
    }
  }
  const entry = rateLimitMap.get(ip) || { count: 0, windowStart: now }
  if (now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
    entry.count = 1
    entry.windowStart = now
  } else {
    entry.count += 1
  }
  rateLimitMap.set(ip, entry)
  return entry.count > RATE_LIMIT_MAX
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const ip = req.headers['x-forwarded-for']?.split(',')[0].trim() || req.socket?.remoteAddress || 'unknown'
  if (isRateLimited(ip)) {
    return res.status(429).json({ error: 'Too many requests. Please wait a moment and try again.' })
  }

  // req.body is undefined when the request has no JSON body (or a non-JSON
  // content type) — that must be a 400, not an unhandled TypeError.
  const { messages } = req.body || {}

  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'messages array required' })
  }

  if (messages.length > MAX_MESSAGES) {
    return res.status(400).json({ error: 'Message history too long' })
  }

  let totalChars = 0
  for (const m of messages) {
    if (!m || typeof m !== 'object' || (m.role !== 'user' && m.role !== 'assistant') || typeof m.content !== 'string' || !m.content.trim()) {
      return res.status(400).json({ error: 'Invalid message format' })
    }
    if (m.content.length > MAX_MESSAGE_CHARS) {
      return res.status(400).json({ error: 'Message too long' })
    }
    totalChars += m.content.length
  }
  if (totalChars > MAX_TOTAL_CHARS) {
    return res.status(400).json({ error: 'Conversation too long. Please start a new chat.' })
  }
  if (messages[messages.length - 1].role !== 'user') {
    return res.status(400).json({ error: 'Last message must be from the user' })
  }

  // Forward only the validated fields — never the raw client objects
  const sanitized = messages.map(m => ({ role: m.role, content: m.content }))

  const controller = new AbortController()
  // Guards the connection + first byte; cleared once Anthropic responds,
  // after which the stream itself paces the response.
  const timeoutId = setTimeout(() => controller.abort(), 15000)

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1024,
        stream: true,
        // Chat configuration per the Sonnet 4.6 migration guide: thinking off
        // and low effort keep latency and cost at Sonnet 4 levels.
        thinking: { type: 'disabled' },
        output_config: { effort: 'low' },
        system: SYSTEM,
        messages: sanitized,
      }),
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      const data = await response.json().catch(() => ({}))
      console.error('Anthropic API error:', { status: response.status, message: data.error?.message })
      return res.status(response.status).json({ error: data.error?.message || 'API error' })
    }

    // Relay the SSE stream as plain text chunks so the first words reach the
    // user immediately instead of after the full completion.
    res.writeHead(200, {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-cache',
    })

    const decoder = new TextDecoder()
    let buffer = ''
    for await (const chunk of response.body) {
      buffer += decoder.decode(chunk, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop()
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue
        let event
        try { event = JSON.parse(line.slice(6)) } catch { continue }
        if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
          res.write(event.delta.text)
        }
      }
    }
    return res.end()

  } catch (error) {
    clearTimeout(timeoutId)
    // If the stream broke after headers were sent, all we can do is end it —
    // the client treats whatever arrived as the (partial) reply.
    if (res.headersSent) {
      console.error('Chat stream error:', error)
      return res.end()
    }
    if (error.name === 'AbortError') {
      return res.status(504).json({ error: 'Request timed out. Please try again.' })
    }
    console.error('Chat error:', error)
    return res.status(500).json({ error: 'Something went wrong. Please try again.' })
  }
}

// Vercel Node runtime: opt in to response streaming
export const config = { supportsResponseStreaming: true }
