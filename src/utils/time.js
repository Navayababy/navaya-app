// Shared time-formatting utilities used across screens.
// Functions accept ISO strings, Date objects, or nothing (defaults to now).

export function fmt(secs) {
  const m = Math.floor(secs / 60)
  const s = secs % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export function fmtMins(secs) {
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

export function fmtSince(isoString) {
  if (!isoString) return null
  const diff = Math.floor((Date.now() - new Date(isoString).getTime()) / 1000)
  if (diff < 60) return 'just now'
  // Beyond a day, hour counts stop being readable ("350h") — switch to days
  const days = Math.floor(diff / 86400)
  if (days >= 1) return days === 1 ? '1 day' : `${days} days`
  const h = Math.floor(diff / 3600)
  const m = Math.floor((diff % 3600) / 60)
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

export function timeAgo(isoString) {
  if (!isoString) return ''
  const diff = Math.floor((Date.now() - new Date(isoString).getTime()) / 1000)
  if (diff < 60)   return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  // Beyond a day, hour counts stop being readable ("350h ago") — switch to days
  const days = Math.floor(diff / 86400)
  if (days >= 1) return days === 1 ? '1 day ago' : `${days} days ago`
  return `${Math.floor(diff / 3600)}h ${Math.floor((diff % 3600) / 60)}m ago`
}

export function dayLabel(isoString) {
  const d = new Date(isoString)
  const today     = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)
  if (d.toDateString() === today.toDateString())     return 'Today'
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday'
  return d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' })
}

// Short day label for list rows: 'Today' | 'Yesterday' | '8 Jun'
export function dayShort(isoString) {
  const d = new Date(isoString)
  const today     = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)
  if (d.toDateString() === today.toDateString())     return 'Today'
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday'
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

// Absolute timestamp for list rows: '14:32' today, 'Yesterday 14:32',
// or '8 Jun · 14:32' for older entries.
export function fmtDayTime(isoString) {
  const time = timeStr(isoString)
  const day  = dayShort(isoString)
  if (day === 'Today') return time
  if (day === 'Yesterday') return `Yesterday ${time}`
  return `${day} · ${time}`
}

// Accepts ISO string, Date object, or nothing (defaults to current time).
export function timeStr(isoOrDate = new Date()) {
  const d = isoOrDate instanceof Date ? isoOrDate : new Date(isoOrDate)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

// Accepts ISO string, Date object, or nothing (defaults to today).
export function dateStr(isoOrDate = new Date()) {
  const d = isoOrDate instanceof Date ? isoOrDate : new Date(isoOrDate)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function buildISO(dateVal, timeVal) {
  const [y, mo, d] = dateVal.split('-').map(Number)
  const [h, m]     = timeVal.split(':').map(Number)
  return new Date(y, mo - 1, d, h, m, 0, 0).toISOString()
}

// Same as buildISO, but for callers that build a *live* preview from
// controlled date/time inputs on every render: a native date or time input
// reports its value as '' while the user is mid-edit (cleared, about to
// retype), and buildISO('', ...) constructs an Invalid Date whose
// toISOString() throws — which, called from render, would crash the whole
// screen. Returns null for anything incomplete or unparseable instead of
// throwing, so callers can treat "still typing" as a distinct, safe state.
export function tryBuildISO(dateVal, timeVal) {
  if (!dateVal || !timeVal) return null
  const [y, mo, d] = dateVal.split('-').map(Number)
  const [h, m]     = timeVal.split(':').map(Number)
  if (![y, mo, d, h, m].every(Number.isFinite)) return null
  const date = new Date(y, mo - 1, d, h, m, 0, 0)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

// Rebuilds a corrected time-of-day into a full timestamp, choosing whichever
// calendar date (the reference instant's day, or the day before/after) lands
// closest to that reference. A correction that crosses a midnight boundary —
// in either direction — otherwise silently keeps the original, wrong date,
// which is exactly the case a same-day rebuild via buildISO(dateStr(ref), ...)
// gets wrong.
export function nearestDateForTime(referenceIso, timeVal) {
  const ref = new Date(referenceIso)
  const candidates = [-1, 0, 1].map(offset => {
    const d = new Date(ref)
    d.setDate(d.getDate() + offset)
    return buildISO(dateStr(d), timeVal)
  })
  return candidates.reduce((best, candidate) =>
    Math.abs(new Date(candidate) - ref) < Math.abs(new Date(best) - ref) ? candidate : best
  )
}

export function todayDateStr() {
  return dateStr()
}

export function dayKey(isoString) {
  return dateStr(isoString)
}
