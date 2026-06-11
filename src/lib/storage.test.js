import { describe, it, expect, beforeEach } from 'vitest'
import {
  getSessions, addSession, updateSession, deleteSession,
  getNappies, addNappy, updateNappy, deleteNappy,
  getMedicines, addMedicine, deleteMedicine,
  addSleep, updateSleep, deleteSleep,
  getActiveSleep, setActiveSleep, clearActiveSleep,
  getChecked, setChecked, getCustomItems, setCustomItems,
  getHiddenDefaults, saveHiddenDefaults,
  getNightMode, setNightMode, getUserName, setUserName, getBabyName, setBabyName,
  getActiveTimer, setActiveTimer, clearActiveTimer,
} from './storage.js'

beforeEach(() => localStorage.clear())

const session = (id, overrides = {}) => ({
  id,
  side: 'L',
  startedAt: '2026-06-01T10:00:00.000Z',
  endedAt: '2026-06-01T10:15:00.000Z',
  durationSecs: 900,
  mood: null,
  ...overrides,
})

describe('sessions', () => {
  it('returns [] when nothing is stored', () => {
    expect(getSessions()).toEqual([])
  })

  it('returns [] when stored JSON is corrupt', () => {
    localStorage.setItem('navaya_sessions', '{not json')
    expect(getSessions()).toEqual([])
  })

  it('adds newest first', () => {
    addSession(session('1'))
    addSession(session('2'))
    expect(getSessions().map(s => s.id)).toEqual(['2', '1'])
  })

  it('trims to 500 entries', () => {
    for (let i = 0; i < 505; i++) addSession(session(String(i)))
    expect(getSessions()).toHaveLength(500)
    expect(getSessions()[0].id).toBe('504')
  })

  it('updates fields without touching duration when times unchanged', () => {
    addSession(session('1'))
    const result = updateSession('1', { mood: 4 })
    expect(result[0].mood).toBe(4)
    expect(result[0].durationSecs).toBe(900)
  })

  it('recalculates duration when startedAt or endedAt change', () => {
    addSession(session('1'))
    const result = updateSession('1', { endedAt: '2026-06-01T10:30:00.000Z' })
    expect(result[0].durationSecs).toBe(1800)
  })

  it('clamps recalculated duration at zero when end precedes start', () => {
    addSession(session('1'))
    const result = updateSession('1', { endedAt: '2026-06-01T09:00:00.000Z' })
    expect(result[0].durationSecs).toBe(0)
  })

  it('is a no-op for unknown ids', () => {
    addSession(session('1'))
    expect(updateSession('nope', { mood: 5 })).toHaveLength(1)
  })

  it('deletes by id', () => {
    addSession(session('1'))
    addSession(session('2'))
    expect(deleteSession('1').map(s => s.id)).toEqual(['2'])
  })
})

describe('nappies', () => {
  const nappy = (id, overrides = {}) => ({ id, type: 'wet', pooColor: null, loggedAt: '2026-06-01T08:00:00.000Z', ...overrides })

  it('adds newest first, trims to 500, updates and deletes', () => {
    addNappy(nappy('1'))
    addNappy(nappy('2', { type: 'poo', pooColor: 'mustard' }))
    expect(getNappies().map(n => n.id)).toEqual(['2', '1'])
    expect(updateNappy('1', { type: 'both' })[1].type).toBe('both')
    expect(deleteNappy('2').map(n => n.id)).toEqual(['1'])
  })

  it('returns [] on corrupt JSON', () => {
    localStorage.setItem('navaya_nappies', 'xx')
    expect(getNappies()).toEqual([])
  })
})

describe('medicines', () => {
  it('adds newest first and deletes', () => {
    addMedicine({ id: '1', name: 'Paracetamol', loggedAt: '2026-06-01T08:00:00.000Z' })
    addMedicine({ id: '2', name: 'Ibuprofen', loggedAt: '2026-06-01T09:00:00.000Z' })
    expect(getMedicines().map(m => m.id)).toEqual(['2', '1'])
    expect(deleteMedicine('1').map(m => m.id)).toEqual(['2'])
  })
})

describe('sleeps', () => {
  it('supports add/update/delete with duration recalculation', () => {
    addSleep({ id: '1', startedAt: '2026-06-01T20:00:00.000Z', endedAt: '2026-06-01T22:00:00.000Z', durationSecs: 7200 })
    const updated = updateSleep('1', { endedAt: '2026-06-01T21:00:00.000Z' })
    expect(updated[0].durationSecs).toBe(3600)
    expect(deleteSleep('1')).toEqual([])
  })

  it('tracks the active sleep marker', () => {
    expect(getActiveSleep()).toBeNull()
    setActiveSleep(1234)
    expect(getActiveSleep()).toEqual({ startedAt: 1234 })
    clearActiveSleep()
    expect(getActiveSleep()).toBeNull()
  })
})

describe('checklist', () => {
  it('round-trips checked state, custom items and hidden defaults', () => {
    expect(getChecked()).toEqual({})
    setChecked({ water: true })
    expect(getChecked()).toEqual({ water: true })

    expect(getCustomItems()).toEqual([])
    setCustomItems([{ id: 'custom_1', label: 'Snacks' }])
    expect(getCustomItems()).toEqual([{ id: 'custom_1', label: 'Snacks' }])

    expect(getHiddenDefaults()).toEqual([])
    saveHiddenDefaults(['muslin'])
    expect(getHiddenDefaults()).toEqual(['muslin'])
  })
})

describe('preferences', () => {
  it('night mode defaults to false and persists as a string flag', () => {
    expect(getNightMode()).toBe(false)
    setNightMode(true)
    expect(getNightMode()).toBe(true)
  })

  it('names default to empty string', () => {
    expect(getUserName()).toBe('')
    expect(getBabyName()).toBe('')
    setUserName('Parm')
    setBabyName('Aria')
    expect(getUserName()).toBe('Parm')
    expect(getBabyName()).toBe('Aria')
  })
})

describe('active timer', () => {
  it('defaults to null, persists side and start, and clears', () => {
    expect(getActiveTimer()).toBeNull()
    setActiveTimer('L', 1700000000000)
    expect(getActiveTimer()).toEqual({ side: 'L', startedAt: 1700000000000, feedType: 'breast' })
    clearActiveTimer()
    expect(getActiveTimer()).toBeNull()
  })

  it('persists a bottle timer with no side', () => {
    setActiveTimer(null, 1700000000000, 'bottle')
    expect(getActiveTimer()).toEqual({ side: null, startedAt: 1700000000000, feedType: 'bottle' })
  })

  it('still reads a timer persisted before bottle feeds existed', () => {
    localStorage.setItem('navaya_active_timer', JSON.stringify({ side: 'R', startedAt: 1700000000000 }))
    expect(getActiveTimer()).toEqual({ side: 'R', startedAt: 1700000000000 })
  })

  it('returns null on corrupt JSON', () => {
    localStorage.setItem('navaya_active_timer', '{bad')
    expect(getActiveTimer()).toBeNull()
  })
})

describe('bottle feed sessions', () => {
  it('round-trips bottle fields', () => {
    addSession(session('b1', { feedType: 'bottle', side: null, amountMl: 120, milkType: 'formula' }))
    const [s] = getSessions()
    expect(s).toMatchObject({ feedType: 'bottle', side: null, amountMl: 120, milkType: 'formula' })
  })

  it('patches amount and milk type without touching other fields', () => {
    addSession(session('b1', { feedType: 'bottle', side: null, amountMl: null, milkType: null }))
    const [s] = updateSession('b1', { amountMl: 90, milkType: 'expressed' })
    expect(s.amountMl).toBe(90)
    expect(s.milkType).toBe('expressed')
    expect(s.durationSecs).toBe(900)
    expect(s.feedType).toBe('bottle')
  })
})
