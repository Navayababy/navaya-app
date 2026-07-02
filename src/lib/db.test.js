import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('./supabase.js', () => ({
  isSupabaseConfigured: true,
  supabase: { from: vi.fn() },
}))

import { supabase } from './supabase.js'
import { migrateLocalNappies, migrateLocalSessions, userHasDataInHousehold } from './db.js'

const UUID = '123e4567-e89b-42d3-a456-426614174000'
const ISO  = '2026-01-01T00:00:00.000Z'
// Supabase surfaces RLS/constraint rejections as a returned error object,
// never as a thrown exception — the exact case the migration must not
// mistake for success.
const rlsError = { code: '42501', message: 'permission denied for table nappy_logs' }

beforeEach(() => {
  vi.clearAllMocks()
})

describe('migration batch error handling', () => {
  it('rejects when an upsert batch (UUID rows) returns an error', async () => {
    supabase.from.mockReturnValue({
      upsert: vi.fn().mockResolvedValue({ error: rlsError }),
      insert: vi.fn().mockResolvedValue({ error: null }),
    })
    await expect(migrateLocalNappies('h1', 'u1', [{ id: UUID, type: 'wet', loggedAt: ISO }]))
      .rejects.toMatchObject({ code: '42501' })
  })

  it('rejects when a legacy-row insert batch returns an error', async () => {
    supabase.from.mockReturnValue({
      upsert: vi.fn().mockResolvedValue({ error: null }),
      insert: vi.fn().mockResolvedValue({ error: rlsError }),
    })
    // Non-UUID id → mapped to null → takes the plain-insert path
    await expect(migrateLocalNappies('h1', 'u1', [{ id: 'legacy-1', type: 'wet', loggedAt: ISO }]))
      .rejects.toMatchObject({ code: '42501' })
  })

  it('resolves when every batch succeeds', async () => {
    const upsert = vi.fn().mockResolvedValue({ error: null })
    const insert = vi.fn().mockResolvedValue({ error: null })
    supabase.from.mockReturnValue({ upsert, insert })
    await expect(migrateLocalSessions('h1', 'u1', [
      { id: UUID,     startedAt: ISO, endedAt: ISO, durationSecs: 60, side: 'L' },
      { id: 'legacy', startedAt: ISO, endedAt: ISO, durationSecs: 60, side: 'R' },
    ])).resolves.toBeUndefined()
    expect(upsert).toHaveBeenCalledTimes(1)
    expect(insert).toHaveBeenCalledTimes(1)
  })
})

describe('userHasDataInHousehold', () => {
  const queryResult = (result) => ({
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue(result),
        }),
      }),
    }),
  })

  it('throws on a failed check rather than reporting "no data yet"', async () => {
    supabase.from.mockReturnValue(queryResult({ data: null, error: { message: 'boom' } }))
    await expect(userHasDataInHousehold('h1', 'u1')).rejects.toMatchObject({ message: 'boom' })
  })

  it('returns true when rows exist and false when none do', async () => {
    supabase.from.mockReturnValue(queryResult({ data: [{ id: 'x' }], error: null }))
    await expect(userHasDataInHousehold('h1', 'u1')).resolves.toBe(true)
    supabase.from.mockReturnValue(queryResult({ data: [], error: null }))
    await expect(userHasDataInHousehold('h1', 'u1')).resolves.toBe(false)
  })
})
