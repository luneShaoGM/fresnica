export const palette = {
  background: '#F5F7FB',
  surface: '#FFFFFF',
  surfaceMuted: '#EEF2F7',
  text: '#111827',
  textMuted: '#667085',
  border: '#D8DEE9',
  accent: '#3D63DD',
  accentPressed: '#3154C6',
  accentText: '#FFFFFF',
  danger: '#B42318',
  success: '#067647',
} as const;

export const spacing = {
  xs: 6,
  sm: 10,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const radius = {
  sm: 10,
  md: 14,
  lg: 20,
  pill: 999,
} as const;

export const typography = {
  eyebrow: {fontSize: 12, lineHeight: 16, fontWeight: '700' as const},
  title: {fontSize: 32, lineHeight: 38, fontWeight: '700' as const},
  sectionTitle: {fontSize: 19, lineHeight: 24, fontWeight: '700' as const},
  body: {fontSize: 16, lineHeight: 24, fontWeight: '400' as const},
  label: {fontSize: 14, lineHeight: 20, fontWeight: '600' as const},
  caption: {fontSize: 13, lineHeight: 19, fontWeight: '400' as const},
  button: {fontSize: 16, lineHeight: 20, fontWeight: '700' as const},
} as const;
