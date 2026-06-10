// Persisted queue of Supabase writes that could not be delivered immediately.
// Items are flushed oldest-first; shared UUIDs make retried inserts idempotent.

const KEY = 'navaya_outbox'

export function getOutbox() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '[]')
  } catch {
    return []
  }
}

export function saveOutbox(items) {
  localStorage.setItem(KEY, JSON.stringify(items))
}

export function enqueue(type, payload) {
  saveOutbox([...getOutbox(), { type, payload, attempts: 0, queuedAt: Date.now() }])
}

export function outboxSize() {
  return getOutbox().length
}
