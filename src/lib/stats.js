// Pure stats/insights calculations shared by HistoryScreen.
// Kept free of React so they can be unit-tested directly.

import { dateStr, dayKey } from '../utils/time.js'
import { MOOD_EMOJI, MOOD_LABEL } from './constants.js'
import { isBottleFeed } from './normalize.js'

export function feedMoodMeta(score) {
  if (!score) return null
  const rounded = Math.min(5, Math.max(1, Math.round(score)))
  return { score, rounded, emoji: MOOD_EMOJI[rounded - 1], label: MOOD_LABEL[rounded - 1] }
}

export function averageFeedMood(feeds) {
  const rated = feeds.filter(feed => Number(feed.mood) > 0)
  if (!rated.length) return null
  const average = rated.reduce((total, feed) => total + Number(feed.mood), 0) / rated.length
  return { ...feedMoodMeta(average), count: rated.length }
}

// Seconds of an interval that fall within the calendar day containing `day`.
// Used to clamp overnight sleeps to day boundaries so daily totals only count
// the portion that actually occurred on that day.
export function secsOverlappingDay(startedAt, endedAt, day = new Date()) {
  const dayStart = new Date(day)
  dayStart.setHours(0, 0, 0, 0)
  const dayEnd = new Date(dayStart)
  dayEnd.setDate(dayEnd.getDate() + 1)
  const start = Math.max(new Date(startedAt).getTime(), dayStart.getTime())
  const end   = Math.min(new Date(endedAt).getTime(), dayEnd.getTime())
  return Math.max(0, Math.round((end - start) / 1000))
}

export function sleepSecsOnDay(sleeps, day = new Date()) {
  return sleeps.reduce((a, s) => a + secsOverlappingDay(s.startedAt, s.endedAt, day), 0)
}

// Per-day 24-hour rhythm for the weekly summary chart: one entry per local
// calendar day (oldest first), with that day's sleep intervals clamped to
// its midnight boundaries and expressed as fractions of the day, plus each
// feed start as a fraction. Fractions are of the day's real length — a DST
// day is 23 or 25 hours and dividing by its actual span keeps marks at the
// wall-clock position parents expect. `nowFrac` is set on today only, so
// the chart can show where "now" is instead of letting the rest of today
// read as hours of no sleep.
export function computeDayRhythm(feeds, sleeps = [], dayCount = 7) {
  const days = []
  for (let i = dayCount - 1; i >= 0; i--) {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    d.setDate(d.getDate() - i)
    days.push(d)
  }
  const nowTs = Date.now()

  return days.map(dayStart => {
    const dayEnd = new Date(dayStart)
    dayEnd.setDate(dayEnd.getDate() + 1)
    const startMs = dayStart.getTime()
    const endMs   = dayEnd.getTime()
    const dayMs   = endMs - startMs
    const frac    = (ts) => (ts - startMs) / dayMs

    const sleepSegs = []
    sleeps.forEach(s => {
      if (!s.startedAt || !s.endedAt) return
      const a = new Date(s.startedAt).getTime()
      const b = new Date(s.endedAt).getTime()
      if (Number.isNaN(a) || Number.isNaN(b)) return
      const from = Math.max(a, startMs)
      const to   = Math.min(b, endMs)
      if (to <= from) return
      sleepSegs.push({ from: frac(from), to: frac(to) })
    })
    sleepSegs.sort((x, y) => x.from - y.from)

    const feedMarks = feeds
      .map(f => new Date(f.startedAt).getTime())
      .filter(ts => !Number.isNaN(ts) && ts >= startMs && ts < endMs)
      .map(frac)
      .sort((a, b) => a - b)

    const isToday = nowTs >= startMs && nowTs < endMs
    return {
      key: dateStr(dayStart.toISOString()),
      label: dayStart.toLocaleDateString('en-GB', { weekday: 'short' }),
      isToday,
      nowFrac: isToday ? frac(nowTs) : null,
      sleeps: sleepSegs,
      feeds: feedMarks,
      hasData: sleepSegs.length > 0 || feedMarks.length > 0,
    }
  })
}

// Last-7-days insight rows and totals for the weekly insights panel.
export function computeWeeklyInsights(feeds, nappies, medicines, sleeps = []) {
  const days = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    d.setDate(d.getDate() - i)
    days.push(d)
  }

  const byDay = Object.fromEntries(days.map(d => [dateStr(d.toISOString()), { feeds: 0, breastFeeds: 0, feedMins: 0, bottleFeeds: 0, bottleMl: 0, meds: 0, wet: 0, dirty: 0, sleepSecs: 0, moodTotal: 0, moodCount: 0 }]))
  feeds.forEach(s => {
    const k = dayKey(s.startedAt)
    if (!byDay[k]) return
    byDay[k].feeds += 1
    // Duration averages stay breast-only; bottle feeds contribute ml instead
    if (isBottleFeed(s)) {
      byDay[k].bottleFeeds += 1
      byDay[k].bottleMl += s.amountMl || 0
    } else {
      byDay[k].breastFeeds += 1
      byDay[k].feedMins += Math.round((s.durationSecs || 0) / 60)
    }
    if (Number(s.mood) > 0) {
      byDay[k].moodTotal += Number(s.mood)
      byDay[k].moodCount += 1
    }
  })
  medicines.forEach(m => {
    const k = dayKey(m.loggedAt)
    if (!byDay[k]) return
    byDay[k].meds += 1
  })
  nappies.forEach(n => {
    const k = dayKey(n.loggedAt)
    if (!byDay[k]) return
    if (n.type === 'wet' || n.type === 'both') byDay[k].wet += 1
    if (n.type === 'poo' || n.type === 'both') byDay[k].dirty += 1
  })
  // Sleep is clamped to each calendar day, so an overnight sleep contributes
  // its pre-midnight portion to one row and the rest to the next.
  days.forEach(d => {
    byDay[dateStr(d.toISOString())].sleepSecs = sleepSecsOnDay(sleeps, d)
  })

  const rows = days.map(d => {
    const k = dateStr(d.toISOString())
    const v = byDay[k]
    return {
      key: k,
      label: d.toLocaleDateString('en-GB', { weekday: 'short' }),
      ...v,
      mood: v.moodCount ? feedMoodMeta(v.moodTotal / v.moodCount) : null,
    }
  })

  const totalFeeds       = rows.reduce((a, r) => a + r.feeds, 0)
  const totalBreastFeeds = rows.reduce((a, r) => a + r.breastFeeds, 0)
  const totalBottleFeeds = rows.reduce((a, r) => a + r.bottleFeeds, 0)
  const totalBottleMl    = rows.reduce((a, r) => a + r.bottleMl, 0)
  const totalMeds  = rows.reduce((a, r) => a + r.meds, 0)
  const totalWet   = rows.reduce((a, r) => a + r.wet, 0)
  const totalDirty = rows.reduce((a, r) => a + r.dirty, 0)
  // Averaged over days that have sleep logged, so a half-tracked week
  // doesn't drag the figure down to something misleading.
  const sleepDays = rows.filter(r => r.sleepSecs > 0)
  const avgSleepSecsPerDay = sleepDays.length
    ? Math.round(sleepDays.reduce((a, r) => a + r.sleepSecs, 0) / sleepDays.length)
    : null
  const ratedFeeds = rows.reduce((a, r) => a + r.moodCount, 0)
  const avgFeedMins = totalBreastFeeds ? Math.round(rows.reduce((a, r) => a + r.feedMins, 0) / totalBreastFeeds) : 0
  const avgMood = ratedFeeds ? feedMoodMeta(rows.reduce((a, r) => a + r.moodTotal, 0) / ratedFeeds) : null
  const peakFeeds = Math.max(1, ...rows.map(r => r.feeds))
  const nowTs = Date.now()
  const sortedFeeds = feeds
    .map(s => new Date(s.startedAt).getTime())
    .filter(ts => !Number.isNaN(ts) && ts >= days[0].getTime() && ts <= nowTs)
    .sort((a, b) => a - b)
  const avgGapMins = sortedFeeds.length > 1
    ? Math.round(sortedFeeds.slice(1).reduce((acc, ts, idx) => acc + (ts - sortedFeeds[idx]), 0) / (sortedFeeds.length - 1) / 60000)
    : null

  return { rows, totalFeeds, totalBreastFeeds, totalBottleFeeds, totalBottleMl, totalMeds, totalWet, totalDirty, avgSleepSecsPerDay, avgFeedMins, avgMood, ratedFeeds, peakFeeds, avgGapMins }
}
