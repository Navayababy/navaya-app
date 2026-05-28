// Canonical normalization functions for Supabase snake_case → camelCase conversion.
// Each function handles both already-normalized objects (early return) and raw Supabase rows.

export function normalizeFeedSession(s) {
  if ('startedAt' in s) return s
  return {
    id:           s.id,
    side:         s.side,
    startedAt:    s.started_at,
    endedAt:      s.ended_at,
    durationSecs: s.duration_secs,
    mood:         s.mood_score,
    loggedBy:     s.logged_by,
  }
}

export function normalizeNappy(n) {
  if ('loggedAt' in n) return n
  return {
    id:        n.id,
    type:      n.type,
    pooColor:  n.poo_color,
    loggedAt:  n.logged_at,
    loggedBy:  n.logged_by,
    createdBy: n.created_by,
    partnerId: n.partner_id,
  }
}

export function normalizeMedicine(m) {
  if ('loggedAt' in m) return m
  return {
    id:         m.id,
    name:       m.name,
    medicineId: m.medicine_id,
    doseMl:     m.dose_ml,
    form:       m.form,
    notes:      m.notes,
    loggedAt:   m.logged_at,
    loggedBy:   m.logged_by,
    createdBy:  m.created_by,
    partnerId:  m.partner_id,
  }
}
