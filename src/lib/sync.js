// All shared-mode Supabase writes flow through syncWrite, and every write
// joins the outbox: a single-flight drain is the only code that talks to
// the server, so writes always deliver strictly in call order. There is
// deliberately NO fast path that bypasses the queue — two writes racing
// each other over the network (a timer's raw stop time vs the corrected
// confirm that follows it) can land in either order, which is exactly how
// edited times used to get overwritten. A write that cannot deliver yet
// (offline, signed out, server hiccup) simply waits in the queue for the
// next flush; an edit can never overtake the insert it depends on.
//
// syncWrite makes the write durable (via outbox.js's stageItem) before it
// does anything else, deliberately before requesting the lock that joining
// the canonical queue requires — that lock can legitimately be held for
// seconds (drain() mid network call), and gating the only durable copy of
// a write behind it means closing the app during that wait loses the
// write outright.

import {
  insertFeedSession, updateFeedSession, deleteFeedSession,
  insertNappyLog, deleteNappyLog,
  insertMedicineLog, deleteMedicineLog,
  insertSleepLog, updateSleepLog, upsertSleepLog, deleteSleepLog,
} from './db.js'
import { supabase, isSupabaseConfigured } from './supabase.js'
import { getOutbox, saveOutbox, stageItem, foldPendingItems, recordDropOutcome, getDropOutcome, clearDropOutcome, withOutboxLock } from './outbox.js'
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

let inFlight = null

// Every enqueue through syncWrite bumps enqueueSeq; drainSeenSeq is the
// highest enqueue the drain has CONSIDERED — delivered, dropped, or
// determined blocked. Together they answer the one question syncWrite has
// after awaiting a flush that left its item queued: was the item
// considered (genuinely blocked, next flush trigger owns it), or did an
// in-flight pass exit before ever weighing it, so a fresh flush is owed?
//
// What counts as considered follows from FIFO, not from what the drain
// happened to read: a transient head failure — and likewise the offline
// and signed-out gates — blocks every item in the queue at that instant,
// including ones enqueued mid-attempt the drain never laid eyes on. Those
// exits mark the queue considered as of NOW (enqueueSeq). Only the
// empty-queue exit is really about what was read: an item enqueued after
// that final read was never weighed at all, so that exit keeps the
// read-time value and the writer's re-flush picks the item up.
let enqueueSeq = 0
let drainSeenSeq = 0

export function flushOutbox() {
  // Single-flight: concurrent callers await the same drain pass
  if (!inFlight) {
    inFlight = runDrain().finally(() => { inFlight = null })
  }
  return inFlight
}

// The outbox lives in localStorage, shared by every tab of the app — and
// an installed PWA plus a browser tab is a realistic household setup. Two
// tabs draining concurrently can both deliver the same head; the loser's
// duplicate-key rejection then reads as "retried insert already landed"
// and removes whatever item is at the head by then — silently destroying
// an undelivered write. withOutboxLock serialises this against every other
// tab's drain AND every tab's enqueue/drop-outcome access (see outbox.js
// for why that has to be a blanket rule); the in-tab single-flight above
// handles everything else.
function runDrain() {
  return withOutboxLock(() => drain())
}

async function drain() {
  let flushed = 0
  // Recovers anything staged (see syncWrite/stageItem in outbox.js) but
  // never folded into the canonical queue — most commonly because the
  // tab that staged it closed while this lock was held elsewhere. Runs on
  // every pass, not just when this tab knows it staged something itself:
  // a fold with nothing pending is a cheap no-op, and this is the only
  // thing that recovers an orphaned write left by a DIFFERENT tab/session.
  foldPendingItems()
  // Unconfigured builds can never deliver — everything pending counts as
  // considered, like the other blocked exits below.
  if (!isSupabaseConfigured) {
    drainSeenSeq = enqueueSeq
    return { flushed, pending: getOutbox().length }
  }
  // No point attempting while the browser knows it is offline; the 'online'
  // event triggers the next flush. Being offline blocks everything queued,
  // so the whole pending queue counts as considered.
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    drainSeenSeq = enqueueSeq
    return { flushed, pending: getOutbox().length }
  }
  // Same for a signed-out device: RLS rejects everything with a coded error,
  // which would burn the retry cap and drop writes that will succeed the
  // moment the user signs back in (e.g. closing a shared sleep after the
  // session expired mid-nap). Hold the queue; sign-in triggers a flush.
  if (supabase?.auth && getOutbox().length) {
    const { data } = await supabase.auth.getSession()
    if (!data?.session) {
      drainSeenSeq = enqueueSeq
      return { flushed, pending: getOutbox().length }
    }
  }

  // Head-of-line: stop at the first transient failure so later writes can
  // never run ahead of an earlier one they may depend on.
  for (;;) {
    // Captured before the read, so an enqueue racing the read can only make
    // the drain look staler than it was — a false "unseen" costs one spare
    // flush; the reverse would silently strand a write until the next timer.
    const seqBeforeRead = enqueueSeq
    const items = getOutbox()
    if (!items.length) { drainSeenSeq = seqBeforeRead; break }
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
      // Recorded before the removal below, and both are synchronous — see
      // outbox.js for why that ordering is what makes this visible to
      // whichever tab's syncWrite enqueued the item.
      recordDropOutcome(head.id, error)
      saveOutbox(getOutbox().slice(1))
      continue
    }

    if (countsTowardCap(error)) {
      const current = getOutbox()
      saveOutbox([{ ...current[0], attempts: (current[0].attempts || 0) + 1 }, ...current.slice(1)])
    }
    // The failing head blocks the entire queue as of this instant — writes
    // that joined while the attempt was in flight included. Marking only
    // the pre-read sequence here would send those writers into a fresh
    // flush that retries this same head a second time.
    drainSeenSeq = enqueueSeq
    break
  }

  return { flushed, pending: getOutbox().length }
}

// A bare read of a single localStorage key can't tear (each key's value is
// set atomically by a single setItem call), so this needs no lock of its
// own — only the compound read-modify-write operations on KEY/DROPS_KEY
// do. If this happens to observe the item mid-flight (a concurrent
// enqueue or drain elsewhere hasn't committed yet), the caller's while
// loop below simply reads again later; nothing here needs a
// point-in-time-consistent snapshot beyond "is it there right now."
const stillQueued = (item) => getOutbox().some(queued => queued.id === item.id)

export async function syncWrite(type, payload) {
  // Durable the instant this is called, before the lock below is even
  // requested — see stageItem in outbox.js for why that has to be
  // unlocked. This is what stops a slow drain() elsewhere (mid network
  // call, possibly for seconds) from creating a window where the write
  // exists nowhere durable and closing the app loses it outright.
  const staged = stageItem(type, payload)
  // The seq bump and the item's actual arrival in the canonical queue
  // must land atomically with respect to every other tab's fold/drain —
  // otherwise a drain elsewhere could read drainSeenSeq forward of this
  // seq before the item is actually there, and this call's own
  // stillQueued check would then see "not queued" for an item that
  // hasn't landed yet, misreporting a still-pending write as delivered.
  // withOutboxLock makes that one atomic unit, cross-tab. foldPendingItems
  // sweeps every currently-staged item, not just this one — if another
  // tab's fold already picked `staged` up (visible the moment it was
  // staged, regardless of who eventually folds it), this call's own fold
  // finds nothing to do for it and that's fine: `staged` is what this
  // call cares about, not which fold happened to move it.
  const { seq, item } = await withOutboxLock(() => {
    const seq = ++enqueueSeq
    foldPendingItems()
    return { seq, item: staged }
  })
  await flushOutbox()
  // A drain already in flight re-reads the queue between items, so it
  // normally picks this write up — but it may have taken its final look a
  // moment before the enqueue landed. Only in that case is a fresh flush
  // needed to close the gap. When a drain has provably considered the
  // item (drainSeenSeq caught up to this enqueue), delivery is genuinely
  // blocked — offline, signed out, or a failing write ahead — and
  // re-flushing here would retry that failing head a second time per
  // caller, burning its retry cap at double speed for someone else's
  // writes. The next flush trigger owns it instead. A `while`, not an
  // `if`: every fresh drain either delivers the item or advances
  // drainSeenSeq past it, so this settles in at most two passes today —
  // but the loop makes the invariant self-enforcing, so any future edit
  // that breaks that proof degrades to a spare flush, never a stranded
  // write.
  while (stillQueued(item) && drainSeenSeq < seq) await flushOutbox()
  if (stillQueued(item)) return { ok: false, queued: true }

  // The drop record (if any) lives in localStorage precisely because the
  // drain that removed this item may have run in a different tab — see
  // outbox.js. Read-and-clear happens as one locked operation: two
  // separate lock acquisitions here would leave a window where another
  // tab's drain could write a DIFFERENT item's drop record in between,
  // which this call has no business touching but a naively-timed clear
  // could still clobber.
  const error = await withOutboxLock(() => {
    const err = getDropOutcome(item.id)
    if (err) clearDropOutcome(item.id)
    return err
  })
  if (error) return { ok: false, queued: false, error }
  return { ok: true }
}
