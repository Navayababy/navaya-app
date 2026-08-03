import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { fmt, fmtMins, fmtSince, timeAgo, dayLabel, dayShort, fmtDayTime, timeStr, dateStr, buildISO, tryBuildISO, todayDateStr, dayKey, nearestDateForTime } from './time.js'

// Fixed "now": Tuesday 9 June 2026, 14:30 local time
const NOW = new Date(2026, 5, 9, 14, 30, 0)

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(NOW)
})
afterEach(() => vi.useRealTimers())

const minutesAgo = (mins) => new Date(NOW.getTime() - mins * 60000).toISOString()

describe('fmt (mm:ss)', () => {
  it('formats seconds as zero-padded mm:ss', () => {
    expect(fmt(0)).toBe('00:00')
    expect(fmt(65)).toBe('01:05')
    expect(fmt(599)).toBe('09:59')
  })

  it('does not roll minutes into hours', () => {
    expect(fmt(3900)).toBe('65:00')
  })
})

describe('fmtMins', () => {
  it('shows minutes below an hour and h/m above', () => {
    expect(fmtMins(59)).toBe('0m')
    expect(fmtMins(120)).toBe('2m')
    expect(fmtMins(3900)).toBe('1h 5m')
  })
})

describe('fmtSince', () => {
  it('returns null for missing input', () => {
    expect(fmtSince(null)).toBeNull()
  })

  it('returns "just now" under a minute, then m / h m', () => {
    expect(fmtSince(minutesAgo(0.5))).toBe('just now')
    expect(fmtSince(minutesAgo(2))).toBe('2m')
    expect(fmtSince(minutesAgo(61))).toBe('1h 1m')
  })

  it('rolls over to days past 24 hours', () => {
    expect(fmtSince(minutesAgo(60 * 26))).toBe('1 day')
    expect(fmtSince(minutesAgo(60 * 24 * 14 + 30))).toBe('14 days')
  })
})

describe('timeAgo', () => {
  it('returns empty string for missing input', () => {
    expect(timeAgo(null)).toBe('')
  })

  it('formats just now / m ago / h m ago', () => {
    expect(timeAgo(minutesAgo(0.5))).toBe('just now')
    expect(timeAgo(minutesAgo(5))).toBe('5m ago')
    expect(timeAgo(minutesAgo(125))).toBe('2h 5m ago')
  })

  it('rolls over to days past 24 hours', () => {
    expect(timeAgo(minutesAgo(60 * 26))).toBe('1 day ago')
    expect(timeAgo(minutesAgo(60 * 24 * 14 + 30))).toBe('14 days ago')
  })
})

describe('dayLabel', () => {
  it('labels today and yesterday', () => {
    expect(dayLabel(NOW.toISOString())).toBe('Today')
    expect(dayLabel(new Date(2026, 5, 8, 9, 0).toISOString())).toBe('Yesterday')
  })

  it('uses weekday + day + short month otherwise', () => {
    // 1 June 2026 was a Monday
    expect(dayLabel(new Date(2026, 5, 1, 9, 0).toISOString())).toBe('Monday 1 Jun')
  })
})

describe('dayShort / fmtDayTime', () => {
  it('labels days briefly', () => {
    expect(dayShort(NOW.toISOString())).toBe('Today')
    expect(dayShort(new Date(2026, 5, 8, 9, 0).toISOString())).toBe('Yesterday')
    expect(dayShort(new Date(2026, 5, 1, 9, 0).toISOString())).toBe('1 Jun')
  })

  it('shows bare time today, day-prefixed time otherwise', () => {
    expect(fmtDayTime(new Date(2026, 5, 9, 8, 5).toISOString())).toBe('08:05')
    expect(fmtDayTime(new Date(2026, 5, 8, 22, 40).toISOString())).toBe('Yesterday 22:40')
    expect(fmtDayTime(new Date(2026, 5, 1, 14, 30).toISOString())).toBe('1 Jun · 14:30')
  })
})

describe('timeStr / dateStr / dayKey / todayDateStr', () => {
  it('formats local time and date with zero padding', () => {
    const d = new Date(2026, 0, 5, 7, 8)
    expect(timeStr(d)).toBe('07:08')
    expect(dateStr(d)).toBe('2026-01-05')
  })

  it('defaults to now', () => {
    expect(timeStr()).toBe('14:30')
    expect(dateStr()).toBe('2026-06-09')
    expect(todayDateStr()).toBe('2026-06-09')
  })

  it('dayKey matches dateStr for the same instant', () => {
    const iso = new Date(2026, 5, 3, 23, 59).toISOString()
    expect(dayKey(iso)).toBe('2026-06-03')
  })
})

describe('buildISO', () => {
  it('builds an ISO string for a local date and time that round-trips', () => {
    const iso = buildISO('2026-06-09', '14:05')
    const d = new Date(iso)
    expect(d.getFullYear()).toBe(2026)
    expect(d.getMonth()).toBe(5)
    expect(d.getDate()).toBe(9)
    expect(d.getHours()).toBe(14)
    expect(d.getMinutes()).toBe(5)
  })
})

describe('tryBuildISO', () => {
  it('matches buildISO for complete, valid input', () => {
    expect(tryBuildISO('2026-06-09', '14:05')).toBe(buildISO('2026-06-09', '14:05'))
  })

  it('returns null instead of throwing for an empty date (mid-edit, cleared input)', () => {
    expect(tryBuildISO('', '14:05')).toBeNull()
  })

  it('returns null instead of throwing for an empty time', () => {
    expect(tryBuildISO('2026-06-09', '')).toBeNull()
  })

  it('returns null instead of throwing when both are empty', () => {
    expect(tryBuildISO('', '')).toBeNull()
  })
})

describe('nearestDateForTime', () => {
  it('keeps a same-day correction on the reference date', () => {
    const ref = new Date(2026, 5, 9, 14, 20).toISOString()
    const iso = nearestDateForTime(ref, '14:05')
    expect(dateStr(iso)).toBe('2026-06-09')
    expect(timeStr(iso)).toBe('14:05')
  })

  it('rolls a correction forward across midnight when that is closer', () => {
    // Original start was 23:50 on the 8th; the corrected time (00:02) is
    // actually just after midnight on the 9th, not the same 23:50 evening.
    const ref = new Date(2026, 5, 8, 23, 50).toISOString()
    const iso = nearestDateForTime(ref, '00:02')
    expect(dateStr(iso)).toBe('2026-06-09')
    expect(timeStr(iso)).toBe('00:02')
  })

  it('rolls a correction backward across midnight when that is closer', () => {
    // Original was 00:05 on the 9th; corrected to 23:58, which is closer to
    // the evening before than 23:58 later that same night.
    const ref = new Date(2026, 5, 9, 0, 5).toISOString()
    const iso = nearestDateForTime(ref, '23:58')
    expect(dateStr(iso)).toBe('2026-06-08')
    expect(timeStr(iso)).toBe('23:58')
  })

  it('fixes the reported bug: correcting a pre-midnight start to just after midnight', () => {
    const startedAt = new Date(2026, 5, 8, 23, 50).toISOString()
    const endedAt   = new Date(2026, 5, 9, 0, 10).toISOString()
    const correctedStart = nearestDateForTime(startedAt, '00:02')
    const correctedEnd   = nearestDateForTime(endedAt, '00:10')
    const durationSecs = Math.round((new Date(correctedEnd) - new Date(correctedStart)) / 1000)
    expect(dateStr(correctedStart)).toBe('2026-06-09')
    expect(durationSecs).toBe(8 * 60)
  })
})
