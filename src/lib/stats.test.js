import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  feedMoodMeta, averageFeedMood, computeWeeklyInsights, computeDayRhythm,
  secsOverlapping, sleepDayStart, sleepSecsOnSleepDay, napSecsOnSleepDay,
  nightSecsOfSleepDay, latestNightSleep,
} from './stats.js'

// Fixed "now": Tuesday 9 June 2026, 14:30 local time
const NOW = new Date(2026, 5, 9, 14, 30, 0)

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(NOW)
})
afterEach(() => vi.useRealTimers())

const at = (daysAgo, hour, minute = 0) => {
  const d = new Date(NOW)
  d.setDate(d.getDate() - daysAgo)
  d.setHours(hour, minute, 0, 0)
  return d.toISOString()
}

const feed = (daysAgo, hour, overrides = {}) => ({
  id: `${daysAgo}-${hour}`,
  side: 'L',
  startedAt: at(daysAgo, hour),
  endedAt: at(daysAgo, hour, 15),
  durationSecs: 900,
  mood: null,
  ...overrides,
})

describe('feedMoodMeta', () => {
  it('returns null for falsy scores', () => {
    expect(feedMoodMeta(null)).toBeNull()
    expect(feedMoodMeta(0)).toBeNull()
  })

  it('rounds and clamps to the 1-5 scale', () => {
    expect(feedMoodMeta(3.4)).toMatchObject({ rounded: 3, emoji: '🙂', label: 'Good' })
    expect(feedMoodMeta(3.5)).toMatchObject({ rounded: 4, label: 'Great' })
    expect(feedMoodMeta(99)).toMatchObject({ rounded: 5, label: 'Amazing' })
  })
})

describe('averageFeedMood', () => {
  it('returns null when no feeds are rated', () => {
    expect(averageFeedMood([feed(0, 9)])).toBeNull()
    expect(averageFeedMood([])).toBeNull()
  })

  it('averages only the rated feeds and reports the count', () => {
    const feeds = [feed(0, 9, { mood: 2 }), feed(0, 11, { mood: 4 }), feed(0, 13)]
    const avg = averageFeedMood(feeds)
    expect(avg.score).toBe(3)
    expect(avg.count).toBe(2)
    expect(avg.label).toBe('Good')
  })
})

describe('secsOverlapping', () => {
  it('counts an interval fully inside the window', () => {
    expect(secsOverlapping(at(0, 13), at(0, 14), at(0, 0), at(0, 23, 59))).toBe(3600)
  })

  it('clamps to the window boundaries', () => {
    const winStart = at(1, 19) // yesterday 19:00
    const winEnd   = at(0, 7)  // today 07:00
    expect(secsOverlapping(at(1, 22), at(0, 6), winStart, winEnd)).toBe(8 * 3600)
  })

  it('returns zero for intervals entirely outside the window', () => {
    expect(secsOverlapping(at(2, 13), at(2, 14), at(0, 0), at(0, 23, 59))).toBe(0)
  })
})

describe('sleepDayStart', () => {
  it('resolves an instant after day-start to that same calendar day at 07:00', () => {
    expect(sleepDayStart(new Date(NOW))).toEqual(new Date(2026, 5, 9, 7, 0, 0, 0))
  })

  it('resolves an instant before day-start to the previous day at 07:00', () => {
    const early = new Date(2026, 5, 9, 3, 0, 0, 0)
    expect(sleepDayStart(early)).toEqual(new Date(2026, 5, 8, 7, 0, 0, 0))
  })

  it("treats exactly 07:00 as the start of that day's sleep-day", () => {
    const exact = new Date(2026, 5, 9, 7, 0, 0, 0)
    expect(sleepDayStart(exact)).toEqual(exact)
  })
})

describe('sleepSecsOnSleepDay / napSecsOnSleepDay / nightSecsOfSleepDay', () => {
  it('attributes an overnight sleep wholly to the sleep-day it started, not the calendar day it ended', () => {
    const sleeps = [{ startedAt: at(1, 22), endedAt: at(0, 6) }] // yesterday 22:00 → today 06:00, 8h
    expect(sleepSecsOnSleepDay(sleeps, at(1, 12))).toBe(8 * 3600) // yesterday's sleep-day: the full night
    expect(sleepSecsOnSleepDay(sleeps, NOW)).toBe(0)              // today's sleep-day: hadn't started at 06:00
  })

  it('splits a sleep crossing the 19:00 night threshold between naps and night', () => {
    const sleeps = [{ startedAt: at(0, 18, 30), endedAt: at(0, 19, 30) }]
    expect(napSecsOnSleepDay(sleeps, NOW)).toBe(30 * 60)
    expect(nightSecsOfSleepDay(sleeps, NOW)).toBe(30 * 60)
    expect(sleepSecsOnSleepDay(sleeps, NOW)).toBe(3600)
  })

  it('distributes a multi-day sleep across every sleep-day it touches with no loss', () => {
    const sleeps = [{ startedAt: at(2, 20), endedAt: at(0, 20) }] // exactly 48h
    const twoDaysAgo = sleepSecsOnSleepDay(sleeps, at(2, 12))
    const oneDayAgo   = sleepSecsOnSleepDay(sleeps, at(1, 12))
    const today       = sleepSecsOnSleepDay(sleeps, at(0, 12))
    expect(twoDaysAgo).toBe(11 * 3600)
    expect(oneDayAgo).toBe(24 * 3600)
    expect(today).toBe(13 * 3600)
    expect(twoDaysAgo + oneDayAgo + today).toBe(48 * 3600)
  })

  it('skips open-ended sleeps and unparseable timestamps', () => {
    const sleeps = [
      { startedAt: at(0, 13), endedAt: null },
      { startedAt: 'garbage', endedAt: at(0, 14) },
    ]
    expect(sleepSecsOnSleepDay(sleeps, NOW)).toBe(0)
  })
})

describe('latestNightSleep', () => {
  it('returns last night, already ended, when now is before the night threshold', () => {
    const sleeps = [{ startedAt: at(1, 22), endedAt: at(0, 6) }]
    const result = latestNightSleep(sleeps, NOW) // NOW is 14:30, before 19:00
    expect(result.secs).toBe(8 * 3600)
    expect(result.inProgress).toBe(false)
    expect(result.end).toEqual(new Date(2026, 5, 9, 7, 0, 0, 0))
  })

  it('returns tonight-so-far, in progress, once the night threshold has passed', () => {
    const tonight = new Date(2026, 5, 9, 22, 0, 0)
    const result = latestNightSleep([], tonight)
    expect(result.secs).toBe(0)
    expect(result.inProgress).toBe(true)
    expect(result.start).toEqual(new Date(2026, 5, 9, 19, 0, 0, 0))
    expect(result.end).toEqual(new Date(2026, 5, 10, 7, 0, 0, 0))
  })

  it('returns zero seconds with no sleep logged', () => {
    expect(latestNightSleep([], NOW).secs).toBe(0)
  })
})

describe('computeWeeklyInsights', () => {
  it('returns 7 rows ending today, with zeroed days', () => {
    const insights = computeWeeklyInsights([], [], [])
    expect(insights.rows).toHaveLength(7)
    expect(insights.rows[6].key).toBe('2026-06-09')
    expect(insights.rows[0].key).toBe('2026-06-03')
    expect(insights.totalFeeds).toBe(0)
    expect(insights.avgMood).toBeNull()
    expect(insights.avgGapMins).toBeNull()
  })

  it('buckets feeds, medicines and nappies by local day', () => {
    const feeds = [feed(0, 9, { mood: 4 }), feed(0, 12), feed(1, 10, { mood: 2 })]
    const nappies = [
      { id: 'n1', type: 'poo', loggedAt: at(0, 8) },
      { id: 'n2', type: 'both', loggedAt: at(1, 8) }, // counts as wet AND dirty
      { id: 'n3', type: 'wet', loggedAt: at(1, 9) },  // wet does not count as dirty
    ]
    const meds = [{ id: 'm1', name: 'Paracetamol', loggedAt: at(0, 7) }]

    const insights = computeWeeklyInsights(feeds, nappies, meds)
    const today = insights.rows[6]
    const yesterday = insights.rows[5]

    expect(today.feeds).toBe(2)
    expect(today.dirty).toBe(1)
    expect(today.wet).toBe(0)
    expect(today.meds).toBe(1)
    expect(yesterday.feeds).toBe(1)
    expect(yesterday.dirty).toBe(1)
    expect(yesterday.wet).toBe(2)
    expect(insights.totalFeeds).toBe(3)
    expect(insights.totalWet).toBe(2)
    expect(insights.totalDirty).toBe(2)
    expect(insights.totalMeds).toBe(1)
  })

  it('attributes sleep to the sleep-day it started, not the calendar day it ended', () => {
    const sleeps = [
      { startedAt: at(1, 22), endedAt: at(0, 6) },  // full night, belongs to yesterday's sleep-day
      { startedAt: at(0, 13), endedAt: at(0, 14) }, // 1h nap today
    ]
    const insights = computeWeeklyInsights([], [], [], sleeps)
    expect(insights.rows[6].sleepSecs).toBe(1 * 3600) // today: just the nap — the night ended before today's sleep-day began
    expect(insights.rows[5].sleepSecs).toBe(8 * 3600) // yesterday: the whole night
    expect(insights.rows[4].sleepSecs).toBe(0)
  })

  it("averages sleep over complete sleep-days only, never today's in-progress one", () => {
    const sleeps = [
      { startedAt: at(1, 22), endedAt: at(0, 6) },  // full night, complete (belongs to yesterday)
      { startedAt: at(0, 13), endedAt: at(0, 14) }, // 1h nap today — must not count
    ]
    const insights = computeWeeklyInsights([], [], [], sleeps)
    expect(insights.avgSleepSecsPerDay).toBe(8 * 3600)
  })

  it('averages only complete sleep-days in a mix of complete days and today', () => {
    const sleeps = [
      { startedAt: at(2, 20), endedAt: at(2, 22) }, // 2h, 2 days ago — complete
      { startedAt: at(0, 13), endedAt: at(0, 14) }, // 1h today — in progress, excluded
    ]
    const insights = computeWeeklyInsights([], [], [], sleeps)
    expect(insights.avgSleepSecsPerDay).toBe(2 * 3600)
  })

  it('returns a null sleep average when sleep is logged only today (in-progress sleep-day)', () => {
    const sleeps = [{ startedAt: at(0, 13), endedAt: at(0, 14) }]
    const insights = computeWeeklyInsights([], [], [], sleeps)
    expect(insights.avgSleepSecsPerDay).toBeNull()
  })

  it('returns a null sleep average when no sleep is logged', () => {
    const insights = computeWeeklyInsights([], [], [])
    expect(insights.avgSleepSecsPerDay).toBeNull()
  })

  it('splits a mixed-feeding week into breast durations and bottle ml', () => {
    const feeds = [
      feed(0, 9, { durationSecs: 600 }),                                          // 10m breast
      feed(0, 12, { feedType: 'bottle', side: null, amountMl: 120, milkType: 'formula' }),
      feed(1, 9, { durationSecs: 1200 }),                                         // 20m breast
      feed(1, 12, { feedType: 'bottle', side: null, amountMl: null, milkType: 'expressed' }), // amount skipped
    ]
    const insights = computeWeeklyInsights(feeds, [], [])
    expect(insights.totalFeeds).toBe(4)            // bar chart counts every feed
    expect(insights.totalBreastFeeds).toBe(2)
    expect(insights.totalBottleMl).toBe(120)       // skipped amount contributes 0
    expect(insights.avgFeedMins).toBe(15)          // bottle durations excluded
    expect(insights.rows[6].bottleMl).toBe(120)
    expect(insights.rows[6].feeds).toBe(2)
  })

  it('handles an all-bottle week without NaN', () => {
    const feeds = [
      feed(0, 9,  { feedType: 'bottle', side: null, amountMl: 90, milkType: 'expressed' }),
      feed(0, 13, { feedType: 'bottle', side: null, amountMl: 150, milkType: 'formula' }),
    ]
    const insights = computeWeeklyInsights(feeds, [], [])
    expect(insights.avgFeedMins).toBe(0)
    expect(insights.totalBottleMl).toBe(240)
    expect(insights.avgGapMins).toBe(240)          // gaps span bottle feeds too
  })

  it('ignores entries outside the 7-day window', () => {
    const insights = computeWeeklyInsights([feed(8, 9)], [], [])
    expect(insights.totalFeeds).toBe(0)
  })

  it('averages feed minutes and mood across the week', () => {
    const feeds = [
      feed(0, 9, { durationSecs: 600, mood: 3 }),   // 10m
      feed(1, 9, { durationSecs: 1200, mood: 5 }),  // 20m
    ]
    const insights = computeWeeklyInsights(feeds, [], [])
    expect(insights.avgFeedMins).toBe(15)
    expect(insights.ratedFeeds).toBe(2)
    expect(insights.avgMood).toMatchObject({ rounded: 4, label: 'Great' })
  })

  it('computes the average gap between feeds in minutes', () => {
    // Feeds at 08:00, 11:00 and 13:00 today → gaps of 180m and 120m → avg 150m
    const feeds = [feed(0, 8), feed(0, 11), feed(0, 13)]
    const insights = computeWeeklyInsights(feeds, [], [])
    expect(insights.avgGapMins).toBe(150)
  })

  it('excludes future-dated feeds from the gap calculation', () => {
    const feeds = [feed(0, 8), feed(0, 10), { ...feed(0, 23), id: 'future' }]
    const insights = computeWeeklyInsights(feeds, [], [])
    expect(insights.avgGapMins).toBe(120)
  })
})

describe('computeDayRhythm', () => {
  it('returns 7 days ending today, oldest first, with nowFrac only on today', () => {
    const days = computeDayRhythm([], [])
    expect(days).toHaveLength(7)
    expect(days[6].isToday).toBe(true)
    // Fixed clock is 14:30 → 14.5/24 of the day has passed
    expect(days[6].nowFrac).toBeCloseTo(14.5 / 24, 5)
    expect(days.slice(0, 6).every(d => d.nowFrac === null)).toBe(true)
    expect(days.every(d => !d.hasData)).toBe(true)
  })

  it('places feeds on the right day at the right fraction', () => {
    const days = computeDayRhythm([feed(0, 6), feed(1, 12), feed(9, 8)], [])
    expect(days[6].feeds).toEqual([6 / 24])
    expect(days[5].feeds).toEqual([12 / 24])
    // The 9-days-ago feed is outside the window entirely
    expect(days.reduce((a, d) => a + d.feeds.length, 0)).toBe(2)
    expect(days[6].hasData).toBe(true)
  })

  it('splits an overnight sleep across both days it touches', () => {
    const sleeps = [{ startedAt: at(1, 22), endedAt: at(0, 6) }]
    const days = computeDayRhythm([], sleeps)
    expect(days[5].sleeps).toEqual([{ from: 22 / 24, to: 1 }])
    expect(days[6].sleeps).toEqual([{ from: 0, to: 6 / 24 }])
  })

  it('sorts sleep segments and feed marks within a day', () => {
    const sleeps = [
      { startedAt: at(0, 13), endedAt: at(0, 14) },
      { startedAt: at(0, 9),  endedAt: at(0, 10) },
    ]
    const days = computeDayRhythm([feed(0, 11), feed(0, 8)], sleeps)
    expect(days[6].sleeps.map(s => s.from)).toEqual([9 / 24, 13 / 24])
    expect(days[6].feeds).toEqual([8 / 24, 11 / 24])
  })

  it('skips open-ended sleeps and unparseable timestamps', () => {
    const sleeps = [
      { startedAt: at(0, 13), endedAt: null },
      { startedAt: 'garbage', endedAt: at(0, 14) },
    ]
    const days = computeDayRhythm([{ id: 'x', startedAt: 'garbage' }], sleeps)
    expect(days.every(d => !d.hasData)).toBe(true)
  })
})
