// Shared constants used across screens and modal components.

export const MOOD_EMOJI = ['😔', '😐', '🙂', '😊', '🤩']
export const MOOD_LABEL = ['Tough', 'Okay', 'Good', 'Great', 'Amazing']

// Bottle feeds: what was in the bottle
export const MILK_TYPE_LABEL = { expressed: 'Expressed', formula: 'Formula' }

// Bottle row text shared by Home recent feeds and the Logbook:
// "Bottle · 120ml · Formula", degrading gracefully when amount was skipped.
export function bottleLabel(s) {
  const parts = ['Bottle']
  if (s.amountMl) parts.push(`${s.amountMl}ml`)
  if (s.milkType && MILK_TYPE_LABEL[s.milkType]) parts.push(MILK_TYPE_LABEL[s.milkType])
  return parts.join(' · ')
}

export const POO_HEX   = { mustard: '#D4A843', yellow: '#EDD050', green: '#6B9E5C', brown: '#8B6347', dark: '#2D1F14' }
export const POO_LABEL = { mustard: 'Mustard', yellow: 'Yellow',  green: 'Green',   brown: 'Brown',   dark: 'Dark/Black' }

// Full POO_COLORS with clinical notes (note field is null when no note applies)
export const POO_COLORS = [
  { id: 'mustard', hex: '#D4A843', label: 'Mustard',    note: null },
  { id: 'yellow',  hex: '#EDD050', label: 'Yellow',     note: null },
  { id: 'green',   hex: '#6B9E5C', label: 'Green',      note: 'Green poo can indicate a foremilk/hindmilk imbalance — try longer feeds on one side.' },
  { id: 'brown',   hex: '#8B6347', label: 'Brown',      note: null },
  { id: 'dark',    hex: '#2D1F14', label: 'Dark/Black', note: '⚠ Dark or black poo in a baby over 5 days old should be checked by your midwife or GP.' },
]

// Default prepare-checklist items (shared by PrepareScreen and the Home card)
export const PREPARE_DEFAULT_ITEMS = [
  { id: 'cover',  emoji: '🌿', label: 'Navaya cover packed'            },
  { id: 'seat',   emoji: '🪑', label: 'Comfortable seat identified'    },
  { id: 'water',  emoji: '💧', label: 'Water bottle filled'            },
  { id: 'phone',  emoji: '🔋', label: 'Phone charged'                  },
  { id: 'pads',   emoji: '✨', label: 'Breast pads in bag'             },
  { id: 'muslin', emoji: '🤍', label: 'Muslin cloth packed'            },
]

export const MEDICINE_OPTIONS = [
  { id: 'paracetamol', label: 'Paracetamol', form: '120mg/5ml' },
  { id: 'ibuprofen',   label: 'Ibuprofen',   form: '100mg/5ml' },
  { id: 'amoxicillin', label: 'Amoxicillin', form: 'Prescription' },
  { id: 'other',       label: 'Other',       form: 'Custom' },
]

// Sleep-day model: a "sleep day" runs 07:00 → 07:00 so an overnight sleep
// belongs wholly to the evening it started. 19:00 splits naps from night.
export const SLEEP_DAY_START_HOUR = 7
export const NIGHT_START_HOUR = 19

// A sleep timer left running past this long is almost certainly a forgotten
// stop rather than a real sleep — used to surface a warning on the live
// timer so a stuck timer gets noticed and corrected instead of silently
// accumulating an implausible duration.
export const SLEEP_TIMER_WARN_SECS = 12 * 3600
