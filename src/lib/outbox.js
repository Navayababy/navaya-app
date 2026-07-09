// Persisted queue of Supabase writes. Every shared-mode write joins this
// queue (see sync.js — there is no direct-delivery path around it); items
// are flushed oldest-first and shared UUIDs make retried inserts idempotent.

import { newId } from './id.js'

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

// The queue id identifies this item to the syncWrite that enqueued it (so
// it can tell delivered from dropped from still-queued after a flush); it
// is unrelated to the entry UUID inside the payload.
export function enqueue(type, payload) {
  const item = { id: newId(), type, payload, attempts: 0, queuedAt: Date.now() }
  saveOutbox([...getOutbox(), item])
  return item
}

export function outboxSize() {
  return getOutbox().length
}
