import type {AppTheme} from './types';

export const defaultTheme = {
  colors: {
    background: '#F5F7FB',
    surface: '#FFFFFF',
    surfaceMuted: '#EEF2F7',
    textPrimary: '#111827',
    textSecondary: '#667085',
    border: '#D8DEE9',
    actionPrimary: '#3D63DD',
    actionPrimaryPressed: '#3154C6',
    onActionPrimary: '#FFFFFF',
    overlayBackdrop: 'rgba(17, 24, 39, 0.48)',
    negative: '#B42318',
    positive: '#067647',
  },
  spacing: {
    xs: 6,
    sm: 10,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 48,
  },
  radii: {
    sm: 10,
    md: 14,
    lg: 20,
    pill: 999,
  },
  typography: {
    eyebrow: {fontSize: 12, lineHeight: 16, fontWeight: '700'},
    title: {fontSize: 32, lineHeight: 38, fontWeight: '700'},
    sectionTitle: {fontSize: 19, lineHeight: 24, fontWeight: '700'},
    body: {fontSize: 16, lineHeight: 24, fontWeight: '400'},
    label: {fontSize: 14, lineHeight: 20, fontWeight: '600'},
    caption: {fontSize: 13, lineHeight: 19, fontWeight: '400'},
    button: {fontSize: 16, lineHeight: 20, fontWeight: '700'},
  },
} as const satisfies AppTheme;
