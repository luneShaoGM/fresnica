import type {AppTheme} from './types';

export const defaultTheme = {
  colors: {
    background: '#FFFFFF',
    surface: '#FFFFFF',
    surfaceMuted: '#F3F6FA',
    textPrimary: '#000000',
    textSecondary: '#606885',
    border: '#E7EAF0',
    actionPrimary: '#00CA8A',
    actionPrimaryPressed: '#00B279',
    onActionPrimary: '#FFFFFF',
    overlayBackdrop: 'rgba(24, 29, 65, 0.42)',
    negative: '#FF5B5B',
    positive: '#00CA8A',
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 20,
    xl: 28,
    xxl: 40,
  },
  radii: {
    sm: 6,
    md: 10,
    lg: 14,
    pill: 999,
  },
  typography: {
    eyebrow: {fontSize: 11, lineHeight: 14, fontWeight: '700'},
    title: {fontSize: 28, lineHeight: 34, fontWeight: '700'},
    sectionTitle: {fontSize: 18, lineHeight: 22, fontWeight: '700'},
    body: {fontSize: 16, lineHeight: 22, fontWeight: '400'},
    label: {fontSize: 14, lineHeight: 18, fontWeight: '600'},
    caption: {fontSize: 12, lineHeight: 16, fontWeight: '400'},
    button: {fontSize: 15, lineHeight: 19, fontWeight: '700'},
  },
} as const satisfies AppTheme;
