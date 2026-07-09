import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

vi.mock('./db.js', () => ({
  insertFeedSession: vi.fn(),
  updateFeedSession: vi.fn(),
  deleteFeedSession: vi.fn(),
  insertNappyLog: vi.fn(),
  deleteNappyLog: vi.fn(),
  insertMedicineLog: vi.fn(),
  deleteMedicineLog: vi.fn(),
  insertSleepLog: vi.fn(),
  updateSleepLog: vi.fn(),
  upsertSleepLog: vi.fn(),
  deleteSleepLog: vi.fn(),
}))
vi.mock('./supabase.js', () => ({
  isSupabaseConfigured: true,
  supabase: { auth: { getSession: vi.fn() } },
}))

import { insertFeedSession, updateFeedSession, deleteFeedSession } from './db.js'
import { supabase } from './supabase.js'
import { syncWrite, flushOutbox } from './sync.js'
import { getOutbox, outboxSize, enqueue } from './outbox.js'

const ok = () => Promise.resolve({ error: null })
const networkFail = () => Promise.resolve({ error: { message: 'fetch failed' } })
const duplicateKey = () => Promise.resolve({ error: { code: '23505', message: 'duplicate key' } })
const rowNotFound = () => Promise.resolve({ error: { code: 'PGRST116', message: 'no rows returned' } })

beforeEach(() => {
  localStorage.clear()
  vi.clearAllMocks()
  vi.spyOn(console, 'error').mockImplementation(() => {})
  // Signed in by default — individual tests override to simulate sign-out
  supabase.auth.getSession.mockResolvedValue({ data: { session: { user: { id: 'u1' } } } })
})

describe('syncWrite', () => {
  it('delivers directly when the write succeeds', async () => {
    insertFeedSession.mockImplementation(ok)
    const result = await syncWrite('feed.insert', { id: 'a' })
    expect(result.ok).toBe(true)
    expect(insertFeedSession).toHaveBeenCalledWith({ id: 'a' })
    expect(outboxSize()).toBe(0)
  })

  it('queues the write when delivery fails transiently', async () => {
    insertFeedSession.mockImplementation(networkFail)
    const result = await syncWrite('feed.insert', { id: 'a' })
    expect(result).toMatchObject({ ok: false, queued: true })
    expect(outboxSize()).toBe(1)
    expect(getOutbox()[0]).toMatchObject({ type: 'feed.insert', payload: { id: 'a' } })
  })

  it('does not queue permanently rejected writes', async () => {
    insertFeedSession.mockImplementation(duplicateKey)
    const result = await syncWrite('feed.insert', { id: 'a' })
    expect(result).toMatchObject({ ok: false, queued: false })
    expect(outboxSize()).toBe(0)
  })

  it('delivers concurrent writes strictly in call order even when the first is slow', async () => {
    // The raw-stop-time write hangs on a slow network while the user
    // adjusts times and saves: the corrected write must wait behind it,
    // never overtake it and get overwritten.
    const calls = []
    let releaseInsert
    insertFeedSession.mockImplementation((p) => new Promise(resolve => {
      calls.push(['insert', p.id])
      releaseInsert = resolve
    }))
    updateFeedSession.mockImplementation((id) => { calls.push(['update', id]); return ok() })

    const first  = syncWrite('feed.insert', { id: 'a' })
    const second = syncWrite('feed.update', { id: 'a', moodScore: 4 })
    await new Promise(resolve => setTimeout(resolve, 10))
    expect(updateFeedSession).not.toHaveBeenCalled()

    releaseInsert({ error: null })
    const [r1, r2] = await Promise.all([first, second])
    expect(r1).toMatchObject({ ok: true })
    expect(r2).toMatchObject({ ok: true })
    expect(calls).toEqual([['insert', 'a'], ['update', 'a']])
    expect(outboxSize()).toBe(0)
  })

  it('reports a drop to the caller whose write was dropped, not its neighbours', async () => {
    insertFeedSession.mockImplementation(ok)
    deleteFeedSession.mockImplementation(duplicateKey)
    const [insertResult, deleteResult] = await Promise.all([
      syncWrite('feed.insert', { id: 'a' }),
      syncWrite('feed.delete', { id: 'b' }),
    ])
    expect(insertResult).toMatchObject({ ok: true })
    expect(deleteResult).toMatchObject({ ok: false, queued: false })
    expect(deleteResult.error).toMatchObject({ code: '23505' })
    expect(outboxSize()).toBe(0)
  })

  it('spends at most one retry of a failing head per syncWrite call', async () => {
    // A write queued behind a failing head must not have its own flush
    // retry that head a second time — unrelated callers would otherwise
    // burn the head's retry cap at double speed.
    updateFeedSession.mockImplementation(rowNotFound)
    enqueue('feed.update', { id: 'a', moodScore: 4 })
    insertFeedSession.mockImplementation(ok)

    const result = await syncWrite('feed.insert', { id: 'b' })
    expect(result).toMatchObject({ ok: false, queued: true })
    expect(updateFeedSession).toHaveBeenCalledTimes(1)
    expect(getOutbox()[0].attempts).toBe(1)
    expect(insertFeedSession).not.toHaveBeenCalled()
  })

  it('does not retry a failing head for a write that joined mid-attempt', async () => {
    // The head's attempt is already in flight when the new write enqueues.
    // The head's failure blocks the whole queue as of that instant, so the
    // new writer must not launch a fresh flush that retries the head again.
    let failHead
    updateFeedSession.mockImplementation(() => new Promise(resolve => { failHead = resolve }))
    enqueue('feed.update', { id: 'a', moodScore: 4 })
    const headFlush = flushOutbox()
    await new Promise(resolve => setTimeout(resolve, 0))

    insertFeedSession.mockImplementation(ok)
    const writePromise = syncWrite('feed.insert', { id: 'b' })
    await new Promise(resolve => setTimeout(resolve, 0))
    failHead({ error: { code: 'PGRST116', message: 'no rows returned' } })

    await headFlush
    expect(await writePromise).toMatchObject({ ok: false, queued: true })
    expect(updateFeedSession).toHaveBeenCalledTimes(1)
    expect(getOutbox().map(i => i.type)).toEqual(['feed.update', 'feed.insert'])
    expect(getOutbox()[0].attempts).toBe(1)
  })

  it('holds a signed-out write after a single session check, with no second pass', async () => {
    // The signed-out gate blocks the whole queue, so the writer must not
    // launch a second drain (and second getSession) to learn that.
    supabase.auth.getSession.mockResolvedValue({ data: { session: null } })
    updateFeedSession.mockImplementation(ok)
    const result = await syncWrite('feed.update', { id: 'a', moodScore: 4 })
    expect(result).toMatchObject({ ok: false, queued: true })
    expect(supabase.auth.getSession).toHaveBeenCalledTimes(1)
    expect(updateFeedSession).not.toHaveBeenCalled()
  })

  it('serialises drains across tabs via the Web Locks API when available', async () => {
    // jsdom has no navigator.locks — install a stub to prove drains route
    // through the cross-tab lock when the browser provides one.
    const request = vi.fn((_name, run) => run())
    navigator.locks = { request }
    try {
      insertFeedSession.mockImplementation(ok)
      const result = await syncWrite('feed.insert', { id: 'a' })
      expect(result).toMatchObject({ ok: true })
      expect(request).toHaveBeenCalledWith('navaya_outbox_drain', expect.any(Function))
    } finally {
      delete navigator.locks
    }
  })

  it('queues behind pending items so order is preserved', async () => {
    insertFeedSession.mockImplementation(networkFail)
    await syncWrite('feed.insert', { id: 'a' })

    // Still offline: the dependent update must not jump the queue
    updateFeedSession.mockImplementation(ok)
    const result = await syncWrite('feed.update', { id: 'a', moodScore: 4 })
    expect(result).toMatchObject({ ok: false, queued: true })
    expect(updateFeedSession).not.toHaveBeenCalled()
    expect(getOutbox().map(i => i.type)).toEqual(['feed.insert', 'feed.update'])
  })
})

describe('flushOutbox', () => {
  it('drains queued items in order once delivery succeeds', async () => {
    const calls = []
    insertFeedSession.mockImplementation((p) => { calls.push(['insert', p.id]); return ok() })
    updateFeedSession.mockImplementation((id) => { calls.push(['update', id]); return ok() })
    enqueue('feed.insert', { id: 'a' })
    enqueue('feed.update', { id: 'a', moodScore: 4 })

    const result = await flushOutbox()
    expect(result).toMatchObject({ flushed: 2, pending: 0 })
    expect(calls).toEqual([['insert', 'a'], ['update', 'a']])
  })

  it('passes bottle-feed fields through the outbox untouched', async () => {
    updateFeedSession.mockImplementation(ok)
    const payload = { id: 'b', feedType: 'bottle', side: null, amountMl: 120, milkType: 'formula', moodScore: null }
    enqueue('feed.update', payload)

    await flushOutbox()
    expect(updateFeedSession).toHaveBeenCalledWith('b', expect.objectContaining(payload))
  })

  it('still flushes legacy payloads queued before bottle feeds existed', async () => {
    updateFeedSession.mockImplementation(ok)
    enqueue('feed.update', { id: 'a', side: 'L', moodScore: 3 })

    const result = await flushOutbox()
    expect(result).toMatchObject({ flushed: 1, pending: 0 })
    const args = updateFeedSession.mock.calls[0][1]
    expect('feedType' in args).toBe(false)
  })

  it('stops at the first failure so later writes cannot run ahead', async () => {
    insertFeedSession.mockImplementation(networkFail)
    deleteFeedSession.mockImplementation(ok)
    enqueue('feed.insert', { id: 'a' })
    enqueue('feed.delete', { id: 'b' })

    const result = await flushOutbox()
    expect(result).toMatchObject({ flushed: 0, pending: 2 })
    expect(deleteFeedSession).not.toHaveBeenCalled()
  })

  it('never drops connectivity failures, however often they retry', async () => {
    insertFeedSession.mockImplementation(networkFail)
    enqueue('feed.insert', { id: 'a' })

    // A device offline for a long stretch sees many scheduled drains
    for (let i = 0; i < 30; i++) await flushOutbox()
    expect(outboxSize()).toBe(1)
    expect(getOutbox()[0].attempts).toBe(0)

    // Connectivity returns — the write is still there and now delivers
    insertFeedSession.mockImplementation(ok)
    const result = await flushOutbox()
    expect(result).toMatchObject({ flushed: 1, pending: 0 })
  })

  it('counts attempts only for coded server errors', async () => {
    updateFeedSession.mockImplementation(rowNotFound)
    enqueue('feed.update', { id: 'a', moodScore: 4 })

    await flushOutbox()
    expect(getOutbox()[0].attempts).toBe(1)
  })

  it('drops items that fail permanently and continues with the rest', async () => {
    insertFeedSession.mockImplementation(duplicateKey)
    deleteFeedSession.mockImplementation(ok)
    enqueue('feed.insert', { id: 'a' })
    enqueue('feed.delete', { id: 'b' })

    const result = await flushOutbox()
    expect(result).toMatchObject({ flushed: 1, pending: 0 })
    expect(deleteFeedSession).toHaveBeenCalled()
  })

  it('gives up on a coded server error after the maximum retry attempts', async () => {
    updateFeedSession.mockImplementation(rowNotFound)
    enqueue('feed.update', { id: 'a', moodScore: 4 })

    for (let i = 0; i < 7; i++) await flushOutbox()
    expect(outboxSize()).toBe(1)
    await flushOutbox()
    expect(outboxSize()).toBe(0)
  })

  it('holds the queue while signed out instead of burning retries', async () => {
    // Signed out, RLS would reject every attempt with a coded error — the
    // queue must wait rather than count those toward the retry cap.
    supabase.auth.getSession.mockResolvedValue({ data: { session: null } })
    updateFeedSession.mockImplementation(rowNotFound)
    enqueue('feed.update', { id: 'a', moodScore: 4 })

    for (let i = 0; i < 30; i++) await flushOutbox()
    expect(outboxSize()).toBe(1)
    expect(getOutbox()[0].attempts || 0).toBe(0)
    expect(updateFeedSession).not.toHaveBeenCalled()

    // Signing back in delivers the held write
    supabase.auth.getSession.mockResolvedValue({ data: { session: { user: { id: 'u1' } } } })
    updateFeedSession.mockImplementation(ok)
    const result = await flushOutbox()
    expect(result).toMatchObject({ flushed: 1, pending: 0 })
  })

  it('treats thrown errors (no network) as transient', async () => {
    insertFeedSession.mockImplementation(() => Promise.reject(new TypeError('Failed to fetch')))
    enqueue('feed.insert', { id: 'a' })

    const result = await flushOutbox()
    expect(result).toMatchObject({ flushed: 0, pending: 1 })
  })
})

// Two tabs of the app are two separate JS realms — each gets its own copy
// of sync.js's module state (enqueueSeq, inFlight, and formerly the
// in-memory dropOutcomes map) but they share the SAME localStorage. The
// most faithful in-process simulation of that is two independent module
// instances loaded via vi.resetModules(), sharing only the jsdom
// localStorage global — exactly mirroring what two real tabs share.
//
// A genuine mutual-exclusion lock is essential here, not a formality:
// without one, both realms' own unlocked drains race the shared queue
// independently and can BOTH attempt the same item (the exact defect the
// real navigator.locks integration exists to prevent) — which would make
// these tests fail for the wrong reason and prove nothing about outcome
// reporting specifically.
function fakeExclusiveLock() {
  let tail = Promise.resolve()
  return {
    request: (_name, cb) => {
      const run = tail.then(cb)
      tail = run.catch(() => {})
      return run
    },
  }
}

describe('cross-tab outcome visibility', () => {
  afterEach(() => { delete navigator.locks })

  // db.js (the network layer) is intercepted once for the whole test file
  // by vi.mock — both simulated tabs share the same insertFeedSession spy,
  // which matches reality: it's sync.js's own module state (enqueueSeq,
  // drainSeenSeq, inFlight) that's genuinely per-tab, not the network
  // client. Two fresh sync.js instances is therefore the right amount of
  // "two tabs" to simulate; a shared call count is how we confirm only
  // one of them ever actually attempted delivery for a given item.
  //
  // enqueue() is now itself lock-protected (see outbox.js), so Tab B's
  // item genuinely cannot exist in the shared queue until Tab B's own
  // enqueue has been granted the lock and released it — Tab A can no
  // longer "catch" Tab B's write mid-attempt the way it could when only
  // drain() held the lock. The scenario that DOES still happen in
  // production, and is worth proving correct, is narrower but real: Tab
  // B's write lands, then — before Tab B's own post-enqueue flush gets
  // the lock back — something in Tab A (its periodic timer, another of
  // Tab A's own writes) wins the next lock acquisition and processes it
  // first. A manual gate makes that ordering deterministic instead of
  // racing real microtask timing: everything queues up behind the gate in
  // a known order, so releasing it plays out exactly this scenario.
  it('reports a drop performed by another tab, not a false delivery', async () => {
    const lock = fakeExclusiveLock()
    navigator.locks = lock

    vi.resetModules()
    const tabA = await import('./sync.js')
    insertFeedSession.mockImplementation(duplicateKey)

    vi.resetModules()
    const tabB = await import('./sync.js')

    let releaseGate
    const gate = new Promise(resolve => { releaseGate = resolve })
    const gateHeld = lock.request('gate', () => gate)

    // Tab B's enqueue queues behind the gate.
    const bWrite = tabB.syncWrite('feed.insert', { id: 'x' })
    // Tab A's flush queues behind Tab B's enqueue — registered now, before
    // Tab B's own post-enqueue flush exists, so it wins the lock the
    // moment the gate opens and Tab B's enqueue clears.
    const aFlush = tabA.flushOutbox()

    releaseGate()
    await gateHeld
    await aFlush

    const result = await bWrite
    expect(result).toMatchObject({ ok: false, queued: false })
    expect(result.error).toMatchObject({ code: '23505' })
    expect(insertFeedSession).toHaveBeenCalledTimes(1)
  })

  it('reports a delivery performed by another tab as ok, not stuck queued', async () => {
    const lock = fakeExclusiveLock()
    navigator.locks = lock

    vi.resetModules()
    const tabA = await import('./sync.js')
    insertFeedSession.mockImplementation(ok)

    vi.resetModules()
    const tabB = await import('./sync.js')

    let releaseGate
    const gate = new Promise(resolve => { releaseGate = resolve })
    const gateHeld = lock.request('gate', () => gate)

    const bWrite = tabB.syncWrite('feed.insert', { id: 'y' })
    const aFlush = tabA.flushOutbox()

    releaseGate()
    await gateHeld
    await aFlush

    const result = await bWrite
    expect(result).toMatchObject({ ok: true })
    expect(insertFeedSession).toHaveBeenCalledTimes(1)
  })

  // The bug this whole PR fixes: enqueue() predated the lock and two tabs
  // could each read the queue, build their own version with their own new
  // item, and whichever committed last would silently erase the other's
  // write — with the erased write's own syncWrite still reporting
  // { ok: true }, since nothing ever recorded it as dropped (there was
  // nothing TO drop; it just never existed).
  //
  // That race needs genuine OS-level thread interleaving to manifest —
  // two real tabs each running their own fully-synchronous
  // read-then-write with no yield point in between, interleaved at a
  // granularity no single-threaded test runner can force. A test that
  // tries to "simulate" it by calling two enqueues back to back proves
  // nothing either way: without a lock, the first call's synchronous
  // read+write completes entirely before the second call is even made,
  // so nothing can race in this process regardless of whether the source
  // has a lock — confirmed by deliberately reverting the fix locally and
  // watching the naive version of this test keep passing. What IS
  // mechanically provable, and is what actually prevents the race in a
  // real multi-tab browser: syncWrite's enqueue step unconditionally
  // acquires the shared cross-tab lock before touching the queue, for
  // every write, with no path around it. That is asserted directly below.
  it('does not commit to the shared queue until the cross-tab lock is granted', async () => {
    // navigator.locks.request() is never synchronous — even an
    // immediately-grantable lock defers its callback by at least one
    // microtask, in every real implementation and per spec. So if
    // syncWrite's enqueue step is genuinely gated behind it, the item
    // cannot yet be visible in the shared queue in the same synchronous
    // stretch of code that calls syncWrite — only once that call is
    // awaited. (Checking "was navigator.locks.request called at all"
    // doesn't discriminate here: flushOutbox's own drain() always
    // acquires the lock regardless of whether enqueue does, so a naive
    // call-count assertion passes whether or not the fix is present —
    // confirmed by deliberately reverting locally. Checking queue
    // visibility at this exact synchronous point is what actually
    // distinguishes the two.)
    navigator.locks = { request: (_name, cb) => Promise.resolve().then(cb) }

    vi.resetModules()
    const tab = await import('./sync.js')
    insertFeedSession.mockImplementation(ok)

    const writePromise = tab.syncWrite('feed.insert', { id: 'a' })
    expect(getOutbox()).toEqual([])

    await writePromise
    expect(getOutbox()).toEqual([]) // delivered and removed, not stranded
  })

  // The gate technique still has real value once the lock is confirmed
  // present: it proves that when the lock IS engaged (as the test above
  // shows it always is), two writers queued behind it both survive —
  // i.e. the lock's serialisation, once acquired, is actually sufficient
  // to prevent the clobber, not merely present.
  it('delivers both writes when two tabs\' enqueues are serialised by the lock', async () => {
    const lock = fakeExclusiveLock()
    navigator.locks = lock

    vi.resetModules()
    const tabA = await import('./sync.js')
    insertFeedSession.mockImplementation(ok)

    vi.resetModules()
    const tabB = await import('./sync.js')

    let releaseGate
    const gate = new Promise(resolve => { releaseGate = resolve })
    const gateHeld = lock.request('gate', () => gate)

    const aWrite = tabA.syncWrite('feed.insert', { id: 'a' })
    const bWrite = tabB.syncWrite('feed.insert', { id: 'b' })

    releaseGate()
    await gateHeld
    await Promise.all([aWrite, bWrite])

    expect(insertFeedSession).toHaveBeenCalledTimes(2)
    const deliveredIds = insertFeedSession.mock.calls.map(([p]) => p.id).sort()
    expect(deliveredIds).toEqual(['a', 'b'])
  })
})
