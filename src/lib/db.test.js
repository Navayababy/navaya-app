import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('./supabase.js', () => ({
  isSupabaseConfigured: true,
  supabase: { from: vi.fn() },
}))

import { supabase } from './supabase.js'
import { migrateLocalNappies, migrateLocalSessions } from './db.js'

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

// A "does the user already have data?" sentinel used to guard the migration
// and was removed on purpose: after a partial failure it reads as "already
// migrated" and strands the remaining rows. Retry safety comes from the
// idempotent upsert path above — this test pins the property that makes
// running the migration twice harmless.
describe('migration retry idempotency', () => {
  it('re-sends every row through the ignore-duplicates upsert path on a retry', async () => {
    const upsert = vi.fn().mockResolvedValue({ error: null })
    const insert = vi.fn().mockResolvedValue({ error: null })
    supabase.from.mockReturnValue({ upsert, insert })
    const rows = [{ id: UUID, type: 'wet', loggedAt: ISO }]
    await migrateLocalNappies('h1', 'u1', rows)
    await migrateLocalNappies('h1', 'u1', rows)
    expect(upsert).toHaveBeenCalledTimes(2)
    expect(upsert).toHaveBeenLastCalledWith(
      [expect.objectContaining({ id: UUID })],
      { onConflict: 'id', ignoreDuplicates: true },
    )
    // The non-idempotent plain-insert path never fires for UUID rows
    expect(insert).not.toHaveBeenCalled()
  })
})
