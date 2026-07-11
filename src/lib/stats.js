// Pure stats/insights calculations shared by HistoryScreen.
// Kept free of React so they can be unit-tested directly.

import { dateStr, dayKey } from '../utils/time.js'
import { MOOD_EMOJI, MOOD_LABEL, SLEEP_DAY_START_HOUR, NIGHT_START_HOUR } from './constants.js'
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

// Seconds of [startedAt, endedAt] that fall inside [winStart, winEnd) —
// the shared clamping primitive behind every windowed sleep total below.
export function secsOverlapping(startedAt, endedAt, winStart, winEnd) {
  const start = Math.max(new Date(startedAt).getTime(), new Date(winStart).getTime())
  const end   = Math.min(new Date(endedAt).getTime(), new Date(winEnd).getTime())
  return Math.max(0, Math.round((end - start) / 1000))
}

// ── Sleep-day model ──────────────────────────────────────────────────────
// A "sleep day" runs SLEEP_DAY_START_HOUR → SLEEP_DAY_START_HOUR the next
// morning (07:00→07:00 by default), so a night's sleep belongs wholly to
// the evening it started rather than being split at the midnight boundary —
// see docs/plans/sleep-tracking-clarity.md for the rationale. Within a
// sleep day, NIGHT_START_HOUR (19:00) splits nap time from night time.

// The 07:00 boundary of the sleep-day containing `at` — an instant before
// 07:00 belongs to the previous calendar day's sleep-day.
export function sleepDayStart(at = new Date()) {
  const d = new Date(at)
  const beforeDayStart = d.getHours() < SLEEP_DAY_START_HOUR
  d.setHours(SLEEP_DAY_START_HOUR, 0, 0, 0)
  if (beforeDayStart) d.setDate(d.getDate() - 1)
  return d
}

function sleepsOverlapping(sleeps, winStart, winEnd) {
  return sleeps.reduce((a, s) => {
    if (!s.startedAt || !s.endedAt) return a
    const secs = secsOverlapping(s.startedAt, s.endedAt, winStart, winEnd)
    return Number.isNaN(secs) ? a : a + secs
  }, 0)
}

// Total seconds of sleep in sleep-day D: [D 07:00, D+1 07:00)
export function sleepSecsOnSleepDay(sleeps, day = new Date()) {
  const winStart = sleepDayStart(day)
  const winEnd = new Date(winStart)
  winEnd.setDate(winEnd.getDate() + 1)
  return sleepsOverlapping(sleeps, winStart, winEnd)
}

// Nap portion of sleep-day D: [D 07:00, D 19:00)
export function napSecsOnSleepDay(sleeps, day = new Date()) {
  const winStart = sleepDayStart(day)
  const winEnd = new Date(winStart)
  winEnd.setHours(NIGHT_START_HOUR, 0, 0, 0)
  return sleepsOverlapping(sleeps, winStart, winEnd)
}

// Night portion of sleep-day D: [D 19:00, D+1 07:00)
export function nightSecsOfSleepDay(sleeps, day = new Date()) {
  const dayStart = sleepDayStart(day)
  const winStart = new Date(dayStart)
  winStart.setHours(NIGHT_START_HOUR, 0, 0, 0)
  const winEnd = new Date(dayStart)
  winEnd.setDate(winEnd.getDate() + 1)
  return sleepsOverlapping(sleeps, winStart, winEnd)
}

// The most recently *started* night window relative to `now`: tonight's
// (in progress) once NIGHT_START_HOUR has passed, otherwise last night's
// (already ended at this morning's day-start).
export function latestNightSleep(sleeps, now = new Date()) {
  const dayStart = sleepDayStart(now)
  const nightStart = new Date(dayStart)
  nightStart.setHours(NIGHT_START_HOUR, 0, 0, 0)

  let start, end
  if (now >= nightStart) {
    start = nightStart
    end = new Date(dayStart)
    end.setDate(end.getDate() + 1)
  } else {
    end = dayStart
    start = new Date(dayStart)
    start.setDate(start.getDate() - 1)
    start.setHours(NIGHT_START_HOUR, 0, 0, 0)
  }

  const secs = sleepsOverlapping(sleeps, start, end)
  return { start, end, secs, inProgress: now < end }
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

  const byDay = Object.fromEntries(days.map(d => [dateStr(d.toISOString()), { feeds: 0, breastFeeds: 0, feedMins: 0, bottleFeeds: 0, bottleMl: 0, meds: 0, wet: 0, dirty: 0, moodTotal: 0, moodCount: 0 }]))
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
  // Sleep uses its own "sleep day" axis (07:00→07:00, see sleepDayStart) so a
  // night belongs wholly to the evening it started rather than being split
  // at midnight. Built one day longer (offset 7) so the average below can
  // draw on 7 *complete* sleep days without today's still-in-progress one.
  const sleepDayOffsets = []
  for (let i = 7; i >= 0; i--) {
    const d = new Date()
    // Normalized to noon so each offset represents that calendar day itself,
    // not "now" — otherwise, before 07:00, every offset's hour would fall
    // before SLEEP_DAY_START_HOUR and sleepDayStart would shift all of them
    // back by an extra day, uniformly mislabeling which day each total sits under.
    d.setHours(12, 0, 0, 0)
    d.setDate(d.getDate() - i)
    sleepDayOffsets.push(d)
  }
  const sleepDayTotals = sleepDayOffsets.map(d => sleepSecsOnSleepDay(sleeps, d))
  const completeSleepDayTotals = sleepDayTotals.slice(0, 7) // offsets 7…1
  const displaySleepDayTotals  = sleepDayTotals.slice(1)    // offsets 6…0, aligned with `rows`

  const rows = days.map((d, i) => {
    const k = dateStr(d.toISOString())
    const v = byDay[k]
    return {
      key: k,
      label: d.toLocaleDateString('en-GB', { weekday: 'short' }),
      ...v,
      sleepSecs: displaySleepDayTotals[i],
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
  // Averaged over the 7 most recent *complete* sleep days that have sleep
  // logged: today's still-in-progress sleep day never counts (it can only
  // hold a partial night or a few naps so far), and a half-tracked week
  // doesn't drag the figure down to something misleading either.
  const completeSleepDays = completeSleepDayTotals.filter(secs => secs > 0)
  const avgSleepSecsPerDay = completeSleepDays.length
    ? Math.round(completeSleepDays.reduce((a, s) => a + s, 0) / completeSleepDays.length)
    : null
  const ratedFeeds = rows.reduce((a, r) => a + r.moodCount, 0)
  const avgFeedMins = totalBreastFeeds ? Math.round(rows.reduce((a, r) => a + r.feedMins, 0) / totalBreastFeeds) : 0
  const avgMood = ratedFeeds ? feedMoodMeta(rows.reduce((a, r) => a + r.moodTotal, 0) / ratedFeeds) : null
  const nowTs = Date.now()
  const sortedFeeds = feeds
    .map(s => new Date(s.startedAt).getTime())
    .filter(ts => !Number.isNaN(ts) && ts >= days[0].getTime() && ts <= nowTs)
    .sort((a, b) => a - b)
  const avgGapMins = sortedFeeds.length > 1
    ? Math.round(sortedFeeds.slice(1).reduce((acc, ts, idx) => acc + (ts - sortedFeeds[idx]), 0) / (sortedFeeds.length - 1) / 60000)
    : null

  return { rows, totalFeeds, totalBreastFeeds, totalBottleFeeds, totalBottleMl, totalMeds, totalWet, totalDirty, avgSleepSecsPerDay, avgFeedMins, avgMood, ratedFeeds, avgGapMins }
}
