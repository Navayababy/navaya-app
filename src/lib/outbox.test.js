import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { getOutbox, saveOutbox, enqueue, outboxSize, recordDropOutcome, getDropOutcome, clearDropOutcome, withOutboxLock } from './outbox.js'

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
