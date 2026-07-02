import { useState, useRef, useEffect, useCallback } from 'react'
import { getSessions, getNappies, getMedicines, getSleeps, setHouseholdLinked } from '../lib/storage.js'
import { getSession, getProfile, getHouseholdMembers, subscribeToHousehold, getRecentSessions, migrateLocalSessions, getRecentNappyLogs, getRecentMedicineLogs, getRecentSleepLogs, migrateLocalNappies, migrateLocalMedicines, migrateLocalSleeps, userHasDataInHousehold } from '../lib/db.js'
import { flushOutbox } from '../lib/sync.js'
import { supabase, isSupabaseConfigured } from '../lib/supabase.js'

// Auth + shared-household state: who is signed in, their profile, household
// members, the shared feed/nappy/medicine lists, realtime subscription, the
// one-time local-data migration, and outbox flush triggers.
export function useHousehold() {
  const [authUser,        setAuthUser]        = useState(null)
  const [profile,         setProfile]         = useState(null)
  const [householdMembers, setHouseholdMembers] = useState(null)
  const [householdMembersError, setHouseholdMembersError] = useState(null)
  const [sharedSessions,  setSharedSessions]  = useState(null)
  const [sharedNappies,   setSharedNappies]   = useState(null)
  const [sharedMedicines, setSharedMedicines] = useState(null)
  const [sharedSleeps,    setSharedSleeps]    = useState(null)
  const realtimeUnsub = useRef(null)

  // ── Auth init (only when Supabase is configured) ───────────────────────────
  useEffect(() => {
    if (!isSupabaseConfigured) return

    getSession().then(session => {
      if (session?.user) {
        setAuthUser(session.user)
        loadProfile(session.user.id)
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const user = session?.user || null
      setAuthUser(user)
      if (user) {
        loadProfile(user.id)
      } else {
        setProfile(null)
        setHouseholdMembers(null)
        setHouseholdMembersError(null)
        setSharedSessions(null)
        setSharedNappies(null)
        setSharedMedicines(null)
        setSharedSleeps(null)
        if (realtimeUnsub.current) { realtimeUnsub.current(); realtimeUnsub.current = null }
      }
    })

    return () => subscription.unsubscribe()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const loadProfile = async (userId) => {
    const { data } = await getProfile(userId)
    if (!data) return
    setProfile(data)
    if (data.household_id) {
      setHouseholdLinked()
      setHouseholdMembers(null)
      setHouseholdMembersError(null)
      loadHouseholdMembers()
      // One-time migration: upload local data only if this user has no records in Supabase yet.
      // Flag is only set on full success so a failed migration can be retried on next login.
      const migrationKey = `navaya_migrated_${data.household_id}`
      if (!localStorage.getItem(migrationKey)) {
        const alreadySynced = await userHasDataInHousehold(data.household_id, userId)
        if (!alreadySynced) {
          try {
            await migrateLocalSessions(data.household_id, userId, getSessions())
            await migrateLocalNappies(data.household_id, userId, getNappies())
            await migrateLocalMedicines(data.household_id, userId, getMedicines())
            localStorage.setItem(migrationKey, '1')
          } catch (err) {
            console.error('Migration failed, will retry next login:', err)
          }
        } else {
          localStorage.setItem(migrationKey, '1')
        }
      }
      // Sleep tracking shipped after the original migration, so it has its own
      // one-time flag. Upserts with client UUIDs make a retry harmless.
      const sleepMigrationKey = `navaya_migrated_sleeps_${data.household_id}`
      if (!localStorage.getItem(sleepMigrationKey)) {
        try {
          await migrateLocalSleeps(data.household_id, userId, getSleeps())
          localStorage.setItem(sleepMigrationKey, '1')
        } catch (err) {
          console.error('Sleep migration failed, will retry next login:', err)
        }
      }
      // Deliver any writes queued while offline before refreshing the lists
      await flushOutbox()
      loadSharedSessions(data.household_id)
      loadSharedNappies(data.household_id)
      loadSharedMedicines(data.household_id)
      loadSharedSleeps(data.household_id)
      if (realtimeUnsub.current) realtimeUnsub.current()
      const listHandlers = (setList) => ({
        onInsert: (row) => setList(prev => prev ? [row, ...prev.filter(x => x.id !== row.id)] : [row]),
        onUpdate: (row) => setList(prev => prev ? prev.map(x => x.id === row.id ? row : x) : [row]),
        onDelete: (row) => setList(prev => prev ? prev.filter(x => x.id !== row.id) : []),
      })
      realtimeUnsub.current = subscribeToHousehold(data.household_id, {
        feeds:     listHandlers(setSharedSessions),
        nappies:   listHandlers(setSharedNappies),
        medicines: listHandlers(setSharedMedicines),
        sleeps:    listHandlers(setSharedSleeps),
      })
    } else {
      setHouseholdMembers([])
      setHouseholdMembersError(null)
    }
  }

  const loadHouseholdMembers = useCallback(async () => {
    const { data, error } = await getHouseholdMembers()
    if (error) {
      setHouseholdMembers([])
      setHouseholdMembersError(error.message || 'Unable to load household members')
      return []
    }
    setHouseholdMembers(data || [])
    setHouseholdMembersError(null)
    return data || []
  }, [])

  const loadSharedSessions = async (householdId) => {
    const { data } = await getRecentSessions(householdId, 200)
    if (data) setSharedSessions(data)
  }

  const loadSharedNappies = async (householdId) => {
    const { data } = await getRecentNappyLogs(householdId, 200)
    if (data) setSharedNappies(data)
  }

  const loadSharedMedicines = async (householdId) => {
    const { data } = await getRecentMedicineLogs(householdId, 200)
    if (data) setSharedMedicines(data)
  }

  const loadSharedSleeps = async (householdId) => {
    const { data } = await getRecentSleepLogs(householdId, 200)
    if (data) setSharedSleeps(data)
  }

  const refreshProfile = () => {
    if (authUser) loadProfile(authUser.id)
  }

  const refreshSharedSessions  = () => { if (profile?.household_id) loadSharedSessions(profile.household_id) }
  const refreshSharedNappies   = () => { if (profile?.household_id) loadSharedNappies(profile.household_id) }
  const refreshSharedMedicines = () => { if (profile?.household_id) loadSharedMedicines(profile.household_id) }
  const refreshSharedSleeps    = () => { if (profile?.household_id) loadSharedSleeps(profile.household_id) }

  const resyncAll = async () => {
    if (!profile?.household_id) return
    await flushOutbox()
    await Promise.all([
      loadSharedSessions(profile.household_id),
      loadSharedNappies(profile.household_id),
      loadSharedMedicines(profile.household_id),
      loadSharedSleeps(profile.household_id),
    ])
  }

  // Drain queued offline writes when connectivity returns, and once a minute
  // as a safety net (no-op when the outbox is empty).
  useEffect(() => {
    if (!isSupabaseConfigured) return
    const onOnline = () => flushOutbox()
    window.addEventListener('online', onOnline)
    const drainTimer = setInterval(() => flushOutbox(), 60000)
    return () => {
      window.removeEventListener('online', onOnline)
      clearInterval(drainTimer)
    }
  }, [])

  return {
    authUser,
    profile,
    householdMembers,
    householdMembersError,
    sharedSessions,
    sharedNappies,
    sharedMedicines,
    sharedSleeps,
    loadHouseholdMembers,
    refreshProfile,
    refreshSharedSessions,
    refreshSharedNappies,
    refreshSharedMedicines,
    refreshSharedSleeps,
    resyncAll,
  }
}
