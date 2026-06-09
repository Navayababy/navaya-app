// Pure stats/insights calculations shared by HistoryScreen.
// Kept free of React so they can be unit-tested directly.

import { dateStr, dayKey } from '../utils/time.js'
import { MOOD_EMOJI, MOOD_LABEL } from './constants.js'

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

// Last-7-days insight rows and totals for the weekly insights panel.
export function computeWeeklyInsights(feeds, nappies, medicines) {
  const days = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    d.setDate(d.getDate() - i)
    days.push(d)
  }

  const byDay = Object.fromEntries(days.map(d => [dateStr(d.toISOString()), { feeds: 0, feedMins: 0, meds: 0, dirty: 0, moodTotal: 0, moodCount: 0 }]))
  feeds.forEach(s => {
    const k = dayKey(s.startedAt)
    if (!byDay[k]) return
    byDay[k].feeds += 1
    byDay[k].feedMins += Math.round((s.durationSecs || 0) / 60)
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
    if (n.type === 'poo' || n.type === 'both') byDay[k].dirty += 1
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

  const totalFeeds = rows.reduce((a, r) => a + r.feeds, 0)
  const totalMeds  = rows.reduce((a, r) => a + r.meds, 0)
  const totalDirty = rows.reduce((a, r) => a + r.dirty, 0)
  const ratedFeeds = rows.reduce((a, r) => a + r.moodCount, 0)
  const avgFeedMins = totalFeeds ? Math.round(rows.reduce((a, r) => a + r.feedMins, 0) / totalFeeds) : 0
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

  return { rows, totalFeeds, totalMeds, totalDirty, avgFeedMins, avgMood, ratedFeeds, peakFeeds, avgGapMins }
}
