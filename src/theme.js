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
};

export function palette(night) {
  return night ? dark : light;
}
