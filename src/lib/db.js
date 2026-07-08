// lib/db.js
// All Supabase database operations live here.
// Screens import what they need from this file.

import { supabase } from './supabase.js'
import { isUuid } from './id.js'

// ── Auth ──────────────────────────────────────────────────────────────────────

export async function signUp(email, password, displayName) {
  return supabase.auth.signUp({
    email,
    password,
    options: { data: { display_name: displayName } },
  })
}

export async function signIn(email, password) {
  return supabase.auth.signInWithPassword({ email, password })
}

export async function signOut() {
  return supabase.auth.signOut()
}

export async function getSession() {
  const { data } = await supabase.auth.getSession()
  return data.session
}

// ── Profile ───────────────────────────────────────────────────────────────────

export async function getProfile(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()
  return { data, error }
}

export async function updateProfile(userId, updates) {
  const payload = {}
  if (typeof updates?.display_name === 'string') {
    payload.display_name = updates.display_name
  }

  const { data, error } = await supabase
    .from('profiles')
    .update(payload)
    .eq('id', userId)
    .select()
    .single()
  return { data, error }
}

export async function getHouseholdMembers() {
  const { data, error } = await supabase.rpc('get_household_members')
  return { data: data || [], error }
}

// ── Announcements ───────────────────────────────────────────────────────────

// The single highest-priority live banner. RLS already hides inactive and
// out-of-window rows, so the client just picks the top one. Returns null when
// there is nothing to show.
export async function getActiveAnnouncement() {
  const { data, error } = await supabase
    .from('announcements')
    .select('*')
    .order('priority', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(1)
  return { data: data?.[0] || null, error }
}

// ── Household setup ───────────────────────────────────────────────────────────

export async function createHousehold() {
  const { data, error } = await supabase.rpc('create_household_for_current_user')
  return { data: data ? { id: data } : null, error }
}

// ── Baby ──────────────────────────────────────────────────────────────────────

export async function createBaby(householdId, name, dob) {
  const { data, error } = await supabase
    .from('babies')
    .insert({ household_id: householdId, name, dob })
    .select()
    .single()
  return { data, error }
}

export async function getBaby(householdId) {
  const { data, error } = await supabase
    .from('babies')
    .select('*')
    .eq('household_id', householdId)
    .order('created_at', { ascending: true })
    .limit(1)
    .single()
  return { data, error }
}

// ── Partner invite ────────────────────────────────────────────────────────────

export async function createInviteCode() {
  const { data, error } = await supabase.rpc('create_household_invite')
  return { data, error, code: data || null }
}

export async function acceptInvite(code) {
  const { data, error } = await supabase.rpc('accept_household_invite', {
    p_invite_code: code.trim().toUpperCase(),
  })
  return { data: data ? { household_id: data } : null, error }
}

// ── Nappy logs ────────────────────────────────────────────────────────────────

export async function insertNappyLog({ id, householdId, loggedBy, type, pooColor, loggedAt }) {
  const { error } = await supabase
    .from('nappy_logs')
    .insert({ ...(id ? { id } : {}), household_id: householdId, logged_by: loggedBy, type, poo_color: pooColor || null, logged_at: loggedAt })
  return { error }
}

export async function getRecentNappyLogs(householdId, limit = 200) {
  const { data, error } = await supabase
    .from('nappy_logs')
    .select('*')
    .eq('household_id', householdId)
    .order('logged_at', { ascending: false })
    .limit(limit)
  return { data: data || [], error }
}

export async function deleteNappyLog(id) {
  const { error } = await supabase.from('nappy_logs').delete().eq('id', id)
  return { error }
}

// ── Sleep logs ────────────────────────────────────────────────────────────────

export async function insertSleepLog({ id, householdId, loggedBy, startedAt, endedAt, durationSecs }) {
  const { error } = await supabase
    .from('sleep_logs')
    .insert({ ...(id ? { id } : {}), household_id: householdId, logged_by: loggedBy, started_at: startedAt, ended_at: endedAt, duration_secs: durationSecs ?? null })
  return { error }
}

// Unlike updateFeedSession, any household member may call this — see the
// sleeps_update RLS policy. Ending or correcting a sleep someone else in the
// household started is the point of live cross-device sync.
export async function updateSleepLog(id, { startedAt, endedAt, durationSecs }) {
  const { data, error } = await supabase
    .from('sleep_logs')
    .update({ started_at: startedAt, ended_at: endedAt, duration_secs: durationSecs ?? null })
    .eq('id', id)
    .select()
    .single()
  return { data, error }
}

// Patch-or-insert for a sleep this device's own timer produced, used when
// the client can't prove whether the row exists (records persisted before
// the shared flag, confirms racing the shared-list load). Guessing either
// way fails badly — a wrong insert is dropped as a duplicate leaving the
// row open forever, a wrong update burns the outbox retry cap — so this
// resolves it against the server: patch first (also the safe choice for a
// row a partner started, since it never touches logged_by), and only if
// the row provably doesn't exist (PGRST116) insert it whole. The 23505
// retry closes the race where the row lands between the two steps (e.g.
// reconciliation inserting it mid-flight).
export async function upsertSleepLog({ id, householdId, loggedBy, startedAt, endedAt, durationSecs }) {
  const updated = await updateSleepLog(id, { startedAt, endedAt, durationSecs })
  if (!updated.error) return { error: null }
  if (updated.error.code !== 'PGRST116') return { error: updated.error }
  const inserted = await insertSleepLog({ id, householdId, loggedBy, startedAt, endedAt, durationSecs })
  if (String(inserted.error?.code) === '23505') {
    const retried = await updateSleepLog(id, { startedAt, endedAt, durationSecs })
    return { error: retried.error }
  }
  return { error: inserted.error }
}

export async function getRecentSleepLogs(householdId, limit = 200) {
  const { data, error } = await supabase
    .from('sleep_logs')
    .select('*')
    .eq('household_id', householdId)
    .order('started_at', { ascending: false })
    .limit(limit)
  return { data: data || [], error }
}

export async function deleteSleepLog(id) {
  const { error } = await supabase.from('sleep_logs').delete().eq('id', id)
  return { error }
}

// ── Medicine logs ─────────────────────────────────────────────────────────────

export async function insertMedicineLog({ id, householdId, loggedBy, name, medicineId, doseMl, form, notes, loggedAt }) {
  const { error } = await supabase
    .from('medicine_logs')
    .insert({ ...(id ? { id } : {}), household_id: householdId, logged_by: loggedBy, name, medicine_id: medicineId || null, dose_ml: doseMl || null, form: form || null, notes: notes || null, logged_at: loggedAt })
  return { error }
}

export async function getRecentMedicineLogs(householdId, limit = 200) {
  const { data, error } = await supabase
    .from('medicine_logs')
    .select('*')
    .eq('household_id', householdId)
    .order('logged_at', { ascending: false })
    .limit(limit)
  return { data: data || [], error }
}

export async function deleteMedicineLog(id) {
  const { error } = await supabase.from('medicine_logs').delete().eq('id', id)
  return { error }
}

// ── Migrations ────────────────────────────────────────────────────────────────

// Content signature for duplicate detection: epoch millis of the row's
// timestamps plus a discriminator where two rows can legitimately share a
// time. Comparing raw strings would miss the same instant written as
// '...Z' locally and '+00:00' by Postgres.
const timeSig = (...parts) => parts.map(p => {
  if (p == null) return ''
  const t = Date.parse(p)
  return Number.isNaN(t) ? String(p) : t
}).join('|')

// Rows uploaded by migrations that predate client UUIDs live on the server
// under generated ids the local copies know nothing about, so the id-based
// upsert cannot recognise them and a retry would re-insert them under fresh
// UUIDs. Before uploading, this user's existing rows are fetched once and
// any local row matching by content is dropped — only rows genuinely missing
// from the household are sent. Scoped to the user's own rows (logged_by) so
// a partner's entry at the same moment can never suppress one of ours, and
// ordered oldest-first so migration-era rows always sit inside the window.
// Unlike the removed "already has data?" sentinel this is per-row: it can
// skip only rows that provably exist, never a whole table. The deliberate
// trade-off: an identical-content row is treated as already migrated rather
// than risked as a duplicate.
async function fetchExistingSigs(table, householdId, userId, timeColumn, columns, sigOf) {
  const { data, error } = await supabase
    .from(table)
    .select(columns)
    .eq('household_id', householdId)
    .eq('logged_by', userId)
    .order(timeColumn, { ascending: true })
    .limit(1000)
  if (error) throw error
  return new Set((data || []).map(sigOf))
}

// Every row is upserted by its client UUID (ignore duplicates), so re-running
// a partially failed migration is idempotent — callers upgrade legacy entries
// to stable UUIDs first (see ensure*Uuids in storage.js). Rows that still
// arrive without an id fall back to plain inserts; that path is NOT
// retry-safe (a retry duplicates them under fresh ids), which is exactly why
// the id upgrade happens before rows reach here. Supabase reports rejections
// (RLS, constraints) via the returned `error` rather than by throwing, so
// each batch must be checked and re-thrown — otherwise a rejected batch
// counts as success, the flag gets written, and the entries never retry.
async function insertMigratedRows(table, rows) {
  const BATCH = 50
  const withId    = rows.filter(r => r.id)
  const withoutId = rows.filter(r => !r.id).map(({ id: _id, ...rest }) => rest)
  for (let i = 0; i < withId.length; i += BATCH) {
    const { error } = await supabase.from(table).upsert(withId.slice(i, i + BATCH), { onConflict: 'id', ignoreDuplicates: true })
    if (error) throw error
  }
  for (let i = 0; i < withoutId.length; i += BATCH) {
    const { error } = await supabase.from(table).insert(withoutId.slice(i, i + BATCH))
    if (error) throw error
  }
}

export async function migrateLocalSessions(householdId, userId, localSessions) {
  if (!localSessions?.length) return
  // `side` is part of the signature: left and right feeds logged for the
  // same interval are two real entries, and a bottle (side null) is distinct
  // from a breast feed at the same time. Only `side` is selected as the
  // discriminator — feed_type/amount_ml may be absent on a database that
  // hasn't run the bottle-feeds migration, and selecting a missing column
  // would fail the whole migration.
  const feedSig = (startedAt, endedAt, side) => `${timeSig(startedAt, endedAt)}|${side || ''}`
  const existing = await fetchExistingSigs('feed_sessions', householdId, userId,
    'started_at', 'started_at,ended_at,side', r => feedSig(r.started_at, r.ended_at, r.side))
  const rows = localSessions.filter(s => !existing.has(feedSig(s.startedAt, s.endedAt, s.feedType === 'bottle' ? null : s.side))).map(s => ({
    id:            isUuid(s.id) ? s.id : null,
    household_id:  householdId,
    baby_id:       null,
    logged_by:     userId,
    started_at:    s.startedAt,
    ended_at:      s.endedAt,
    duration_secs: s.durationSecs,
    side:          s.feedType === 'bottle' ? null : s.side,
    mood_score:    s.mood ?? null,
    feed_type:     s.feedType || 'breast',
    amount_ml:     s.amountMl ?? null,
    milk_type:     s.milkType ?? null,
  }))
  if (!rows.length) return
  await insertMigratedRows('feed_sessions', rows)
}

export async function migrateLocalNappies(householdId, userId, localNappies) {
  if (!localNappies?.length) return
  // Type is part of the signature: a wee and a poo logged for the same
  // minute are two real entries, not duplicates.
  const existing = await fetchExistingSigs('nappy_logs', householdId, userId,
    'logged_at', 'logged_at,type', r => `${timeSig(r.logged_at)}|${r.type || ''}`)
  const rows = localNappies.filter(n => !existing.has(`${timeSig(n.loggedAt)}|${n.type || ''}`)).map(n => ({
    id: isUuid(n.id) ? n.id : null,
    household_id: householdId, logged_by: userId,
    type: n.type, poo_color: n.pooColor || null, logged_at: n.loggedAt,
  }))
  if (!rows.length) return
  await insertMigratedRows('nappy_logs', rows)
}

export async function migrateLocalSleeps(householdId, userId, localSleeps) {
  if (!localSleeps?.length) return
  const existing = await fetchExistingSigs('sleep_logs', householdId, userId,
    'started_at', 'started_at,ended_at', r => timeSig(r.started_at, r.ended_at))
  const rows = localSleeps.filter(s => !existing.has(timeSig(s.startedAt, s.endedAt))).map(s => ({
    id: isUuid(s.id) ? s.id : null,
    household_id: householdId, logged_by: userId,
    started_at: s.startedAt, ended_at: s.endedAt, duration_secs: s.durationSecs ?? null,
  }))
  if (!rows.length) return
  await insertMigratedRows('sleep_logs', rows)
}

export async function migrateLocalMedicines(householdId, userId, localMedicines) {
  if (!localMedicines?.length) return
  // Name is part of the signature: paracetamol and vitamin D given together
  // are commonly logged with the same time.
  const existing = await fetchExistingSigs('medicine_logs', householdId, userId,
    'logged_at', 'logged_at,name', r => `${timeSig(r.logged_at)}|${(r.name || '').toLowerCase()}`)
  const rows = localMedicines.filter(m => !existing.has(`${timeSig(m.loggedAt)}|${(m.name || '').toLowerCase()}`)).map(m => ({
    id: isUuid(m.id) ? m.id : null,
    household_id: householdId, logged_by: userId,
    name: m.name, medicine_id: m.medicineId || null, dose_ml: m.doseMl || null,
    form: m.form || null, notes: m.notes || null, logged_at: m.loggedAt,
  }))
  if (!rows.length) return
  await insertMigratedRows('medicine_logs', rows)
}

// ── Feed sessions ─────────────────────────────────────────────────────────────

export async function insertFeedSession({ id, householdId, babyId, loggedBy, startedAt, endedAt, durationSecs, side, moodScore, feedType, amountMl, milkType }) {
  const { data, error } = await supabase
    .from('feed_sessions')
    .insert({
      ...(id ? { id } : {}),
      household_id:  householdId,
      baby_id:       babyId,
      logged_by:     loggedBy,
      started_at:    startedAt,
      ended_at:      endedAt,
      duration_secs: durationSecs,
      side,
      mood_score:    moodScore || null,
      // Default/empty values are omitted so breast feeds keep working even
      // against a database that hasn't run the bottle-feeds migration yet.
      ...(feedType && feedType !== 'breast' ? { feed_type: feedType } : {}),
      ...(amountMl != null ? { amount_ml: amountMl } : {}),
      ...(milkType ? { milk_type: milkType } : {}),
    })
    .select()
    .single()
  return { data, error }
}

export async function getRecentSessions(householdId, limit = 50) {
  const { data, error } = await supabase
    .from('feed_sessions')
    .select('*')
    .eq('household_id', householdId)
    .order('started_at', { ascending: false })
    .limit(limit)
  return { data: data || [], error }
}

export async function updateFeedSession(id, { side, startedAt, endedAt, durationSecs, moodScore, feedType, amountMl, milkType }) {
  const { data, error } = await supabase
    .from('feed_sessions')
    .update({
      side,
      started_at:    startedAt,
      ended_at:      endedAt,
      duration_secs: durationSecs,
      mood_score:    moodScore ?? null,
      // Only sent when the caller provides them, so update payloads queued in
      // the outbox before this feature shipped can never null these out.
      ...(feedType !== undefined ? { feed_type: feedType } : {}),
      ...(amountMl !== undefined ? { amount_ml: amountMl } : {}),
      ...(milkType !== undefined ? { milk_type: milkType } : {}),
    })
    .eq('id', id)
    .select()
    .single()
  return { data, error }
}

export async function deleteFeedSession(id) {
  const { error } = await supabase
    .from('feed_sessions')
    .delete()
    .eq('id', id)
  return { error }
}

// ── Realtime subscription ─────────────────────────────────────────────────────

// Subscribes to live changes for the whole household. `handlersByTable` maps
// feeds/nappies/medicines to { onInsert, onUpdate, onDelete }. Tables that are
// not yet in the supabase_realtime publication simply never emit events, so
// this degrades gracefully to the existing refresh-after-write behaviour.
const REALTIME_TABLES = { feeds: 'feed_sessions', nappies: 'nappy_logs', medicines: 'medicine_logs', sleeps: 'sleep_logs' }

export function subscribeToHousehold(householdId, handlersByTable) {
  const filter = `household_id=eq.${householdId}`
  const channel = supabase.channel(`household:${householdId}`)

  for (const [key, handlers] of Object.entries(handlersByTable)) {
    const table = REALTIME_TABLES[key]
    if (!table || !handlers) continue
    channel
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table, filter },
        payload => handlers.onInsert?.(payload.new))
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table, filter },
        payload => handlers.onUpdate?.(payload.new))
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table, filter },
        payload => handlers.onDelete?.(payload.old))
  }

  channel.subscribe()
  return () => supabase.removeChannel(channel)
}
