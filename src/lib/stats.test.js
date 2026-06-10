import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { feedMoodMeta, averageFeedMood, computeWeeklyInsights, secsOverlappingDay, sleepSecsOnDay } from './stats.js'

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

describe('secsOverlappingDay / sleepSecsOnDay', () => {
  const iso = (daysAgo, hour, minute = 0) => at(daysAgo, hour, minute)

  it('counts a same-day interval in full', () => {
    expect(secsOverlappingDay(iso(0, 13), iso(0, 14))).toBe(3600)
  })

  it('clamps an overnight sleep to the portion inside each day', () => {
    const start = iso(1, 22) // yesterday 22:00
    const end   = iso(0, 6)  // today 06:00
    expect(secsOverlappingDay(start, end, NOW)).toBe(6 * 3600)
    const yesterday = new Date(NOW); yesterday.setDate(yesterday.getDate() - 1)
    expect(secsOverlappingDay(start, end, yesterday)).toBe(2 * 3600)
  })

  it('returns zero for intervals outside the day', () => {
    expect(secsOverlappingDay(iso(2, 13), iso(2, 14), NOW)).toBe(0)
  })

  it('sums clamped portions across sleeps', () => {
    const sleeps = [
      { startedAt: iso(1, 22), endedAt: iso(0, 6) },  // 6h today
      { startedAt: iso(0, 13), endedAt: iso(0, 14) }, // 1h today
      { startedAt: iso(2, 9),  endedAt: iso(2, 10) }, // not today
    ]
    expect(sleepSecsOnDay(sleeps, NOW)).toBe(7 * 3600)
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
    expect(insights.peakFeeds).toBe(1) // floor of 1 so bar heights never divide by zero
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
    expect(insights.peakFeeds).toBe(2)
  })

  it('clamps sleep to day rows and averages over days with sleep logged', () => {
    const sleeps = [
      { startedAt: at(1, 22), endedAt: at(0, 6) }, // 2h yesterday + 6h today
      { startedAt: at(0, 13), endedAt: at(0, 14) }, // 1h today
    ]
    const insights = computeWeeklyInsights([], [], [], sleeps)
    expect(insights.rows[6].sleepSecs).toBe(7 * 3600)
    expect(insights.rows[5].sleepSecs).toBe(2 * 3600)
    expect(insights.rows[4].sleepSecs).toBe(0)
    // Only the 2 days with logged sleep count towards the average
    expect(insights.avgSleepSecsPerDay).toBe(Math.round((9 * 3600) / 2))
  })

  it('returns a null sleep average when no sleep is logged', () => {
    const insights = computeWeeklyInsights([], [], [])
    expect(insights.avgSleepSecsPerDay).toBeNull()
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
