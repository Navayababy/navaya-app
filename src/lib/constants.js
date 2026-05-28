// Shared constants used across screens and modal components.

export const MOOD_EMOJI = ['😔', '😐', '🙂', '😊', '🤩']
export const MOOD_LABEL = ['Tough', 'Okay', 'Good', 'Great', 'Amazing']

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

export const MEDICINE_OPTIONS = [
  { id: 'paracetamol', label: 'Paracetamol', form: '120mg/5ml' },
  { id: 'ibuprofen',   label: 'Ibuprofen',   form: '100mg/5ml' },
  { id: 'amoxicillin', label: 'Amoxicillin', form: 'Prescription' },
  { id: 'other',       label: 'Other',       form: 'Custom' },
]
