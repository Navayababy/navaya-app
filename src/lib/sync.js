// All shared-mode Supabase writes flow through syncWrite, and every write
// joins the outbox: a single-flight drain is the only code that talks to
// the server, so writes always deliver strictly in call order. There is
// deliberately NO fast path that bypasses the queue — two writes racing
// each other over the network (a timer's raw stop time vs the corrected
// confirm that follows it) can land in either order, which is exactly how
// edited times used to get overwritten. A write that cannot deliver yet
// (offline, signed out, server hiccup) simply waits in the queue for the
// next flush; an edit can never overtake the insert it depends on.

import {
  insertFeedSession, updateFeedSession, deleteFeedSession,
  insertNappyLog, deleteNappyLog,
  insertMedicineLog, deleteMedicineLog,
  insertSleepLog, updateSleepLog, upsertSleepLog, deleteSleepLog,
} from './db.js'
import { supabase, isSupabaseConfigured } from './supabase.js'
import { getOutbox, saveOutbox, enqueue } from './outbox.js'
import { logError } from './logError.js'

const MAX_ATTEMPTS = 8

const HANDLERS = {
  'feed.insert':     (p) => insertFeedSession(p),
  'feed.update':     (p) => updateFeedSession(p.id, p),
  'feed.delete':     (p) => deleteFeedSession(p.id),
  'nappy.insert':    (p) => insertNappyLog(p),
  'nappy.delete':    (p) => deleteNappyLog(p.id),
  'medicine.insert': (p) => insertMedicineLog(p),
  'medicine.delete': (p) => deleteMedicineLog(p.id),
  'sleep.insert':    (p) => insertSleepLog(p),
  'sleep.update':    (p) => updateSleepLog(p.id, p),
  'sleep.upsert':    (p) => upsertSleepLog(p),
  'sleep.delete':    (p) => deleteSleepLog(p.id),
}

// Integrity (23xxx) and data (22xxx) errors will never succeed on retry.
// A duplicate key (23505) means a retried insert actually landed the first
// time, so dropping the queued copy is the correct outcome.
function isPermanent(error) {
  const code = String(error?.code || '')
  return code.startsWith('23') || code.startsWith('22')
}

// Connectivity failures (offline, DNS, timeouts) surface without a
// Postgres/PostgREST error code. They must never count toward the retry cap —
// the device may simply be offline for hours, which is the exact situation
// the outbox exists for. Only coded server errors (e.g. row-not-found racing
// an unflushed insert) are capped, since those can otherwise loop forever.
function countsTowardCap(error) {
  return Boolean(String(error?.code || '').trim())
}

async function attempt(type, payload) {
  const handler = HANDLERS[type]
  if (!handler) return { error: { message: `Unknown sync type: ${type}`, code: '22000' } }
  try {
    const { error } = await handler(payload)
    return { error: error || null }
  } catch (err) {
    return { error: err }
  }
}

// Errors for items the drain dropped (permanent rejection or retry cap),
// keyed by queue id, so the syncWrite awaiting that flush can report
// { queued: false } with the cause instead of mistaking the drop for a
// delivery. Each writer reads its entry once; entries nobody awaits
// (drops during timer flushes) are cleared wholesale at a safety bound.
const dropOutcomes = new Map()

function recordDrop(item, error) {
  if (!item.id) return
  if (dropOutcomes.size > 100) dropOutcomes.clear()
  dropOutcomes.set(item.id, error)
}

let inFlight = null

// Every enqueue through syncWrite bumps enqueueSeq; the drain records the
// value it saw at its most recent read of a queue it was willing to
// process. Together they answer the one question syncWrite has after
// awaiting a flush that left its item queued: did that drain ever consider
// the item (genuinely blocked — offline, signed out, failing write ahead),
// or was it an in-flight pass that took its final look a moment before the
// enqueue landed and must be re-run?
let enqueueSeq = 0
let drainSeenSeq = 0

export function flushOutbox() {
  // Single-flight: concurrent callers await the same drain pass
  if (!inFlight) {
    inFlight = drain().finally(() => { inFlight = null })
  }
  return inFlight
}

async function drain() {
  let flushed = 0
  if (!isSupabaseConfigured) return { flushed, pending: getOutbox().length }
  // No point attempting while the browser knows it is offline; the 'online'
  // event triggers the next flush.
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return { flushed, pending: getOutbox().length }
  }
  // Same for a signed-out device: RLS rejects everything with a coded error,
  // which would burn the retry cap and drop writes that will succeed the
  // moment the user signs back in (e.g. closing a shared sleep after the
  // session expired mid-nap). Hold the queue; sign-in triggers a flush.
  if (supabase?.auth && getOutbox().length) {
    const { data } = await supabase.auth.getSession()
    if (!data?.session) return { flushed, pending: getOutbox().length }
  }

  // Head-of-line: stop at the first transient failure so later writes can
  // never run ahead of an earlier one they may depend on.
  for (;;) {
    // Captured before the read, so an enqueue racing the read can only make
    // the drain look staler than it was — a false "unseen" costs one spare
    // flush; the reverse would silently strand a write until the next timer.
    const seenSeq = enqueueSeq
    const items = getOutbox()
    if (!items.length) { drainSeenSeq = seenSeq; break }
    const head = items[0]
    const { error } = await attempt(head.type, head.payload)

    if (!error) {
      saveOutbox(getOutbox().slice(1))
      flushed += 1
      continue
    }

    if (isPermanent(error) || (countsTowardCap(error) && (head.attempts || 0) + 1 >= MAX_ATTEMPTS)) {
      console.error('Dropping unsyncable change:', head.type, error)
      logError(`sync.drop:${head.type}`, error)
      recordDrop(head, error)
      saveOutbox(getOutbox().slice(1))
      continue
    }

    if (countsTowardCap(error)) {
      const current = getOutbox()
      saveOutbox([{ ...current[0], attempts: (current[0].attempts || 0) + 1 }, ...current.slice(1)])
    }
    drainSeenSeq = seenSeq
    break
  }

  return { flushed, pending: getOutbox().length }
}

const stillQueued = (item) => getOutbox().some(queued => queued.id === item.id)

export async function syncWrite(type, payload) {
  const seq = ++enqueueSeq
  const item = enqueue(type, payload)
  await flushOutbox()
  // A drain already in flight re-reads the queue between items, so it
  // normally picks this write up — but it may have taken its final look a
  // moment before the enqueue landed. Only in that case is one fresh
  // flush needed to close the gap. When the drain provably saw the item
  // (drainSeenSeq caught up to this enqueue), delivery is genuinely
  // blocked — offline, signed out, or a failing write ahead — and
  // re-flushing here would retry that failing head a second time per
  // caller, burning its retry cap at double speed for someone else's
  // writes. The next flush trigger owns it instead.
  if (stillQueued(item) && drainSeenSeq < seq) await flushOutbox()
  if (stillQueued(item)) return { ok: false, queued: true }

  if (dropOutcomes.has(item.id)) {
    const error = dropOutcomes.get(item.id)
    dropOutcomes.delete(item.id)
    return { ok: false, queued: false, error }
  }
  return { ok: true }
}
