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
  const { data, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', userId)
    .select()
    .single()
  return { data, error }
}

// ── Household setup ───────────────────────────────────────────────────────────

export async function createHousehold(userId) {
  // Create the household
  const { data: household, error: hErr } = await supabase
    .from('households')
    .insert({})
    .select()
    .single()

  if (hErr) return { error: hErr }

  // Link the user to it
  const { error: pErr } = await supabase
    .from('profiles')
    .update({ household_id: household.id, role: 'primary' })
    .eq('id', userId)

  return { data: household, error: pErr }
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

function randomCode() {
  return Math.random().toString(36).substring(2, 10).toUpperCase()
}

export async function createInviteCode(householdId) {
  const code = randomCode()
  const { data, error } = await supabase
    .from('household_invites')
    .insert({ household_id: householdId, invite_code: code })
    .select()
    .single()
  return { data, error, code }
}

export async function acceptInvite(code, userId) {
  // Find the invite
  const { data: invite, error: findErr } = await supabase
    .from('household_invites')
    .select('*')
    .eq('invite_code', code.toUpperCase())
    .is('accepted_at', null)
    .single()

  if (findErr || !invite) return { error: { message: 'Invalid or expired invite code.' } }
  if (new Date(invite.expires_at) < new Date()) return { error: { message: 'This invite code has expired.' } }

  // Link user to the household
  const { error: profileErr } = await supabase
    .from('profiles')
    .update({ household_id: invite.household_id, role: 'partner' })
    .eq('id', userId)

  if (profileErr) return { error: profileErr }

  // Mark invite as accepted
  await supabase
    .from('household_invites')
    .update({ accepted_at: new Date().toISOString() })
    .eq('id', invite.id)

  return { data: { household_id: invite.household_id } }
}

// ── Feed sessions ─────────────────────────────────────────────────────────────

export async function insertFeedSession({ householdId, babyId, loggedBy, startedAt, endedAt, durationSecs, side, moodScore }) {
  const { data, error } = await supabase
    .from('feed_sessions')
    .insert({
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

// ── Realtime subscription ─────────────────────────────────────────────────────

export function subscribeToFeeds(householdId, onNewSession) {
  const channel = supabase
    .channel(`feeds:${householdId}`)
    .on('postgres_changes', {
      event:  'INSERT',
      schema: 'public',
      table:  'feed_sessions',
      filter: `household_id=eq.${householdId}`,
    }, payload => {
      onNewSession(payload.new)
    })
    .subscribe()

  // Return unsubscribe function
  return () => supabase.removeChannel(channel)
}
