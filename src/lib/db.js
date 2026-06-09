// lib/db.js
// All Supabase database operations live here.
// Screens import what they need from this file.

import { supabase } from './supabase.js'

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

export async function userHasDataInHousehold(householdId, userId) {
  const { data } = await supabase
    .from('feed_sessions')
    .select('id')
    .eq('household_id', householdId)
    .eq('logged_by', userId)
    .limit(1)
  return !!(data?.length)
}

export async function deduplicateHouseholdData(householdId) {
  const dedupTable = async (table, keyFn) => {
    const { data } = await supabase
      .from(table)
      .select('id, logged_by, ' + (table === 'feed_sessions' ? 'started_at, side' : 'logged_at, ' + (table === 'nappy_logs' ? 'type' : 'name')))
      .eq('household_id', householdId)
      .order('id', { ascending: true })
      .limit(2000)
    if (!data?.length) return
    const seen = new Set()
    const toDelete = []
    for (const row of data) {
      const key = keyFn(row)
      if (seen.has(key)) toDelete.push(row.id)
      else seen.add(key)
    }
    for (let i = 0; i < toDelete.length; i += 50) {
      await supabase.from(table).delete().in('id', toDelete.slice(i, i + 50))
    }
  }

  await dedupTable('feed_sessions', r => `${r.logged_by}|${r.started_at}|${r.side}`)
  await dedupTable('nappy_logs',    r => `${r.logged_by}|${r.logged_at}|${r.type}`)
  await dedupTable('medicine_logs', r => `${r.logged_by}|${r.logged_at}|${r.name}`)
}

export async function migrateLocalSessions(householdId, userId, localSessions) {
  if (!localSessions?.length) return
  const rows = localSessions.map(s => ({
    household_id:  householdId,
    baby_id:       null,
    logged_by:     userId,
    started_at:    s.startedAt,
    ended_at:      s.endedAt,
    duration_secs: s.durationSecs,
    side:          s.side,
    mood_score:    s.mood ?? null,
  }))
  const BATCH = 50
  for (let i = 0; i < rows.length; i += BATCH) {
    await supabase.from('feed_sessions').insert(rows.slice(i, i + BATCH))
  }
}

export async function migrateLocalNappies(householdId, userId, localNappies) {
  if (!localNappies?.length) return
  const rows = localNappies.map(n => ({
    household_id: householdId, logged_by: userId,
    type: n.type, poo_color: n.pooColor || null, logged_at: n.loggedAt,
  }))
  const BATCH = 50
  for (let i = 0; i < rows.length; i += BATCH) {
    await supabase.from('nappy_logs').insert(rows.slice(i, i + BATCH))
  }
}

export async function migrateLocalMedicines(householdId, userId, localMedicines) {
  if (!localMedicines?.length) return
  const rows = localMedicines.map(m => ({
    household_id: householdId, logged_by: userId,
    name: m.name, medicine_id: m.medicineId || null, dose_ml: m.doseMl || null,
    form: m.form || null, notes: m.notes || null, logged_at: m.loggedAt,
  }))
  const BATCH = 50
  for (let i = 0; i < rows.length; i += BATCH) {
    await supabase.from('medicine_logs').insert(rows.slice(i, i + BATCH))
  }
}

// ── Feed sessions ─────────────────────────────────────────────────────────────

export async function insertFeedSession({ id, householdId, babyId, loggedBy, startedAt, endedAt, durationSecs, side, moodScore }) {
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

export async function updateFeedSession(id, { side, startedAt, endedAt, durationSecs, moodScore }) {
  const { data, error } = await supabase
    .from('feed_sessions')
    .update({
      side,
      started_at:    startedAt,
      ended_at:      endedAt,
      duration_secs: durationSecs,
      mood_score:    moodScore ?? null,
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

export function subscribeToFeeds(householdId, { onInsert, onUpdate, onDelete }) {
  const filter = `household_id=eq.${householdId}`
  const channel = supabase
    .channel(`feeds:${householdId}`)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'feed_sessions', filter },
      payload => onInsert?.(payload.new))
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'feed_sessions', filter },
      payload => onUpdate?.(payload.new))
    .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'feed_sessions', filter },
      payload => onDelete?.(payload.old))
    .subscribe()

  return () => supabase.removeChannel(channel)
}
