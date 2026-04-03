// lib/storage.js
// All data lives in localStorage for now.
// This means it works on one device without any backend.
// Partner sync can be added later via Supabase.

const KEYS = {
  sessions:  'navaya_sessions',
  checklist: 'navaya_checklist',
  customItems: 'navaya_custom_items',
  nightMode: 'navaya_night',
  babyName:  'navaya_baby_name',
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
  // session = { id, side, startedAt, endedAt, durationSecs, mood }
  sessions.unshift(session);
  // Keep last 500 sessions
  const trimmed = sessions.slice(0, 500);
  localStorage.setItem(KEYS.sessions, JSON.stringify(trimmed));
  return trimmed;
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

// ── Preferences ──────────────────────────────────────────────────────────────

export function getNightMode() {
  return localStorage.getItem(KEYS.nightMode) === 'true';
}

export function setNightMode(val) {
  localStorage.setItem(KEYS.nightMode, String(val));
}

export function getBabyName() {
  return localStorage.getItem(KEYS.babyName) || 'your baby';
}

export function setBabyName(name) {
  localStorage.setItem(KEYS.babyName, name);
}
