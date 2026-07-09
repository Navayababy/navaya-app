// Persisted queue of Supabase writes. Every shared-mode write joins this
// queue (see sync.js — there is no direct-delivery path around it); items
// are flushed oldest-first and shared UUIDs make retried inserts idempotent.
//
// The queue is drained under a cross-tab lock (see sync.js's runDrain), so
// whichever tab holds it may process items enqueued by ANY tab. Any state
// a caller needs to learn its own item's outcome must therefore live here
// in localStorage too, alongside the queue — not in a tab-local variable,
// which is invisible to whichever other tab actually handles the item.
// That mismatch (durable shared queue, ephemeral per-tab outcome map) is
// what let a dropped write get reported back to its caller as delivered.

import { newId } from './id.js'

const KEY = 'navaya_outbox'
const DROPS_KEY = 'navaya_outbox_drops'
// A caller reads its own entry within milliseconds of the drop (it's
// actively polling for its item to leave the queue) — anything still
// unread after this long belongs to nobody (a background flush dropped it,
// or the tab that enqueued it closed) and is safe to prune. Age-based, not
// count-based: a count cap risks evicting a live caller's entry under
// bursty writes, which reads back as a false delivery — the exact bug this
// store exists to prevent.
const DROP_TTL_MS = 10 * 60 * 1000

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

function getDrops() {
  try {
    return JSON.parse(localStorage.getItem(DROPS_KEY) || '{}')
  } catch {
    return {}
  }
}

// Whichever tab's drain drops an item — its own or one it inherited from
// another tab under the shared lock — records the reason here, keyed by
// queue id, before removing the item from the outbox. That ordering
// matters: any tab's read of the outbox that no longer contains the item
// happens-after this write (both are synchronous localStorage calls in the
// dropping tab's single-threaded drain, and localStorage writes are
// immediately visible to reads in every same-origin tab), so a caller that
// observes its item gone can always find the reason already here if there
// is one.
export function recordDropOutcome(id, error) {
  const drops = getDrops()
  const cutoff = Date.now() - DROP_TTL_MS
  for (const key of Object.keys(drops)) {
    if (!(drops[key]?.at > cutoff)) delete drops[key]
  }
  drops[id] = { error, at: Date.now() }
  localStorage.setItem(DROPS_KEY, JSON.stringify(drops))
}

export function getDropOutcome(id) {
  const entry = getDrops()[id]
  return entry ? entry.error : null
}

export function clearDropOutcome(id) {
  const drops = getDrops()
  if (!(id in drops)) return
  delete drops[id]
  localStorage.setItem(DROPS_KEY, JSON.stringify(drops))
}
