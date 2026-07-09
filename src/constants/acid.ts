// Acid on Moss — the redesign token set (direction 02, dark-only).
// Screens migrate to these tokens one at a time; anything not yet migrated
// keeps reading the legacy theme. When the sweep completes, this becomes the
// app theme and the legacy palette is deleted.
export const Acid = {
  // grounds
  moss: '#0C120D',
  mossDeep: '#080D09',
  // the one accent
  lime: '#C6F432',
  limeDim: '#87A81F',
  limeSoft: 'rgba(198,244,50,0.12)',
  // text ramp (bone)
  tx: '#EEF2E6',
  tx2: '#9AA894',
  tx3: '#5C685A',
  // hairlines — separation without boxes
  hair: '#1E2A1F',
  hair2: '#27352A',
  // data semantics (never used for chrome)
  protein: '#7CC8E0',
  carbs: '#EDBB55',
  fat: '#C79BE0',
  good: '#8FD98A',
  error: '#FF9B7A',
  // type
  serif: 'Fraunces_600SemiBold',
  serifItalic: 'Fraunces_600SemiBold_Italic',
} as const;
