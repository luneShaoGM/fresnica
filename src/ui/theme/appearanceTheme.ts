import type { AppTheme, ThemeColors } from './types';
import { defaultTheme } from './defaultTheme';

export const darkThemeColors: ThemeColors = {
  ...defaultTheme.colors,
  background: '#10131E',
  surface: '#191E2D',
  surfaceMuted: '#242C40',
  surfaceStrong: '#DCE3FA',
  secondary: '#DCE3FA',
  textPrimary: '#F4F6FD',
  textSecondary: '#C0C9E2',
  textTertiary: '#A6B2CF',
  border: '#3B4764',
  separatorSubtle: '#3B4764',
  onSurfaceStrong: '#10131E',
  onSurfaceStrongMuted: '#303C58',
  negative: '#FF9999',
  negativeStrong: '#FFB3B3',
  negativeMuted: '#4B242D',
  incoming: '#91B7FF',
  positive: '#5AE2B3',
  positiveMuted: '#183D36',
  warning: '#F8D477',
  warningMuted: '#423820',
  overlayBackdrop: 'rgba(0,0,0,0.65)',
};
export function contrastText(color: string): string {
  const channels = [1, 3, 5]
    .map(i => parseInt(color.slice(i, i + 2), 16) / 255)
    .map(v => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  const luminance = channels[0]! * 0.2126 + channels[1]! * 0.7152 + channels[2]! * 0.0722;
  return luminance > 0.179 ? '#000000' : '#FFFFFF';
}
function tint(hex: string, alpha: number): string {
  return `rgba(${parseInt(hex.slice(1, 3), 16)},${parseInt(hex.slice(3, 5), 16)},${parseInt(hex.slice(5, 7), 16)},${alpha})`;
}
export function createAppearanceTheme(
  dark: boolean,
  palette?: Readonly<{ primary: string; secondary: string }>,
): AppTheme {
  const base = dark ? darkThemeColors : defaultTheme.colors;
  const primary = palette ? readableAccent(palette.primary, dark) : base.primary;
  const strong = palette ? readableAccent(palette.secondary, dark) : base.surfaceStrong;
  return {
    ...defaultTheme,
    colors: {
      ...base,
      primary,
      secondary: strong,
      surfaceStrong: strong,
      onSurfaceStrong: contrastText(strong),
      onSurfaceStrongMuted: contrastText(strong),
      actionPrimary: primary,
      actionPrimaryPressed: primary,
      onActionPrimary: contrastText(primary),
      actionPrimarySubtle: tint(primary, 0.05),
      actionPrimarySoft: tint(primary, 0.08),
      actionPrimaryMuted: tint(primary, 0.12),
      actionPrimaryDecoration: tint(primary, 0.14),
      actionPrimaryOutline: tint(primary, 0.24),
      actionPrimaryTrack: tint(primary, 0.35),
    },
    statusBarContent: dark ? 'light' : 'dark',
  };
}

// Palette colors also appear as text/icons on surfaces; keep them legible in either appearance.
function readableAccent(color: string, dark: boolean): string {
  const channels = [1, 3, 5].map(i => parseInt(color.slice(i, i + 2), 16));
  const limit = dark ? 190 : 80;
  const adjust = dark ? Math.max : Math.min;
  return '#' + channels.map(value => adjust(value, limit).toString(16).padStart(2, '0')).join('');
}
