import { useState, useMemo } from 'react'
import { brand, palette } from '../theme.js'
import { getSessions, getNappies, getMedicines, updateSession, deleteSession, addSession, deleteNappy, addNappy, addMedicine, deleteMedicine } from '../lib/storage.js'
import { updateFeedSession, deleteFeedSession, insertFeedSession, insertNappyLog, deleteNappyLog, insertMedicineLog, deleteMedicineLog } from '../lib/db.js'
import { fmt, fmtMins, dayLabel, timeStr, dateStr, todayDateStr, dayKey } from '../utils/time.js'
import { normalizeFeedSession, normalizeNappy, normalizeMedicine } from '../lib/normalize.js'
import { MOOD_EMOJI, MOOD_LABEL, POO_HEX, POO_LABEL, POO_COLORS } from '../lib/constants.js'
import EditFeedModal from '../components/modals/EditFeedModal.jsx'
import AddFeedModal from '../components/modals/AddFeedModal.jsx'
import AddNappyModal from '../components/modals/AddNappyModal.jsx'
import AddMedicineModal from '../components/modals/AddMedicineModal.jsx'


function feedMoodMeta(score) {
  if (!score) return null
  const rounded = Math.min(5, Math.max(1, Math.round(score)))
  return { score, rounded, emoji: MOOD_EMOJI[rounded - 1], label: MOOD_LABEL[rounded - 1] }
}

function averageFeedMood(feeds) {
  const rated = feeds.filter(feed => Number(feed.mood) > 0)
  if (!rated.length) return null
  const average = rated.reduce((total, feed) => total + Number(feed.mood), 0) / rated.length
  return { ...feedMoodMeta(average), count: rated.length }
}

function getEntryCreatorId(entry) {
  return entry?.loggedBy || entry?.createdBy || entry?.partnerId || entry?.logged_by || entry?.created_by || entry?.partner_id || null
}

function PartnerAttributionIndicator({ entry, sharedMode, authUser }) {
  const creatorId = getEntryCreatorId(entry)
  if (!sharedMode || !creatorId) return null
  const dotColour = creatorId === authUser?.id ? brand.accent : brand.green
  const label = creatorId === authUser?.id ? 'Logged by you' : 'Logged by partner'

  return (
    <span
      aria-label={label}
      title={label}
      style={{ width: 7, height: 7, borderRadius: '50%', background: dotColour, flexShrink: 0, marginRight: 6 }}
    />
  )
}


// ── Main screen ───────────────────────────────────────────────────────────────
export default function HistoryScreen({ night, authUser, profile, sharedSessions, sharedNappies, sharedMedicines, onRefreshSessions, onRefreshNappies, onRefreshMedicines }) {
  const p = palette(night)
  const sharedMode = !!(profile?.household_id && sharedSessions)

  const [sessions,    setSessions]    = useState(() => getSessions())
  const [nappies,     setNappies]     = useState(() => getNappies())
  const [medicines,   setMedicines]   = useState(() => getMedicines())

  const nappyList    = sharedMode && sharedNappies   ? sharedNappies.map(normalizeNappy)     : nappies
  const medicineList = sharedMode && sharedMedicines ? sharedMedicines.map(normalizeMedicine) : medicines
  const [openDay,     setOpenDay]     = useState(null)
  const [editSession, setEditSession] = useState(null)
  const [addMode,     setAddMode]     = useState(null)   // null | 'picker' | 'feed' | 'nappy' | 'medicine'
  const [confirmDel,  setConfirmDel]  = useState(null)   // { id, type }
  const [showInsights, setShowInsights] = useState(false)

  const feeds = sharedMode
    ? sharedSessions.map(normalizeFeedSession)
    : sessions

  // ── Merge all entry types into one sorted timeline ────────────────────────
  const allEntries = useMemo(() => {
    const f = feeds.map(s      => ({ ...s, _type: 'feed',     _time: s.startedAt }))
    const n = nappyList.map(n  => ({ ...n, _type: 'nappy',    _time: n.loggedAt  }))
    const m = medicineList.map(m => ({ ...m, _type: 'medicine', _time: m.loggedAt }))
    return [...f, ...n, ...m].sort((a, b) => new Date(b._time) - new Date(a._time))
  }, [feeds, nappyList, medicineList])

  const grouped = useMemo(() => {
    const map = {}
    allEntries.forEach(entry => {
      const key = new Date(entry._time).toDateString()
      if (!map[key]) map[key] = { label: dayLabel(entry._time), entries: [] }
      map[key].entries.push(entry)
    })
    return Object.values(map)
  }, [allEntries])

  // ── Stats ─────────────────────────────────────────────────────────────────
  const todayStart = useMemo(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d }, [])

  const feedsToday = useMemo(() =>
    feeds.filter(s => new Date(s.startedAt) >= todayStart)
  , [feeds, todayStart])

  const feedTimeTodaySecs = useMemo(() =>
    feedsToday.reduce((a, s) => a + (s.durationSecs || 0), 0)
  , [feedsToday])

  const wetToday = useMemo(() =>
    nappyList.filter(n => new Date(n.loggedAt) >= todayStart && (n.type === 'wet' || n.type === 'both')).length
  , [nappyList, todayStart])

  const dirtyToday = useMemo(() =>
    nappyList.filter(n => new Date(n.loggedAt) >= todayStart && (n.type === 'poo' || n.type === 'both')).length
  , [nappyList, todayStart])

  const weekFeeds = useMemo(() => {
    const now    = new Date()
    const monday = new Date(now)
    monday.setHours(0, 0, 0, 0)
    monday.setDate(now.getDate() - (now.getDay() + 6) % 7)
    return feeds.filter(s => new Date(s.startedAt) >= monday)
  }, [feeds])

  const weekAvgDuration = useMemo(() => {
    if (!weekFeeds.length) return 0
    return Math.round(weekFeeds.reduce((a, s) => a + (s.durationSecs || 0), 0) / weekFeeds.length)
  }, [weekFeeds])

  const leftCount  = weekFeeds.filter(s => s.side === 'L').length
  const rightCount = weekFeeds.filter(s => s.side === 'R').length
  const weekMood   = useMemo(() => averageFeedMood(weekFeeds), [weekFeeds])

  const fmtGap = (mins) => {
    if (mins == null) return '—'
    const h = Math.floor(mins / 60)
    const m = mins % 60
    if (!h) return `${m}m`
    return m ? `${h}h ${m}m` : `${h}h`
  }

  const insights = useMemo(() => {
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
    medicineList.forEach(m => {
      const k = dayKey(m.loggedAt)
      if (!byDay[k]) return
      byDay[k].meds += 1
    })
    nappyList.forEach(n => {
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
  }, [feeds, nappyList, medicineList])

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handleSaveEdit = async (id, changes) => {
    setSessions(updateSession(id, changes))
    if (sharedMode) {
      await updateFeedSession(id, {
        side:        changes.side,
        startedAt:   changes.startedAt,
        endedAt:     changes.endedAt,
        durationSecs: changes.durationSecs,
        moodScore:   changes.mood ?? null,
      })
      onRefreshSessions?.()
    }
    setEditSession(null)
  }

  const handleDeleteFeed = async (id) => {
    setSessions(deleteSession(id))
    if (sharedMode) {
      await deleteFeedSession(id)
      onRefreshSessions?.()
    }
    setEditSession(null)
  }

  const handleAddFeed = (session) => {
    setSessions(addSession(session))
    if (sharedMode && authUser && profile?.household_id) {
      insertFeedSession({
        householdId:  profile.household_id,
        babyId:       null,
        loggedBy:     authUser.id,
        startedAt:    session.startedAt,
        endedAt:      session.endedAt,
        durationSecs: session.durationSecs,
        side:         session.side,
        moodScore:    session.mood ?? null,
      }).then(() => onRefreshSessions?.())
    }
    setAddMode(null)
  }

  const handleAddNappy = (nappy) => {
    setNappies(addNappy(nappy))
    if (sharedMode && authUser && profile?.household_id) {
      insertNappyLog({ householdId: profile.household_id, loggedBy: authUser.id, type: nappy.type, pooColor: nappy.pooColor, loggedAt: nappy.loggedAt })
        .then(() => onRefreshNappies?.())
    }
    setAddMode(null)
  }

  const handleAddMedicine = (medicine) => {
    setMedicines(addMedicine(medicine))
    if (sharedMode && authUser && profile?.household_id) {
      insertMedicineLog({ householdId: profile.household_id, loggedBy: authUser.id, ...medicine, loggedAt: medicine.loggedAt })
        .then(() => onRefreshMedicines?.())
    }
    setAddMode(null)
  }

  const handleDelete = async ({ id, type }) => {
    if (type === 'nappy') {
      setNappies(deleteNappy(id))
      if (sharedMode) { await deleteNappyLog(id); onRefreshNappies?.() }
    }
    if (type === 'medicine') {
      setMedicines(deleteMedicine(id))
      if (sharedMode) { await deleteMedicineLog(id); onRefreshMedicines?.() }
    }
    setConfirmDel(null)
  }

  // ── Day summary line ──────────────────────────────────────────────────────
  function daySummary(entries) {
    const feeds   = entries.filter(e => e._type === 'feed').length
    const nappies = entries.filter(e => e._type === 'nappy').length
    const meds    = entries.filter(e => e._type === 'medicine').length
    const feedDur = entries.filter(e => e._type === 'feed').reduce((a, e) => a + (e.durationSecs || 0), 0)
    const mood    = averageFeedMood(entries.filter(e => e._type === 'feed'))
    const parts   = []
    if (feeds   > 0) parts.push(`${feeds} feed${feeds !== 1 ? 's' : ''}`)
    if (nappies > 0) parts.push(`${nappies} napp${nappies !== 1 ? 'ies' : 'y'}`)
    if (meds > 0) parts.push(`${meds} med${meds !== 1 ? 's' : ''}`)
    if (feedDur > 0) parts.push(fmtMins(feedDur))
    if (mood) parts.push(`${mood.emoji} ${mood.label} avg`)
    return parts.join(' · ')
  }

  return (
    <div style={{ flex: 1, overflowY: 'auto', background: p.bg }}>

      <div style={{ padding: '20px 16px 12px', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <div>
          <span style={{ display: 'block', fontFamily: "'Cormorant Garamond', serif", fontSize: 12, color: brand.sand, letterSpacing: '.12em', textTransform: 'uppercase' }}>
            {sharedMode ? 'Shared logbook' : 'Your journey'}
          </span>
          <span style={{ display: 'block', fontFamily: "'Cormorant Garamond', serif", fontSize: 26, fontWeight: 400, color: p.heading, marginTop: 2 }}>Logbook</span>
          {sharedMode && (
            <div style={{ display: 'flex', gap: 12, marginTop: 6 }}>
              <span style={{ fontSize: 11, color: p.sub, display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: brand.accent, display: 'inline-block', flexShrink: 0 }} />
                You
              </span>
              <span style={{ fontSize: 11, color: p.sub, display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: brand.green, display: 'inline-block', flexShrink: 0 }} />
                Partner
              </span>
            </div>
          )}
        </div>
        <button onClick={() => setAddMode('picker')} style={{ width: 36, height: 36, borderRadius: '50%', background: brand.bark, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 4 }}>
          <span style={{ color: brand.sand, fontSize: 22, lineHeight: 1, marginTop: -1 }}>+</span>
        </button>
      </div>

      {/* ── Today stats ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8, padding: '0 14px 8px' }}>
        {[
          { val: feedsToday.length.toString(), lbl: 'feeds today',  sub: feedTimeTodaySecs > 0 ? fmtMins(feedTimeTodaySecs) : null },
          { val: wetToday.toString(),          lbl: 'wet today',    sub: null },
          { val: dirtyToday.toString(),        lbl: 'dirty today',  sub: null },
        ].map(({ val, lbl, sub }) => (
          <div key={lbl} style={{ background: p.card, borderRadius: 13, padding: '12px 10px', border: `1px solid ${p.border}`, textAlign: 'left' }}>
            <span style={{ display: 'block', fontSize: 10, color: p.sub, lineHeight: 1.2, textTransform: 'uppercase', letterSpacing: '.08em' }}>{lbl}</span>
            <span style={{ display: 'block', fontFamily: "'Cormorant Garamond', serif", fontSize: 24, lineHeight: 1, color: p.heading, marginTop: 6 }}>{val}</span>
            {sub && <span style={{ display: 'block', fontSize: 10, color: p.sub, opacity: 0.85, marginTop: 6 }}>{sub}</span>}
          </div>
        ))}
      </div>

      <div style={{ padding: '0 14px 10px' }}>
        <button onClick={() => setShowInsights(v => !v)} style={{ width: '100%', border: `1px solid ${p.border}`, borderRadius: 12, background: p.card, color: p.text, padding: '10px 12px', fontSize: 12, fontWeight: 500, cursor: 'pointer' }}>
          {showInsights ? 'Back to logbook' : 'View weekly insights'}
        </button>
      </div>

      {showInsights && (
        <div style={{ margin: '0 14px 14px', background: `linear-gradient(180deg, ${p.card} 0%, ${night ? '#211A15' : '#FFFCF8'} 100%)`, borderRadius: 20, border: `1px solid ${p.border}`, padding: '16px 14px 14px', boxShadow: night ? '0 16px 38px rgba(0,0,0,0.18)' : '0 18px 42px rgba(74,55,40,0.07)' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 16 }}>
            <div>
              <span style={{ display: 'block', fontSize: 11, color: p.sub, textTransform: 'uppercase', letterSpacing: '.14em', marginBottom: 5 }}>
                Last 7 days
              </span>
              <span style={{ display: 'block', fontFamily: "'Cormorant Garamond', serif", fontSize: 23, lineHeight: 1, color: p.heading }}>
                Feeding rhythm
              </span>
            </div>
            <div style={{ width: 84, height: 84, borderRadius: '50%', background: night ? '#30271F' : '#F3E9DD', border: `1px solid ${p.border}`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', flexShrink: 0 }}>
              <span style={{ display: 'block', fontSize: 42, lineHeight: 0.9, color: p.text, fontWeight: 600 }}>{insights.totalFeeds}</span>
              <span style={{ display: 'block', fontSize: 11, color: p.sub, marginTop: 1 }}>feeds</span>
            </div>
          </div>

          <div style={{ position: 'relative', minHeight: 196, padding: '10px 4px 8px', borderRadius: 16, background: night ? 'rgba(255,255,255,0.025)' : 'rgba(255,255,255,0.48)', border: `1px solid ${night ? 'rgba(237,229,216,0.06)' : 'rgba(237,229,216,0.65)'}` }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', alignItems: 'end', gap: 8, height: '100%' }}>
              {insights.rows.map(r => {
                const isToday = r.key === todayDateStr()
                const barHeight = r.feeds ? 34 + (r.feeds / insights.peakFeeds) * 72 : 6
                return (
                  <div key={r.key} style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', minWidth: 0 }}>
                    <span style={{ minHeight: 18, fontSize: 14, lineHeight: 1, marginBottom: 6 }}>{r.mood?.emoji || ''}</span>
                    <div style={{ width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'flex-end', height: 108 }}>
                      <div style={{ width: isToday ? 30 : 22, height: barHeight, borderRadius: 999, background: r.feeds ? (isToday ? brand.bark : '#7A614E') : (night ? '#342B24' : '#E7DED3'), boxShadow: isToday && r.feeds ? '0 10px 22px rgba(74,55,40,0.18)' : 'none', opacity: r.feeds ? 1 : 0.9 }} />
                    </div>
                    <span style={{ display: 'block', fontSize: 10, color: isToday ? p.text : p.sub, fontWeight: isToday ? 700 : 500, marginTop: 8, lineHeight: 1.2 }}>{isToday ? 'Today' : r.label}</span>
                    <span style={{ display: 'block', fontSize: 11, color: r.feeds ? p.text : p.sub, fontWeight: r.feeds ? 700 : 500, marginTop: 2 }}>{r.feeds}</span>
                  </div>
                )
              })}
            </div>
          </div>

          {insights.avgMood && (
            <div style={{ background: night ? '#2A231D' : '#F6EFE7', border: `1px solid ${p.border}`, borderRadius: 16, padding: '12px 13px', marginTop: 12, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ width: 44, height: 44, borderRadius: '50%', background: night ? '#342B24' : '#FFF7EC', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 27, lineHeight: 1, flexShrink: 0 }}>{insights.avgMood.emoji}</span>
              <div style={{ minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: 14, color: p.text, fontWeight: 700 }}>Feeds felt {insights.avgMood.label.toLowerCase()} overall</span>
                <span style={{ display: 'block', fontSize: 11, color: p.sub, marginTop: 2 }}>From {insights.ratedFeeds} rated feed{insights.ratedFeeds !== 1 ? 's' : ''} this week.</span>
              </div>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {[
              { label: 'Avg feed', value: `${insights.avgFeedMins}m` },
              { label: 'Medicine', value: insights.totalMeds },
              { label: 'Dirty nappies', value: insights.totalDirty },
              { label: 'Avg gap', value: fmtGap(insights.avgGapMins) },
            ].map(item => (
              <div key={item.label} style={{ background: p.bg, border: `1px solid ${p.border}`, borderRadius: 14, padding: '11px 12px' }}>
                <span style={{ display: 'block', fontSize: 10, color: p.sub }}>{item.label}</span>
                <span style={{ display: 'block', fontSize: 18, lineHeight: 1.1, color: p.text, marginTop: 5, fontWeight: 600 }}>{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── This week summary ── */}
      {!showInsights && weekFeeds.length > 0 && (
        <div style={{ margin: '0 14px 14px', background: p.card, borderRadius: 10, border: `1px solid ${p.border}`, padding: '10px 12px' }}>
          <span style={{ fontSize: 11, color: p.sub, lineHeight: 1.5 }}>
            {'This week · '}
            <span style={{ color: p.text, fontWeight: 500 }}>{weekFeeds.length} feed{weekFeeds.length !== 1 ? 's' : ''}</span>
            {weekAvgDuration > 0 && <>{' · avg '}<span style={{ color: p.text, fontWeight: 500 }}>{fmtMins(weekAvgDuration)}</span>{' each'}</>}
            {weekMood && <>{' · feel: '}<span style={{ color: p.text, fontWeight: 500 }}>{weekMood.emoji} {weekMood.label}</span></>}
            {(leftCount + rightCount) > 0 && <>{' · L/R: '}<span style={{ color: p.text, fontWeight: 500 }}>{leftCount}/{rightCount}</span></>}
          </span>
        </div>
      )}

      {/* ── Day groups ── */}
      {!showInsights && (grouped.length === 0 ? (
        <div style={{ padding: '20px 14px' }}>
          <span style={{ fontSize: 13, color: p.sub }}>No entries yet. Your history will appear here.</span>
        </div>
      ) : (
        grouped.map(group => {
          const isOpen = openDay === group.label
          return (
            <div key={group.label} style={{ margin: '0 14px 10px', background: p.card, borderRadius: 16, border: `1px solid ${p.border}`, overflow: 'hidden' }}>
              <button onClick={() => setOpenDay(isOpen ? null : group.label)}
                style={{ width: '100%', padding: '14px', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ flex: 1, textAlign: 'left' }}>
                  <span style={{ display: 'block', fontSize: 15, fontWeight: 600, color: p.text }}>{group.label}</span>
                  <span style={{ display: 'block', fontSize: 12, color: p.sub, marginTop: 3 }}>{daySummary(group.entries)}</span>
                </div>
                <span style={{ color: p.sub, fontSize: 14, display: 'inline-block', transform: isOpen ? 'rotate(90deg)' : 'none', transition: 'transform .2s' }}>›</span>
              </button>

              {isOpen && (
                <div style={{ borderTop: `1px solid ${p.border}` }}>
                  {group.entries.map((entry, i) => {
                    const isLast      = i === group.entries.length - 1
                    const borderStyle = isLast ? 'none' : `1px solid ${p.border}`

                    // ── Feed row ──────────────────────────────────────────
                    if (entry._type === 'feed') {
                      const creatorId = getEntryCreatorId(entry)
                      const canEdit = !sharedMode || creatorId === authUser?.id
                      return (
                        <div key={entry.id}
                          style={{ display: 'flex', alignItems: 'center', padding: '10px 14px', borderBottom: borderStyle, cursor: canEdit ? 'pointer' : 'default' }}
                          onClick={() => canEdit && setEditSession(entry)}>
                          <PartnerAttributionIndicator entry={entry} sharedMode={sharedMode} authUser={authUser} />
                          <span style={{ fontSize: 11, color: p.sub, width: 42, flexShrink: 0 }}>{timeStr(entry.startedAt)}</span>
                          <div style={{ width: 26, height: 26, borderRadius: '50%', background: p.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 10px', flexShrink: 0 }}>
                            <span style={{ fontSize: 10, fontWeight: 600, color: p.sub }}>{entry.side}</span>
                          </div>
                          <div style={{ flex: 1 }}>
                            <span style={{ display: 'block', fontSize: 12, color: p.text }}>{entry.side === 'L' ? 'Left' : 'Right'} breast</span>
                            {entry.mood && <span style={{ display: 'block', fontSize: 10, color: p.sub, marginTop: 1 }}>{MOOD_EMOJI[entry.mood - 1]} {MOOD_LABEL[entry.mood - 1]}</span>}
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <span style={{ display: 'block', fontSize: 11, color: p.sub }}>{fmt(entry.durationSecs || 0)}</span>
                            {canEdit && <span style={{ fontSize: 10, color: p.sub, opacity: 0.5 }}>edit</span>}
                          </div>
                        </div>
                      )
                    }

                    // ── Nappy row ─────────────────────────────────────────
                    if (entry._type === 'nappy') {
                      const nappyEmoji = entry.type === 'wet' ? '💧' : entry.type === 'poo' ? '💩' : '💧💩'
                      const nappyLabel = entry.type === 'wet' ? 'Wee' : entry.type === 'poo' ? 'Poo' : 'Wee & Poo'
                      const isDel      = confirmDel?.id === entry.id
                      return (
                        <div key={entry.id} style={{ display: 'flex', alignItems: 'center', padding: '10px 14px', borderBottom: borderStyle }}>
                          <PartnerAttributionIndicator entry={entry} sharedMode={sharedMode} authUser={authUser} />
                          <span style={{ fontSize: 11, color: p.sub, width: 42, flexShrink: 0 }}>{timeStr(entry.loggedAt)}</span>
                          <div style={{ width: 26, height: 26, borderRadius: '50%', background: p.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 10px', flexShrink: 0, fontSize: 13 }}>
                            {nappyEmoji}
                          </div>
                          <div style={{ flex: 1 }}>
                            <span style={{ display: 'block', fontSize: 12, color: p.text }}>{nappyLabel}</span>
                            {entry.pooColor && (
                              <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: p.sub, marginTop: 1 }}>
                                <span style={{ width: 7, height: 7, borderRadius: '50%', background: POO_HEX[entry.pooColor], display: 'inline-block' }} />
                                {POO_LABEL[entry.pooColor]}
                              </span>
                            )}
                          </div>
                          {isDel ? (
                            <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                              <button onClick={() => setConfirmDel(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: p.sub, padding: '2px 6px' }}>Cancel</button>
                              <button onClick={() => handleDelete({ id: entry.id, type: 'nappy' })} style={{ background: '#c0392b', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 11, color: '#fff', padding: '2px 8px', fontWeight: 500 }}>Delete</button>
                            </div>
                          ) : (
                            <button onClick={() => setConfirmDel({ id: entry.id, type: 'nappy' })} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 17, color: p.sub, padding: '0 2px', lineHeight: 1, flexShrink: 0 }}>×</button>
                          )}
                        </div>
                      )
                    }

                    if (entry._type === 'medicine') {
                      const isDel = confirmDel?.id === entry.id
                      return (
                        <div key={entry.id} style={{ display: 'flex', alignItems: 'center', padding: '10px 14px', borderBottom: borderStyle }}>
                          <PartnerAttributionIndicator entry={entry} sharedMode={sharedMode} authUser={authUser} />
                          <span style={{ fontSize: 11, color: p.sub, width: 42, flexShrink: 0 }}>{timeStr(entry.loggedAt)}</span>
                          <div style={{ width: 26, height: 26, borderRadius: '50%', background: p.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 10px', flexShrink: 0, fontSize: 12 }}>
                            💊
                          </div>
                          <div style={{ flex: 1 }}>
                            <span style={{ display: 'block', fontSize: 12, color: p.text }}>{entry.name}{entry.doseMl ? ` · ${entry.doseMl}ml` : ''}</span>
                            {entry.notes && <span style={{ display: 'block', fontSize: 10, color: p.sub, marginTop: 1 }}>{entry.notes}</span>}
                          </div>
                          {isDel ? (
                            <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                              <button onClick={() => setConfirmDel(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: p.sub, padding: '2px 6px' }}>Cancel</button>
                              <button onClick={() => handleDelete({ id: entry.id, type: 'medicine' })} style={{ background: '#c0392b', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 11, color: '#fff', padding: '2px 8px', fontWeight: 500 }}>Delete</button>
                            </div>
                          ) : (
                            <button onClick={() => setConfirmDel({ id: entry.id, type: 'medicine' })} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 17, color: p.sub, padding: '0 2px', lineHeight: 1, flexShrink: 0 }}>×</button>
                          )}
                        </div>
                      )
                    }

                    return null
                  })}
                </div>
              )}
            </div>
          )
        })
      ))}

      <div style={{ height: 20 }} />

      {/* ── Edit feed modal ── */}
      {editSession && (
        <EditFeedModal session={editSession} night={night} onSave={handleSaveEdit} onDelete={handleDeleteFeed} onClose={() => setEditSession(null)} />
      )}

      {/* ── Add type picker ── */}
      {addMode === 'picker' && (
        <div onClick={() => setAddMode(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 100, padding: '0 0 env(safe-area-inset-bottom, 0)' }}>
          <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 430, background: p.card, borderRadius: '20px 20px 0 0', padding: '20px 20px 32px', border: `1px solid ${p.border}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <span style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 20, color: p.heading }}>Add entry</span>
              <button onClick={() => setAddMode(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: p.sub }}>×</button>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              {[
                { mode: 'feed',  icon: '🍼', label: 'Feed'  },
                { mode: 'nappy', icon: '💧', label: 'Nappy' },
                { mode: 'medicine', icon: '💊', label: 'Medicine' },
              ].map(({ mode, icon, label }) => (
                <button key={mode} onClick={() => setAddMode(mode)}
                  style={{ flex: 1, padding: '18px 8px', borderRadius: 14, border: `1px solid ${p.border}`, background: p.bg, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, WebkitTapHighlightColor: 'transparent' }}>
                  <span style={{ fontSize: 26, lineHeight: 1 }}>{icon}</span>
                  <span style={{ fontSize: 13, color: p.text, fontWeight: 500 }}>{label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Add modals ── */}
      {addMode === 'feed'  && <AddFeedModal  night={night} onSave={handleAddFeed}  onClose={() => setAddMode(null)} />}
      {addMode === 'nappy' && <AddNappyModal night={night} onSave={handleAddNappy} onClose={() => setAddMode(null)} />}
      {addMode === 'medicine' && <AddMedicineModal night={night} onSave={handleAddMedicine} onClose={() => setAddMode(null)} />}
    </div>
  )
}
