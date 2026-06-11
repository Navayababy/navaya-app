import { describe, it, expect } from 'vitest'
import { normalizeFeedSession, normalizeNappy, normalizeMedicine, feedTypeOf, isBottleFeed } from './normalize.js'

describe('normalizeFeedSession', () => {
  it('converts a Supabase row to the camelCase shape, defaulting feed type', () => {
    // Pre-migration rows have no feed_type — they are breast feeds
    const row = {
      id: 'uuid-1', side: 'L',
      started_at: '2026-06-01T10:00:00Z', ended_at: '2026-06-01T10:15:00Z',
      duration_secs: 900, mood_score: 4, logged_by: 'user-1',
    }
    expect(normalizeFeedSession(row)).toEqual({
      id: 'uuid-1', feedType: 'breast', side: 'L',
      startedAt: '2026-06-01T10:00:00Z', endedAt: '2026-06-01T10:15:00Z',
      durationSecs: 900, amountMl: null, milkType: null, mood: 4, loggedBy: 'user-1',
    })
  })

  it('converts a bottle row', () => {
    const row = {
      id: 'uuid-2', feed_type: 'bottle', side: null,
      started_at: '2026-06-01T12:00:00Z', ended_at: '2026-06-01T12:20:00Z',
      duration_secs: 1200, amount_ml: 120, milk_type: 'formula', mood_score: null, logged_by: 'user-1',
    }
    const out = normalizeFeedSession(row)
    expect(out).toMatchObject({ feedType: 'bottle', side: null, amountMl: 120, milkType: 'formula' })
  })

  it('returns already-normalized objects untouched', () => {
    const local = { id: '1', side: 'R', startedAt: 'x', endedAt: 'y', durationSecs: 1, mood: null }
    expect(normalizeFeedSession(local)).toBe(local)
  })
})

describe('feedTypeOf / isBottleFeed', () => {
  it('defaults legacy records to breast', () => {
    expect(feedTypeOf({})).toBe('breast')
    expect(feedTypeOf({ id: '1', side: 'L', startedAt: 'x' })).toBe('breast')
    expect(isBottleFeed({ side: 'L' })).toBe(false)
  })

  it('recognises bottle feeds in both shapes', () => {
    expect(isBottleFeed({ feedType: 'bottle' })).toBe(true)
    expect(isBottleFeed({ feed_type: 'bottle' })).toBe(true)
    expect(feedTypeOf({ feedType: 'bottle' })).toBe('bottle')
  })
})

describe('normalizeNappy', () => {
  it('converts a Supabase row', () => {
    const row = { id: 'n1', type: 'poo', poo_color: 'mustard', logged_at: '2026-06-01T08:00:00Z', logged_by: 'user-1' }
    const out = normalizeNappy(row)
    expect(out.pooColor).toBe('mustard')
    expect(out.loggedAt).toBe('2026-06-01T08:00:00Z')
    expect(out.loggedBy).toBe('user-1')
  })

  it('returns already-normalized objects untouched', () => {
    const local = { id: 'n1', type: 'wet', pooColor: null, loggedAt: 'x' }
    expect(normalizeNappy(local)).toBe(local)
  })
})

describe('normalizeMedicine', () => {
  it('converts a Supabase row', () => {
    const row = { id: 'm1', name: 'Paracetamol', medicine_id: 'paracetamol', dose_ml: 5, form: '120mg/5ml', notes: null, logged_at: '2026-06-01T09:00:00Z', logged_by: 'user-1' }
    const out = normalizeMedicine(row)
    expect(out.medicineId).toBe('paracetamol')
    expect(out.doseMl).toBe(5)
    expect(out.loggedAt).toBe('2026-06-01T09:00:00Z')
  })

  it('returns already-normalized objects untouched', () => {
    const local = { id: 'm1', name: 'Paracetamol', loggedAt: 'x' }
    expect(normalizeMedicine(local)).toBe(local)
  })
})
