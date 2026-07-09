import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { getOutbox, saveOutbox, enqueue, outboxSize, recordDropOutcome, getDropOutcome, clearDropOutcome, withOutboxLock, stageItem, foldPendingItems } from './outbox.js'

beforeEach(() => localStorage.clear())

describe('outbox', () => {
  it('starts empty and returns [] on corrupt JSON', () => {
    expect(getOutbox()).toEqual([])
    localStorage.setItem('navaya_outbox', '{bad')
    expect(getOutbox()).toEqual([])
  })

  it('enqueues in order with attempt metadata and a queue id', () => {
    const first = enqueue('feed.insert', { id: 'a' })
    enqueue('feed.delete', { id: 'b' })
    const items = getOutbox()
    expect(items.map(i => i.type)).toEqual(['feed.insert', 'feed.delete'])
    expect(items[0]).toMatchObject({ payload: { id: 'a' }, attempts: 0 })
    expect(items[0].queuedAt).toBeTypeOf('number')
    expect(items[0].id).toBe(first.id)
    expect(items[0].id).not.toBe(items[1].id)
    expect(outboxSize()).toBe(2)
  })

  it('saveOutbox replaces the queue', () => {
    enqueue('feed.insert', { id: 'a' })
    saveOutbox([])
    expect(outboxSize()).toBe(0)
  })
})

// This store is what makes a dropped write's reason visible to whichever
// tab enqueued it, even when a *different* tab's drain performed the drop
// (see sync.js's runDrain). It has no module-level state of its own —
// everything lives in localStorage, the one thing every tab actually
// shares — so, unlike a plain in-memory map, it needs no simulated
// "other tab" to prove durability: a fresh read after any write already
// demonstrates it.
describe('drop outcomes', () => {
  it('round-trips an outcome and clears it on read', () => {
    expect(getDropOutcome('a')).toBeNull()
    recordDropOutcome('a', { code: '23505', message: 'duplicate key' })
    expect(getDropOutcome('a')).toMatchObject({ code: '23505' })
    clearDropOutcome('a')
    expect(getDropOutcome('a')).toBeNull()
  })

  it('keeps entries for distinct ids independent', () => {
    recordDropOutcome('a', { code: '23505' })
    recordDropOutcome('b', { code: '22000' })
    clearDropOutcome('a')
    expect(getDropOutcome('a')).toBeNull()
    expect(getDropOutcome('b')).toMatchObject({ code: '22000' })
  })

  it('is plain localStorage, not per-module state — a fresh read sees a prior write', () => {
    recordDropOutcome('a', { code: '23505', message: 'duplicate key' })
    // Read via a completely fresh parse of the same key, bypassing any
    // in-memory cache this module might otherwise have kept.
    const raw = JSON.parse(localStorage.getItem('navaya_outbox_drops'))
    expect(raw.a.error).toMatchObject({ code: '23505' })
  })

  it('prunes entries older than the TTL so an unread drop cannot grow the store forever', () => {
    vi.useFakeTimers()
    try {
      recordDropOutcome('old', { code: '23505' })
      vi.advanceTimersByTime(11 * 60 * 1000)
      recordDropOutcome('new', { code: '22000' })
      expect(getDropOutcome('old')).toBeNull()
      expect(getDropOutcome('new')).toMatchObject({ code: '22000' })
    } finally {
      vi.useRealTimers()
    }
  })

  it('never prunes an entry a live caller is still about to read', () => {
    // A real caller reads its own entry within milliseconds of the drop —
    // nothing recorded seconds ago should ever be at risk from the TTL
    // sweep triggered by an unrelated concurrent drop.
    vi.useFakeTimers()
    try {
      recordDropOutcome('mine', { code: '23505' })
      vi.advanceTimersByTime(2000)
      recordDropOutcome('someone-elses', { code: '22000' })
      expect(getDropOutcome('mine')).toMatchObject({ code: '23505' })
    } finally {
      vi.useRealTimers()
    }
  })
})

// stageItem is the durability fix: a write recorded here survives even if
// the caller never gets to fold it into the canonical queue (e.g. the app
// closes while withOutboxLock is held elsewhere for a long time — see
// sync.js). foldPendingItems is the recovery half, and is what makes
// staging actually deliverable, since drain() only ever reads the
// canonical queue.
describe('stageItem / foldPendingItems', () => {
  it('is durable immediately, independent of ever being folded', () => {
    const item = stageItem('feed.insert', { id: 'a' })
    // Nothing has folded it yet — the canonical queue doesn't have it...
    expect(getOutbox()).toEqual([])
    // ...but it already exists somewhere durable, keyed by its own id, so
    // it isn't lost even if nothing ever folds it in this session.
    const raw = localStorage.getItem(`navaya_outbox_pending_${item.id}`)
    expect(JSON.parse(raw)).toMatchObject({ type: 'feed.insert', payload: { id: 'a' } })
  })

  it('folds a staged item into the canonical queue and clears its staging key', () => {
    const item = stageItem('feed.insert', { id: 'a' })
    foldPendingItems()
    expect(getOutbox()).toMatchObject([{ id: item.id, type: 'feed.insert', payload: { id: 'a' } }])
    expect(localStorage.getItem(`navaya_outbox_pending_${item.id}`)).toBeNull()
  })

  it('is a no-op with nothing staged', () => {
    foldPendingItems()
    expect(getOutbox()).toEqual([])
  })

  it('skips an item that already exists in the canonical queue', () => {
    // Simulates a concurrent fold (from another tab) having already
    // picked this item up before this call's own fold runs.
    const item = stageItem('feed.insert', { id: 'a' })
    saveOutbox([{ ...item }])
    foldPendingItems()
    expect(getOutbox()).toHaveLength(1) // not duplicated
    expect(localStorage.getItem(`navaya_outbox_pending_${item.id}`)).toBeNull() // still cleaned up
  })

  it('drops an unparseable staged entry rather than wedging every future fold on it', () => {
    localStorage.setItem('navaya_outbox_pending_bad', '{not json')
    foldPendingItems()
    expect(getOutbox()).toEqual([])
    expect(localStorage.getItem('navaya_outbox_pending_bad')).toBeNull()
  })

  it('orders same-millisecond items from the SAME tab correctly, never by chance', () => {
    // Same queuedAt forces the fold to fall through to the tab+tabSeq
    // tiebreaker — without it, two rapid same-tab writes (e.g. a sleep's
    // raw stop time immediately followed by its corrected confirm) could
    // fold in the wrong relative order purely from clock resolution.
    vi.useFakeTimers()
    try {
      const first = stageItem('feed.insert', { id: 'first' })
      const second = stageItem('feed.update', { id: 'second' })
      expect(first.queuedAt).toBe(second.queuedAt) // same fake-timer instant
      expect(first.tab).toBe(second.tab) // same module instance = same tab
      foldPendingItems()
      expect(getOutbox().map(i => i.payload.id)).toEqual(['first', 'second'])
    } finally {
      vi.useRealTimers()
    }
  })

  it('appends staged items after whatever is already in the canonical queue', () => {
    enqueue('feed.insert', { id: 'existing' })
    stageItem('feed.insert', { id: 'new' })
    foldPendingItems()
    expect(getOutbox().map(i => i.payload.id)).toEqual(['existing', 'new'])
  })
})

describe('withOutboxLock', () => {
  afterEach(() => { delete navigator.locks })

  it('routes through navigator.locks under the shared lock name when available', async () => {
    const request = vi.fn((_name, cb) => Promise.resolve().then(cb))
    navigator.locks = { request }

    const result = await withOutboxLock(() => 'result')
    expect(result).toBe('result')
    expect(request).toHaveBeenCalledWith('navaya_outbox_drain', expect.any(Function))
  })

  it('falls back to calling fn directly when the Web Locks API is unavailable', async () => {
    delete navigator.locks
    const result = await withOutboxLock(() => 'result')
    expect(result).toBe('result')
  })

  it('propagates a rejection from fn without leaving the lock permanently held', async () => {
    const request = vi.fn((_name, cb) => Promise.resolve().then(cb))
    navigator.locks = { request }

    await expect(withOutboxLock(() => { throw new Error('boom') })).rejects.toThrow('boom')
    // A second acquisition must still succeed — the failed callback must
    // not have wedged the (fake) lock for subsequent callers.
    await expect(withOutboxLock(() => 'ok')).resolves.toBe('ok')
  })
})
