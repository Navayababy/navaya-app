import { describe, it, expect, vi, afterEach } from 'vitest'
import { newId } from './id.js'

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

afterEach(() => vi.unstubAllGlobals())

describe('newId', () => {
  it('returns a v4 UUID', () => {
    expect(newId()).toMatch(UUID_V4)
  })

  it('returns unique values', () => {
    const ids = new Set(Array.from({ length: 1000 }, () => newId()))
    expect(ids.size).toBe(1000)
  })

  it('falls back to a valid v4 UUID when crypto.randomUUID is unavailable', () => {
    vi.stubGlobal('crypto', {})
    expect(newId()).toMatch(UUID_V4)
  })
})
