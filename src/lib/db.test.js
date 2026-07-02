import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('./supabase.js', () => ({
  isSupabaseConfigured: true,
  supabase: { from: vi.fn() },
}))

import { supabase } from './supabase.js'
import { migrateLocalNappies, migrateLocalSessions } from './db.js'

const UUID  = '123e4567-e89b-42d3-a456-426614174000'
const UUID2 = '223e4567-e89b-42d3-a456-426614174000'
const ISO   = '2026-01-01T10:00:00.000Z'
const ISO2  = '2026-01-02T10:00:00.000Z'
// Supabase surfaces RLS/constraint rejections as a returned error object,
// never as a thrown exception — the exact case the migration must not
// mistake for success.
const rlsError = { code: '42501', message: 'permission denied' }

// Mock table handle covering both queries a migrate function makes: the
// existing-rows content fetch (select→eq→eq→order→limit) and the upload
// (upsert / insert).
const mockTable = ({ existing = [], selectError = null, upsertError = null, insertError = null } = {}) => {
  const upsert = vi.fn().mockResolvedValue({ error: upsertError })
  const insert = vi.fn().mockResolvedValue({ error: insertError })
  const limit  = vi.fn().mockResolvedValue(selectError ? { data: null, error: selectError } : { data: existing, error: null })
  const select = vi.fn().mockReturnValue({
    eq: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        order: vi.fn().mockReturnValue({ limit }),
      }),
    }),
  })
  supabase.from.mockReturnValue({ select, upsert, insert })
  return { upsert, insert, select }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('migration batch error handling', () => {
  it('rejects when an upsert batch (UUID rows) returns an error', async () => {
    mockTable({ upsertError: rlsError })
    await expect(migrateLocalNappies('h1', 'u1', [{ id: UUID, type: 'wet', loggedAt: ISO }]))
      .rejects.toMatchObject({ code: '42501' })
  })

  it('rejects when a legacy-row insert batch returns an error', async () => {
    mockTable({ insertError: rlsError })
    // Non-UUID id → mapped to null → takes the plain-insert path
    await expect(migrateLocalNappies('h1', 'u1', [{ id: 'legacy-1', type: 'wet', loggedAt: ISO }]))
      .rejects.toMatchObject({ code: '42501' })
  })

  it('rejects when the existing-rows fetch fails, so the flag is never set on a blind attempt', async () => {
    const { upsert, insert } = mockTable({ selectError: { message: 'boom' } })
    await expect(migrateLocalSessions('h1', 'u1', [{ id: UUID, startedAt: ISO, endedAt: ISO2, durationSecs: 60, side: 'L' }]))
      .rejects.toMatchObject({ message: 'boom' })
    expect(upsert).not.toHaveBeenCalled()
    expect(insert).not.toHaveBeenCalled()
  })

  it('resolves when every batch succeeds', async () => {
    const { upsert, insert } = mockTable()
    await expect(migrateLocalSessions('h1', 'u1', [
      { id: UUID,     startedAt: ISO,  endedAt: ISO,  durationSecs: 60, side: 'L' },
      { id: 'legacy', startedAt: ISO2, endedAt: ISO2, durationSecs: 60, side: 'R' },
    ])).resolves.toBeUndefined()
    expect(upsert).toHaveBeenCalledTimes(1)
    expect(insert).toHaveBeenCalledTimes(1)
  })
})

// Rows uploaded by pre-UUID migrations exist on the server under generated
// ids the local copies don't carry, so id-based upserts can't dedupe them.
// The content check must recognise them by timestamps and skip them, while
// never suppressing rows that are genuinely missing.
describe('migration content dedupe', () => {
  it('skips rows whose content already exists on the server, across timestamp formats', async () => {
    const { upsert, insert } = mockTable({
      // Postgres-style '+00:00' offset for the same instants as the local Z strings
      existing: [{ started_at: '2026-01-01T10:00:00+00:00', ended_at: '2026-01-01T10:15:00+00:00', side: 'L' }],
    })
    await migrateLocalSessions('h1', 'u1', [
      { id: UUID, startedAt: '2026-01-01T10:00:00.000Z', endedAt: '2026-01-01T10:15:00.000Z', durationSecs: 900, side: 'L' },
    ])
    expect(upsert).not.toHaveBeenCalled()
    expect(insert).not.toHaveBeenCalled()
  })

  it('uploads only the rows that are missing from the server', async () => {
    const { upsert } = mockTable({
      existing: [{ started_at: ISO, ended_at: ISO, side: 'L' }],
    })
    await migrateLocalSessions('h1', 'u1', [
      { id: UUID,  startedAt: ISO,  endedAt: ISO,  durationSecs: 60, side: 'L' },
      { id: UUID2, startedAt: ISO2, endedAt: ISO2, durationSecs: 60, side: 'R' },
    ])
    expect(upsert).toHaveBeenCalledTimes(1)
    const uploaded = upsert.mock.calls[0][0]
    expect(uploaded).toHaveLength(1)
    expect(uploaded[0].id).toBe(UUID2)
  })

  it('treats same-interval feeds on different sides as distinct entries', async () => {
    const { upsert } = mockTable({
      existing: [{ started_at: ISO, ended_at: ISO, side: 'L' }],
    })
    await migrateLocalSessions('h1', 'u1', [
      { id: UUID,  startedAt: ISO, endedAt: ISO, durationSecs: 60, side: 'L' },  // already on server → skipped
      { id: UUID2, startedAt: ISO, endedAt: ISO, durationSecs: 60, side: 'R' },  // same times, other side → uploaded
    ])
    const uploaded = upsert.mock.calls[0][0]
    expect(uploaded).toHaveLength(1)
    expect(uploaded[0].side).toBe('R')
  })

  it('treats a same-interval bottle feed as distinct from a breast feed', async () => {
    const { upsert } = mockTable({
      existing: [{ started_at: ISO, ended_at: ISO, side: 'L' }],
    })
    await migrateLocalSessions('h1', 'u1', [
      // Bottle feeds carry side null on the server — must not collide with the L breast feed
      { id: UUID2, startedAt: ISO, endedAt: ISO, durationSecs: 60, side: null, feedType: 'bottle', amountMl: 120 },
    ])
    const uploaded = upsert.mock.calls[0][0]
    expect(uploaded).toHaveLength(1)
    expect(uploaded[0].feed_type).toBe('bottle')
  })

  it('treats same-time nappies of different types as distinct entries', async () => {
    const { upsert } = mockTable({
      existing: [{ logged_at: ISO, type: 'wet' }],
    })
    await migrateLocalNappies('h1', 'u1', [
      { id: UUID,  type: 'wet', loggedAt: ISO },   // already on server → skipped
      { id: UUID2, type: 'poo', loggedAt: ISO },   // same minute, different type → uploaded
    ])
    const uploaded = upsert.mock.calls[0][0]
    expect(uploaded).toHaveLength(1)
    expect(uploaded[0].type).toBe('poo')
  })

  it('re-running a fully landed migration uploads nothing (retry is a no-op)', async () => {
    const { upsert, insert } = mockTable({
      existing: [
        { started_at: ISO,  ended_at: ISO,  side: 'L' },
        { started_at: ISO2, ended_at: ISO2, side: 'R' },
      ],
    })
    await migrateLocalSessions('h1', 'u1', [
      { id: UUID,     startedAt: ISO,  endedAt: ISO,  durationSecs: 60, side: 'L' },
      { id: 'legacy', startedAt: ISO2, endedAt: ISO2, durationSecs: 60, side: 'R' },
    ])
    expect(upsert).not.toHaveBeenCalled()
    expect(insert).not.toHaveBeenCalled()
  })
})
