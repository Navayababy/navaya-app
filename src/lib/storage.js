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
  nightMode:      'navaya_night',
  babyName:       'navaya_baby_name',
  userName:       'navaya_user_name',
  activeTimer:    'navaya_active_timer',
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
