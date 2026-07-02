// api/log.js
// Client error reporting. Each report is written to the function log
// (Vercel dashboard → Logs) so production breakage is visible without a
// third-party service. Nothing is stored and nothing is returned.

// Same in-memory limiter pattern as api/chat.js — per-instance only, which
// is enough to keep a misbehaving client from flooding the logs.
const RATE_LIMIT_WINDOW_MS = 60 * 1000
const RATE_LIMIT_MAX = 20
const rateLimitMap = new Map()

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

const str = (value, max) => (typeof value === 'string' ? value.slice(0, max) : '')

export default function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const ip = req.headers['x-forwarded-for']?.split(',')[0].trim() || req.socket?.remoteAddress || 'unknown'
  if (isRateLimited(ip)) {
    return res.status(429).end()
  }

  const body = req.body && typeof req.body === 'object' ? req.body : {}
  console.error('[client-error]', JSON.stringify({
    context: str(body.context, 100) || 'unknown',
    message: str(body.message, 1000),
    stack:   str(body.stack, 2000),
    ua:      str(req.headers['user-agent'], 200),
    at:      new Date().toISOString(),
  }))
  return res.status(204).end()
}
