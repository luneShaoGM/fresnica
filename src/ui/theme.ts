// Visual tokens are intentionally derived from the Stellar donor UI.
// Fresnica keeps these tokens local so donor presentation can be reused
// without importing donor services, persistence or transaction semantics.
export const palette = {
  background: '#FFFFFF',
  surface: '#FFFFFF',
  surfaceMuted: '#F3F6FA',
  tint: '#F3F6FA',
  contrast: '#181D41',
  text: '#000000',
  textMuted: '#606885',
  border: '#E6E9F0',
  accent: '#00CA8A',
  accentPressed: '#00B279',
  accentText: '#FFFFFF',
  darkBlue: '#181D41',
  green: '#00CA8A',
  danger: '#FF5B5B',
  success: '#00CA8A',
  white: '#FFFFFF',
  black: '#000000',
} as const;

export const spacing = {
  xs: 6,
  sm: 10,
  md: 15,
  lg: 20,
  xl: 30,
  xxl: 40,
} as const;

export const radius = {
  sm: 8,
  md: 11,
  lg: 12,
  pill: 999,
} as const;

export const typography = {
  eyebrow: {fontSize: 12, lineHeight: 16, fontWeight: '700' as const},
  title: {fontSize: 30, lineHeight: 36, fontWeight: '700' as const},
  sectionTitle: {fontSize: 20, lineHeight: 25, fontWeight: '700' as const},
  body: {fontSize: 15, lineHeight: 21, fontWeight: '400' as const},
  label: {fontSize: 14, lineHeight: 19, fontWeight: '700' as const},
  caption: {fontSize: 12, lineHeight: 17, fontWeight: '400' as const},
  button: {fontSize: 15, lineHeight: 20, fontWeight: '700' as const},
} as const;
