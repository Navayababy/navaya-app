import { useState, useRef, useEffect, useCallback } from 'react'
import { ensureSessionUuids, ensureNappyUuids, ensureMedicineUuids, ensureSleepUuids, getHouseholdLink, setHouseholdLink, clearHouseholdLink } from '../lib/storage.js'
import { getSession, getProfile, getHouseholdMembers, subscribeToHousehold, getRecentSessions, migrateLocalSessions, getRecentNappyLogs, getRecentMedicineLogs, getRecentSleepLogs, migrateLocalNappies, migrateLocalMedicines, migrateLocalSleeps } from '../lib/db.js'
import { flushOutbox } from '../lib/sync.js'
import { logError } from '../lib/logError.js'
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
  // A failed local→shared migration is retried on the next profile load, but
  // until then the user deserves to know their earlier entries haven't copied
  // across yet (surfaced in Settings) rather than finding out from a partner.
  const [migrationError,  setMigrationError]  = useState(false)
  const realtimeUnsub = useRef(null)
  // Pending retry of a failed profile load (timer id + next backoff delay).
  const profileRetry = useRef({ timer: null, delay: 5000 })
  // Households already reconciled this session (cleared on sign-out, so a
  // sign-out → log → sign-in sequence still gets its entries uploaded).
  const reconciledHouseholds = useRef(new Set())

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
        clearProfileRetry()
        reconciledHouseholds.current.clear()
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

    return () => {
      subscription.unsubscribe()
      clearProfileRetry()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const clearProfileRetry = () => {
    if (profileRetry.current.timer) {
      clearTimeout(profileRetry.current.timer)
      profileRetry.current.timer = null
    }
  }

  const loadProfile = async (userId) => {
    clearProfileRetry()
    // Seed shared mode from the cached link straight away: a write made in
    // the moment before the profile arrives — or while the fetch is failing —
    // must queue into the household outbox, not fall through to local-only
    // (nothing re-uploads those entries later).
    const cached = getHouseholdLink()
    if (cached?.userId === userId) {
      setProfile(prev => prev || { id: userId, household_id: cached.householdId, role: cached.role || null })
    }
    const { data, error } = await getProfile(userId)
    if (!data) {
      if (error?.code === 'PGRST116') {
        // Definitive answer: no profile row exists (normal for a fresh
        // account before its first household). Any cached link is stale.
        if (cached?.userId === userId) {
          clearHouseholdLink()
          setProfile(null)
        }
        return
      }
      // Transient failure (offline launch, token mid-refresh, Supabase
      // blip). Giving up here used to leave a signed-in, linked device in
      // local-only mode for the whole session; instead the cached link
      // stays active and the load retries until the server answers.
      logError('profile.load', error)
      profileRetry.current.timer = setTimeout(() => loadProfile(userId), profileRetry.current.delay)
      profileRetry.current.delay = Math.min(profileRetry.current.delay * 2, 60000)
      return
    }
    profileRetry.current.delay = 5000
    setProfile(data)
    if (data.household_id) {
      setHouseholdLink(userId, data.household_id, data.role)
      setHouseholdMembers(null)
      setHouseholdMembersError(null)
      loadHouseholdMembers()
      // Reconcile this device's local logbook into the household, once per
      // household per app session (the claim is dropped on sign-out and on
      // failure, so both get another pass). This used to be a one-time
      // migration behind persistent `navaya_migrated_*` flags, which
      // permanently stranded anything logged while the device was signed
      // out or desynced: those writes never reach syncWrite, and with the
      // flag already set nothing ever re-uploaded them — the household
      // quietly diverged from the device. Re-upload is idempotent (stable
      // client UUIDs upserted with ignoreDuplicates, content-signature
      // dedupe for pre-UUID rows — see db.js), so re-running it every
      // session is safe, recovers those entries, and there is deliberately
      // NO "does the user already have data?" short-circuit — after a
      // partial failure any such check reads as "already uploaded" and
      // strands the remaining rows.
      if (!reconciledHouseholds.current.has(data.household_id)) {
        reconciledHouseholds.current.add(data.household_id)
        let migrationFailed = false
        try {
          await migrateLocalSessions(data.household_id, userId, ensureSessionUuids())
          await migrateLocalNappies(data.household_id, userId, ensureNappyUuids())
          await migrateLocalMedicines(data.household_id, userId, ensureMedicineUuids())
          await migrateLocalSleeps(data.household_id, userId, ensureSleepUuids())
        } catch (err) {
          console.error('Logbook reconciliation failed, will retry next load:', err)
          logError('migration.reconcile', err)
          reconciledHouseholds.current.delete(data.household_id)
          migrationFailed = true
        }
        // Also clears a stale warning once a later retry has succeeded.
        setMigrationError(migrationFailed)
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
      // The server says this user has no household: a cached link for them
      // is out of date and must not resurrect the old household on a later
      // transient failure.
      if (cached?.userId === userId) clearHouseholdLink()
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
    migrationError,
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
