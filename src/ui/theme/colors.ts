import type {ThemeColors} from './types';

export const defaultThemeColors = {
  primary: '#00CA8A',
  secondary: '#181D41',
  background: '#FFFFFF',
  surface: '#FFFFFF',
  surfaceMuted: '#F3F6FA',
  surfaceStrong: '#181D41',
  textPrimary: '#000000',
  textSecondary: '#606885',
  textTertiary: '#ACB1C1',
  border: '#E7EAF0',
  actionPrimary: '#00CA8A',
  actionPrimaryPressed: '#00B279',
  onActionPrimary: '#FFFFFF',
  overlayBackdrop: 'rgba(24, 29, 65, 0.42)',
  negative: '#FF5B5B',
  positive: '#00CA8A',
} as const satisfies ThemeColors;
