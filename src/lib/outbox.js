// Persisted queue of Supabase writes. Every shared-mode write joins this
// queue (see sync.js — there is no direct-delivery path around it); items
// are flushed oldest-first and shared UUIDs make retried inserts idempotent.
//
// Two kinds of state live here, held to different rules:
//
// KEY (the canonical queue) and DROPS_KEY are shared across every tab of
// the app, and every mutation of either — with NO exception — happens
// inside withOutboxLock. That is a deliberate, blanket rule rather than a
// per-function argument: this file already had two near-misses from the
// weaker version of that rule ("only ever called from inside the locked
// drain()"). A direct append to KEY predates the lock entirely and was
// never brought under it when the lock was introduced — two tabs could
// each read the queue, build their own version with their own new item,
// and whichever wrote last would silently erase the other tab's write,
// with syncWrite still reporting success. recordDropOutcome (called only
// from inside drain(), so already lock-protected in practice) had a
// sibling, clearDropOutcome, that wrote the same shared JSON blob from
// OUTSIDE the lock — able to race a concurrent recordDropOutcome from
// another tab and clobber a just-landed drop record for a completely
// different write. A single mechanically-checkable rule — touches either
// key, always through the lock — is what actually closes this off.
//
// PENDING_PREFIX entries are the exception, and deliberately unlocked:
// each write goes to a key unique to itself (stageItem), so two tabs can
// never collide over it, and it exists specifically so a write is durable
// the INSTANT it's made — before the lock above is even requested, let
// alone granted. Gating a write's only durable copy behind that lock (as
// an earlier version of this file did) meant closing the app while the
// lock was busy elsewhere — e.g. drain() mid network call, which can take
// seconds — lost the write outright, with nothing left to retry. Getting
// a staged item into the canonical queue (foldPendingItems) still needs
// the lock, same as any other mutation of KEY; only the write that makes
// the data durable doesn't.

import { newId } from './id.js'

const KEY = 'navaya_outbox'
const DROPS_KEY = 'navaya_outbox_drops'
const PENDING_PREFIX = 'navaya_outbox_pending_'
const LOCK_NAME = 'navaya_outbox_drain'
// Distinguishes this tab's own staged items from another tab's when both
// land in the same fold sweep (see foldPendingItems) — never compared
// across page loads, only used as half of a same-sweep tiebreaker.
const TAB_INSTANCE = newId()
let stageSeq = 0
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

// Direct append to the canonical queue — a read-modify-write of the
// SHARED array, so it is only ever safe to call from inside
// withOutboxLock. Production code no longer does: see stageItem below for
// why. Kept as a plain, general-purpose primitive for tests that need to
// seed the queue directly, where there is no real concurrency to protect
// against.
export function enqueue(type, payload) {
  const item = { id: newId(), type, payload, attempts: 0, queuedAt: Date.now() }
  saveOutbox([...getOutbox(), item])
  return item
}

export function outboxSize() {
  return getOutbox().length
}

// Durable the instant this is called — no lock, and none is needed: a
// write to a key unique to this item can never be clobbered by a
// concurrent write from another tab (unlike enqueue()'s shared-array
// append, which is exactly why THAT needs one). This is what makes a
// write survive the app closing even while withOutboxLock is held
// elsewhere for a long time — e.g. drain() mid network call, which can
// legitimately take seconds. Before this existed, syncWrite's enqueue
// step waited on the lock before touching localStorage at all, so a
// write made while that lock was busy elsewhere had nothing durable
// behind it yet; closing the app in that window lost it outright, with
// nothing left in the outbox to retry on the next launch.
export function stageItem(type, payload) {
  const item = {
    id: newId(), type, payload, attempts: 0, queuedAt: Date.now(),
    tab: TAB_INSTANCE, tabSeq: ++stageSeq,
  }
  localStorage.setItem(PENDING_PREFIX + item.id, JSON.stringify(item))
  return item
}

// Moves every currently-staged item into the canonical queue and clears
// its staging key — the other half of stageItem, and the only thing that
// makes a staged item actually deliverable (drain() only ever reads the
// canonical queue). Sweeps ALL pending items, not just one caller's own:
// the common case is that whoever calls this (any syncWrite, any drain
// pass) folds their own item along with any others that landed while the
// lock was busy, in one pass — including anything orphaned by a tab that
// staged a write and then closed before its own fold got a turn, which is
// otherwise recovered by nothing except a later call to this function
// from any tab. A fold with nothing pending is a cheap no-op, so this is
// safe and intended to be called on every drain() pass, not just when a
// new write is known to be staged.
//
// Ordered by (queuedAt, tab, tabSeq) when adding: queuedAt gives a
// reasonable cross-tab order, and the tab+tabSeq tiebreaker guarantees
// two items from the SAME tab caught in the same sweep are never
// misordered by a millisecond-clock collision — same-tab order is the
// only ordering guarantee this file actually depends on (see sync.js's
// header comment: a write that depends on an earlier one — a sleep's
// corrected confirm on its raw stop time — always originates from the
// same device). Deliberately NOT the same counter as sync.js's
// enqueueSeq: that one is coupled to canonical-queue visibility (see the
// drainSeenSeq proof in sync.js) and bumping it at stage time, before the
// item is actually in the queue, would let a drain observe a seq with no
// matching item to find — this counter is scoped to outbox.js and only
// ever used to order a same-sweep tie.
//
// Only ever safe to call from inside withOutboxLock — it mutates the
// shared queue.
export function foldPendingItems() {
  const pendingKeys = []
  // A concurrent stageItem from another tab, landing between two
  // iterations of this scan, can be missed this pass — self-healing, not
  // a correctness issue: the staging tab's own subsequent syncWrite folds
  // shortly after (its key is untouched), and every drain() pass folds
  // unconditionally anyway, so the item converges within one extra pass
  // at worst, never lost.
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key?.startsWith(PENDING_PREFIX)) pendingKeys.push(key)
  }
  if (!pendingKeys.length) return

  const current = getOutbox()
  const currentIds = new Set(current.map(i => i.id))
  // Pending keys are cleared in two different moments, deliberately: a
  // key whose item is already durably in the canonical queue (or was
  // never parseable — nothing recoverable either way) is safe to clear
  // right away. A key whose item is NOT yet in the canonical queue must
  // stay in place until the save below actually succeeds — clearing it
  // first (as an earlier version of this function did) means a failed
  // save (e.g. QuotaExceededError, realistic for a device that's
  // accumulated a large offline backlog) leaves the write in NEITHER
  // place: removed from staging, never landed in the queue. Durable then
  // lost, exactly the failure this whole mechanism exists to prevent.
  const toAdd = []
  for (const key of pendingKeys) {
    let item = null
    try {
      item = JSON.parse(localStorage.getItem(key))
    } catch {
      // Corrupt entry — nothing recoverable, drop it rather than wedge
      // every future fold on the same unparseable key.
      localStorage.removeItem(key)
      continue
    }
    // Defensive, not load-bearing under normal operation: stageItem's
    // ids are always fresh, and folding always clears a pending key in
    // the same pass it adds the item, so a pending key whose id is
    // ALREADY in the canonical queue shouldn't arise in practice. Kept
    // as a cheap guard against ever double-adding, rather than trusting
    // that invariant to hold forever as this file changes. Safe to clear
    // immediately: the item is already durable in the canonical queue.
    if (currentIds.has(item.id)) {
      localStorage.removeItem(key)
      continue
    }
    toAdd.push({ key, item })
  }
  if (!toAdd.length) return

  toAdd.sort((a, b) => {
    if (a.item.queuedAt !== b.item.queuedAt) return a.item.queuedAt - b.item.queuedAt
    if (a.item.tab !== b.item.tab) return a.item.tab < b.item.tab ? -1 : 1
    return a.item.tabSeq - b.item.tabSeq
  })
  // If this throws, every pending key above is still untouched — still
  // durable, still recoverable by the next fold. Only clear them once
  // the canonical queue genuinely has the items.
  saveOutbox([...current, ...toAdd.map(x => x.item)])
  for (const { key } of toAdd) localStorage.removeItem(key)
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
