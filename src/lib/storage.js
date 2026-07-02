// lib/storage.js
// All data lives in localStorage for now.
// This means it works on one device without any backend.
// Partner sync can be added later via Supabase.

import { isUuid, newId } from './id.js';

const KEYS = {
  sessions:       'navaya_sessions',
  checklist:      'navaya_checklist',
  customItems:    'navaya_custom_items',
  hiddenDefaults: 'navaya_hidden_defaults',
  nappies:        'navaya_nappies',
  medicines:      'navaya_medicines',
  sleeps:         'navaya_sleeps',
  nightMode:      'navaya_night',
  nightHintSeen:  'navaya_night_hint_seen',
  babyName:       'navaya_baby_name',
  userName:       'navaya_user_name',
  activeTimer:    'navaya_active_timer',
  activeSleep:    'navaya_active_sleep',
  pendingSleep:   'navaya_pending_sleep',
  dismissedAnnouncements: 'navaya_dismissed_announcements',
  lastOpenedAt:   'navaya_last_opened_at',
  installBannerDismissed: 'navaya_install_banner_dismissed',
  householdLinked: 'navaya_household_linked',
  guestNoticeDismissed: 'navaya_guest_notice_dismissed',
};

// ── Sessions ────────────────────────────────────────────────────────────────

export function getSessions() {
  try {
    return JSON.parse(localStorage.getItem(KEYS.sessions) || '[]');
  } catch {
    return [];
  }
}

export function addSession(session) {
  const sessions = getSessions();
  sessions.unshift(session);
  const trimmed = sessions.slice(0, 500);
  localStorage.setItem(KEYS.sessions, JSON.stringify(trimmed));
  return trimmed;
}

export function updateSession(id, changes) {
  const sessions = getSessions();
  const idx = sessions.findIndex(s => s.id === id);
  if (idx === -1) return sessions;
  sessions[idx] = { ...sessions[idx], ...changes };
  // Recalculate duration if times changed
  if (changes.startedAt || changes.endedAt) {
    const start = new Date(sessions[idx].startedAt).getTime();
    const end   = new Date(sessions[idx].endedAt).getTime();
    sessions[idx].durationSecs = Math.max(0, Math.round((end - start) / 1000));
  }
  localStorage.setItem(KEYS.sessions, JSON.stringify(sessions));
  return sessions;
}

export function deleteSession(id) {
  const sessions = getSessions().filter(s => s.id !== id);
  localStorage.setItem(KEYS.sessions, JSON.stringify(sessions));
  return sessions;
}

// ── Nappies ──────────────────────────────────────────────────────────────────

export function getNappies() {
  try {
    return JSON.parse(localStorage.getItem(KEYS.nappies) || '[]');
  } catch {
    return [];
  }
}

export function addNappy(nappy) {
  const nappies = getNappies();
  nappies.unshift(nappy);
  const trimmed = nappies.slice(0, 500);
  localStorage.setItem(KEYS.nappies, JSON.stringify(trimmed));
  return trimmed;
}

export function deleteNappy(id) {
  const nappies = getNappies().filter(n => n.id !== id);
  localStorage.setItem(KEYS.nappies, JSON.stringify(nappies));
  return nappies;
}

export function updateNappy(id, changes) {
  const nappies = getNappies();
  const idx = nappies.findIndex(n => n.id === id);
  if (idx === -1) return nappies;
  nappies[idx] = { ...nappies[idx], ...changes };
  localStorage.setItem(KEYS.nappies, JSON.stringify(nappies));
  return nappies;
}

// ── Medicines ────────────────────────────────────────────────────────────────

export function getMedicines() {
  try {
    return JSON.parse(localStorage.getItem(KEYS.medicines) || '[]');
  } catch {
    return [];
  }
}

export function addMedicine(medicine) {
  const medicines = getMedicines();
  medicines.unshift(medicine);
  const trimmed = medicines.slice(0, 500);
  localStorage.setItem(KEYS.medicines, JSON.stringify(trimmed));
  return trimmed;
}

export function deleteMedicine(id) {
  const medicines = getMedicines().filter(m => m.id !== id);
  localStorage.setItem(KEYS.medicines, JSON.stringify(medicines));
  return medicines;
}

// ── Sleeps ───────────────────────────────────────────────────────────────────

export function getSleeps() {
  try {
    return JSON.parse(localStorage.getItem(KEYS.sleeps) || '[]');
  } catch {
    return [];
  }
}

export function addSleep(sleep) {
  const sleeps = getSleeps();
  sleeps.unshift(sleep);
  const trimmed = sleeps.slice(0, 500);
  localStorage.setItem(KEYS.sleeps, JSON.stringify(trimmed));
  return trimmed;
}

export function deleteSleep(id) {
  const sleeps = getSleeps().filter(s => s.id !== id);
  localStorage.setItem(KEYS.sleeps, JSON.stringify(sleeps));
  return sleeps;
}

export function updateSleep(id, changes) {
  const sleeps = getSleeps();
  const idx = sleeps.findIndex(s => s.id === id);
  if (idx === -1) return sleeps;
  sleeps[idx] = { ...sleeps[idx], ...changes };
  if (changes.startedAt || changes.endedAt) {
    const start = new Date(sleeps[idx].startedAt).getTime();
    const end   = new Date(sleeps[idx].endedAt).getTime();
    sleeps[idx].durationSecs = Math.max(0, Math.round((end - start) / 1000));
  }
  localStorage.setItem(KEYS.sleeps, JSON.stringify(sleeps));
  return sleeps;
}

// ── Migration id upgrade ─────────────────────────────────────────────────────

// Entries created before UUID ids shipped carry legacy ids that can't be
// upserted idempotently. Assigning them a stable UUID *before* upload — and
// persisting it — means a retried migration re-sends the same rows (upsert,
// ignore duplicates) instead of plain-inserting fresh copies of rows that
// already landed on an earlier, partially failed attempt.
function ensureUuidIds(key) {
  let items;
  try {
    items = JSON.parse(localStorage.getItem(key) || '[]');
  } catch {
    return [];
  }
  let changed = false;
  const upgraded = items.map(item => {
    if (isUuid(item?.id)) return item;
    changed = true;
    return { ...item, id: newId() };
  });
  if (changed) localStorage.setItem(key, JSON.stringify(upgraded));
  return upgraded;
}

export function ensureSessionUuids()  { return ensureUuidIds(KEYS.sessions); }
export function ensureNappyUuids()    { return ensureUuidIds(KEYS.nappies); }
export function ensureMedicineUuids() { return ensureUuidIds(KEYS.medicines); }
export function ensureSleepUuids()    { return ensureUuidIds(KEYS.sleeps); }

// ── Active sleep ──────────────────────────────────────────────────────────────

export function getActiveSleep() {
  try {
    return JSON.parse(localStorage.getItem(KEYS.activeSleep) || 'null');
  } catch {
    return null;
  }
}

export function setActiveSleep(id, startedAt) {
  localStorage.setItem(KEYS.activeSleep, JSON.stringify({ id, startedAt }));
}

export function clearActiveSleep() {
  localStorage.removeItem(KEYS.activeSleep);
}

// A stopped sleep awaiting end-time confirmation (see SleepScreen). The
// active timer is already cleared by the time this exists, so this is the
// only record of it until the user confirms — it must survive a tab switch,
// reload or the app being closed, not just live in component state.
export function getPendingSleep() {
  try {
    return JSON.parse(localStorage.getItem(KEYS.pendingSleep) || 'null');
  } catch {
    return null;
  }
}

export function savePendingSleep(sleep) {
  localStorage.setItem(KEYS.pendingSleep, JSON.stringify(sleep));
}

export function clearPendingSleep() {
  localStorage.removeItem(KEYS.pendingSleep);
}

// ── Checklist ────────────────────────────────────────────────────────────────

export function getChecked() {
  try {
    return JSON.parse(localStorage.getItem(KEYS.checklist) || '{}');
  } catch {
    return {};
  }
}

export function setChecked(checked) {
  localStorage.setItem(KEYS.checklist, JSON.stringify(checked));
}

export function getCustomItems() {
  try {
    return JSON.parse(localStorage.getItem(KEYS.customItems) || '[]');
  } catch {
    return [];
  }
}

export function setCustomItems(items) {
  localStorage.setItem(KEYS.customItems, JSON.stringify(items));
}

export function getHiddenDefaults() {
  try {
    return JSON.parse(localStorage.getItem(KEYS.hiddenDefaults) || '[]');
  } catch {
    return [];
  }
}

export function saveHiddenDefaults(ids) {
  localStorage.setItem(KEYS.hiddenDefaults, JSON.stringify(ids));
}

// ── Preferences ──────────────────────────────────────────────────────────────

export function getNightMode() {
  return localStorage.getItem(KEYS.nightMode) === 'true';
}

export function setNightMode(val) {
  localStorage.setItem(KEYS.nightMode, String(val));
}

// Whether the user has ever made an explicit night-mode choice. When false,
// the app can auto-apply night mode after dark without overriding a choice.
export function hasNightPref() {
  return localStorage.getItem(KEYS.nightMode) !== null;
}

export function getNightHintSeen() {
  return localStorage.getItem(KEYS.nightHintSeen) === 'true';
}

export function setNightHintSeen() {
  localStorage.setItem(KEYS.nightHintSeen, 'true');
}

export function getUserName() {
  return localStorage.getItem(KEYS.userName) || '';
}

export function setUserName(name) {
  localStorage.setItem(KEYS.userName, name);
}

export function getBabyName() {
  return localStorage.getItem(KEYS.babyName) || '';
}

export function setBabyName(name) {
  localStorage.setItem(KEYS.babyName, name);
}

// Name to use in user-facing copy: the set name, or a neutral fallback so
// sentences read naturally before a name has been entered. Pass lower: true
// for mid-sentence use ("when baby drifts off") vs sentence start ("Baby").
export function babyDisplayName(lower = false) {
  return getBabyName() || (lower ? 'baby' : 'Baby');
}

// ── Splash greeting ──────────────────────────────────────────────────────────

// When the app was last opened, so the splash can tell a same-day return
// ("Welcome back") from a longer gap ("We missed you"). Read before writing —
// callers need the previous value before recording this visit.
export function getLastOpenedAt() {
  return localStorage.getItem(KEYS.lastOpenedAt);
}

export function setLastOpenedAt() {
  localStorage.setItem(KEYS.lastOpenedAt, new Date().toISOString());
}

// ── Announcements ────────────────────────────────────────────────────────────

// Dismissal is tracked by announcement id, so a dismissed banner never returns
// but a newly published one (new id) still shows.
export function getDismissedAnnouncements() {
  try {
    return JSON.parse(localStorage.getItem(KEYS.dismissedAnnouncements) || '[]');
  } catch {
    return [];
  }
}

export function dismissAnnouncement(id) {
  const dismissed = getDismissedAnnouncements();
  if (!dismissed.includes(id)) {
    dismissed.push(id);
    // Keep the list bounded — old ids can never resurface anyway.
    localStorage.setItem(KEYS.dismissedAnnouncements, JSON.stringify(dismissed.slice(-50)));
  }
  return dismissed;
}

// ── Install banner ───────────────────────────────────────────────────────────

export function getInstallBannerDismissed() {
  return localStorage.getItem(KEYS.installBannerDismissed) === '1';
}

export function dismissInstallBanner() {
  localStorage.setItem(KEYS.installBannerDismissed, '1');
}

// ── Guest-mode notice ────────────────────────────────────────────────────────

// One-time Home note telling signed-out users their data lives on this device
// only (and can be backed up by signing in). Dismissed once, gone forever.
export function getGuestNoticeDismissed() {
  return localStorage.getItem(KEYS.guestNoticeDismissed) === '1';
}

export function dismissGuestNotice() {
  localStorage.setItem(KEYS.guestNoticeDismissed, '1');
}

// ── Household link ───────────────────────────────────────────────────────────

// Remembers, per device, that this browser was once signed in to a shared
// household — so if a session later expires (or the app is opened signed
// out) we can still warn "you're not signed in" instead of staying quiet,
// even though the profile/auth state itself has already been cleared.
export function getHouseholdLinked() {
  return localStorage.getItem(KEYS.householdLinked) === '1';
}

export function setHouseholdLinked() {
  localStorage.setItem(KEYS.householdLinked, '1');
}

// ── Active timer ─────────────────────────────────────────────────────────────

export function getActiveTimer() {
  try {
    return JSON.parse(localStorage.getItem(KEYS.activeTimer) || 'null');
  } catch {
    return null;
  }
}

export function setActiveTimer(side, startedAt, feedType = 'breast') {
  localStorage.setItem(KEYS.activeTimer, JSON.stringify({ side, startedAt, feedType }));
}

export function clearActiveTimer() {
  localStorage.removeItem(KEYS.activeTimer);
}
