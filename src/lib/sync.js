// All shared-mode Supabase writes flow through syncWrite. A write is attempted
// immediately; if it fails (offline, server hiccup) it joins the outbox and is
// retried in order on the next flush. Queue order is never bypassed: while
// items are pending, new writes join the back of the queue, so an edit can
// never overtake the insert it depends on.

import {
  insertFeedSession, updateFeedSession, deleteFeedSession,
  insertNappyLog, deleteNappyLog,
  insertMedicineLog, deleteMedicineLog,
} from './db.js'
import { isSupabaseConfigured } from './supabase.js'
import { getOutbox, saveOutbox, enqueue } from './outbox.js'

const MAX_ATTEMPTS = 8

const HANDLERS = {
  'feed.insert':     (p) => insertFeedSession(p),
  'feed.update':     (p) => updateFeedSession(p.id, p),
  'feed.delete':     (p) => deleteFeedSession(p.id),
  'nappy.insert':    (p) => insertNappyLog(p),
  'nappy.delete':    (p) => deleteNappyLog(p.id),
  'medicine.insert': (p) => insertMedicineLog(p),
  'medicine.delete': (p) => deleteMedicineLog(p.id),
}

// Integrity (23xxx) and data (22xxx) errors will never succeed on retry.
// A duplicate key (23505) means a retried insert actually landed the first
// time, so dropping the queued copy is the correct outcome.
function isPermanent(error) {
  const code = String(error?.code || '')
  return code.startsWith('23') || code.startsWith('22')
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

  // Head-of-line: stop at the first transient failure so later writes can
  // never run ahead of an earlier one they may depend on.
  for (;;) {
    const items = getOutbox()
    if (!items.length) break
    const head = items[0]
    const { error } = await attempt(head.type, head.payload)

    if (!error) {
      saveOutbox(getOutbox().slice(1))
      flushed += 1
      continue
    }

    if (isPermanent(error) || (head.attempts || 0) + 1 >= MAX_ATTEMPTS) {
      console.error('Dropping unsyncable change:', head.type, error)
      saveOutbox(getOutbox().slice(1))
      continue
    }

    const current = getOutbox()
    saveOutbox([{ ...current[0], attempts: (current[0].attempts || 0) + 1 }, ...current.slice(1)])
    break
  }

  return { flushed, pending: getOutbox().length }
}

export async function syncWrite(type, payload) {
  await flushOutbox()

  // Something is still queued — keep strict ordering by queueing behind it
  if (getOutbox().length) {
    enqueue(type, payload)
    return { ok: false, queued: true }
  }

  const { error } = await attempt(type, payload)
  if (!error) return { ok: true }

  if (isPermanent(error)) {
    console.error('Write rejected by server:', type, error)
    return { ok: false, queued: false, error }
  }

  enqueue(type, payload)
  return { ok: false, queued: true }
}
