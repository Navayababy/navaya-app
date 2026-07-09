// Persisted queue of Supabase writes. Every shared-mode write joins this
// queue (see sync.js — there is no direct-delivery path around it); items
// are flushed oldest-first and shared UUIDs make retried inserts idempotent.
//
// Both KEY and DROPS_KEY are shared across every tab of the app, and every
// mutation of either — with NO exception — happens inside withOutboxLock.
// That is a deliberate, blanket rule rather than a per-function argument:
// this file already had two near-misses from the weaker version of that
// rule ("only ever called from inside the locked drain()"). enqueue()
// predates the lock entirely and was never brought under it when the lock
// was introduced — two tabs could each read the queue, build their own
// version with their own new item, and whichever wrote last would
// silently erase the other tab's write, with syncWrite still reporting
// success. recordDropOutcome (called only from inside drain(), so already
// lock-protected in practice) had a sibling, clearDropOutcome, that wrote
// the same shared JSON blob from OUTSIDE the lock — able to race a
// concurrent recordDropOutcome from another tab and clobber a just-landed
// drop record for a completely different write, silently reintroducing
// the exact "dropped write reported as delivered" bug this store exists
// to prevent, just via a different door. A single mechanically-checkable
// rule — touches either key, always through the lock — is what actually
// closes this off: the next reviewer has one thing to check, not a fresh
// ordering proof for whatever new function touches these keys next.

import { newId } from './id.js'

const KEY = 'navaya_outbox'
const DROPS_KEY = 'navaya_outbox_drops'
const LOCK_NAME = 'navaya_outbox_drain'
// A caller reads its own entry within milliseconds of the drop (it's
// actively polling for its item to leave the queue) — anything still
// unread after this long belongs to nobody (a background flush dropped it,
// or the tab that enqueued it closed) and is safe to prune. Age-based, not
// count-based: a count cap risks evicting a live caller's entry under
// bursty writes, which reads back as a false delivery — the exact bug this
// store exists to prevent. This is an application-level assumption, not an
// enforced one: a tab genuinely frozen by the OS (backgrounded/suspended)
// for longer than this while a different, active tab/device drops its
// write would still read a false delivery on resume. 10 minutes is well
// beyond any normal foreground wait (syncWrite's own poll loop resolves
// within milliseconds of a drop) and short enough to bound the store's
// size; it does not attempt to cover an arbitrarily long background freeze.
const DROP_TTL_MS = 10 * 60 * 1000

// Browsers without the Web Locks API fall back to running fn() directly —
// no cross-tab exclusion, but no worse than every write in this file was
// before the lock existed. drain() holds this lock for its entire
// (possibly multi-item) pass; every other caller holds it for just the one
// operation. Not reentrant — never call this from within a callback
// already running inside it (no code here does; drain()'s own mutations
// use the raw functions directly, since it already holds the lock).
export function withOutboxLock(fn) {
  if (typeof navigator !== 'undefined' && navigator.locks?.request) {
    return navigator.locks.request(LOCK_NAME, fn)
  }
  return fn()
}

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
