// lib/storage.js
// All data lives in localStorage for now.
// This means it works on one device without any backend.
// Partner sync can be added later via Supabase.

const KEYS = {
  sessions:       'navaya_sessions',
  checklist:      'navaya_checklist',
  customItems:    'navaya_custom_items',
  hiddenDefaults: 'navaya_hidden_defaults',
  nappies:        'navaya_nappies',
  sleeps:         'navaya_sleeps',
  nightMode:      'navaya_night',
  babyName:       'navaya_baby_name',
  userName:       'navaya_user_name',
  activeTimer:    'navaya_active_timer',
  activeSleep:    'navaya_active_sleep',
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

// ── Active sleep ──────────────────────────────────────────────────────────────

export function getActiveSleep() {
  try {
    return JSON.parse(localStorage.getItem(KEYS.activeSleep) || 'null');
  } catch {
    return null;
  }
}

export function setActiveSleep(startedAt) {
  localStorage.setItem(KEYS.activeSleep, JSON.stringify({ startedAt }));
}

export function clearActiveSleep() {
  localStorage.removeItem(KEYS.activeSleep);
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

// ── Active timer ─────────────────────────────────────────────────────────────

export function getActiveTimer() {
  try {
    return JSON.parse(localStorage.getItem(KEYS.activeTimer) || 'null');
  } catch {
    return null;
  }
}

export function setActiveTimer(side, startedAt) {
  localStorage.setItem(KEYS.activeTimer, JSON.stringify({ side, startedAt }));
}

export function clearActiveTimer() {
  localStorage.removeItem(KEYS.activeTimer);
}
