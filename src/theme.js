// theme.js
// All brand colours in one place.
// night = true switches to the dark palette used after dark.

export const light = {
  bg:        '#F5F0EB',
  card:      '#FDFAF7',
  border:    '#EDE5D8',
  navBg:     '#FDFAF7',
  navBdr:    '#E8DDD0',
  text:      '#2C2424',
  sub:       '#6B5347',   // darkened from #9A8878 — 6.2:1 on light bg
  heading:   '#4A3728',   // brand.bark — for display/heading text
  navActive: '#4A3728',   // active nav item
};

export const dark = {
  bg:        '#1A1410',
  card:      '#241E18',
  border:    '#3A3028',
  navBg:     '#241E18',
  navBdr:    '#3A3028',
  text:      '#EDE5D8',
  sub:       '#BCA898',   // lightened from #9A8878 — 7.6:1 on dark bg
  heading:   '#EDE5D8',   // parchment — for display/heading text
  navActive: '#E0CFBC',   // warm off-white — 10:1 on dark nav bg
};

export const brand = {
  bark:    '#4A3728',
  sand:    '#C4A882',
  parchment: '#EDE5D8',
  cream:   '#F5F0EB',
  green:   '#6B8F71',
  accent:  '#D4956A',
  mist:    '#7FA3B5',   // cool counterpoint used only to tell the four Home actions apart
  rose:    '#C46B6B',   // medicine's accent in the same Home action family
  danger:  '#B5544B',   // warm-toned red for delete/destructive actions — sits with the palette instead of a cold generic red
  // A slightly richer, two-stop version of bark for primary buttons and hero
  // rows — same colour at a glance, but with the soft light-to-dark taper
  // that keeps a solid brown fill from reading flat/dated.
  barkGradient: 'linear-gradient(135deg, #55402E 0%, #4A3728 55%, #3D2D20 100%)',
};

export function palette(night) {
  return night ? dark : light;
}

// Soft elevation for cards — warm umber-tinted in light mode (so shadows read
// as "lifted paper" rather than generic grey), plain black at low opacity in
// dark mode (a tinted shadow is invisible against a near-black card anyway).
// level 1 = resting cards, 2 = the primary timer/log card on each tab,
// 3 = sheets/modals and the weekly-insights panel.
const LIGHT_SHADOW = {
  1: '0 1px 2px rgba(74,55,40,0.05), 0 4px 12px rgba(74,55,40,0.05)',
  2: '0 2px 6px rgba(74,55,40,0.06), 0 10px 24px rgba(74,55,40,0.08)',
  3: '0 6px 16px rgba(74,55,40,0.09), 0 20px 44px rgba(74,55,40,0.11)',
};
const DARK_SHADOW = {
  1: '0 1px 2px rgba(0,0,0,0.3), 0 4px 12px rgba(0,0,0,0.22)',
  2: '0 2px 6px rgba(0,0,0,0.35), 0 10px 24px rgba(0,0,0,0.28)',
  3: '0 6px 16px rgba(0,0,0,0.4), 0 20px 44px rgba(0,0,0,0.34)',
};

export function shadow(night, level = 1) {
  return (night ? DARK_SHADOW : LIGHT_SHADOW)[level] || LIGHT_SHADOW[1];
}

// Soft radial tint for icon "wells" (the circular badges atop each screen
// header and inside action rows) — a gentle glow behind the glyph instead of
// a flat, even tint, so the icon reads as sitting slightly forward.
export function iconWellBg(hex) {
  return `radial-gradient(circle at 32% 28%, ${hex}45 0%, ${hex}1C 72%)`;
}
