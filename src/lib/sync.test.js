import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('./db.js', () => ({
  insertFeedSession: vi.fn(),
  updateFeedSession: vi.fn(),
  deleteFeedSession: vi.fn(),
  insertNappyLog: vi.fn(),
  deleteNappyLog: vi.fn(),
  insertMedicineLog: vi.fn(),
  deleteMedicineLog: vi.fn(),
  insertSleepLog: vi.fn(),
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
