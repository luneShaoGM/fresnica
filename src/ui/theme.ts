import {defaultTheme} from './theme/defaultTheme';

export {AppThemeProvider} from './theme/AppThemeProvider';
export {createAppTheme, DEFAULT_THEME_SEED} from './theme/createAppTheme';
export {defaultTheme};
export {useAppTheme} from './theme/useAppTheme';
export {useThemedStyles} from './theme/useThemedStyles';
export type {
  AppTheme,
  ThemeColors,
  ThemeFontWeight,
  ThemeRadii,
  ThemeSeed,
  ThemeSpacing,
  ThemeTextStyle,
  ThemeTypography,
} from './theme/types';

// Legacy static facade for scaffolding that has not reached its F4 rewrite yet.
// Runtime-theme-aware code must use useAppTheme/useThemedStyles instead.
export const palette = {
  background: defaultTheme.colors.background,
  surface: defaultTheme.colors.surface,
  surfaceMuted: defaultTheme.colors.surfaceMuted,
  text: defaultTheme.colors.textPrimary,
  textMuted: defaultTheme.colors.textSecondary,
  border: defaultTheme.colors.border,
  accent: defaultTheme.colors.actionPrimary,
  accentPressed: defaultTheme.colors.actionPrimaryPressed,
  accentText: defaultTheme.colors.onActionPrimary,
  danger: defaultTheme.colors.negative,
  success: defaultTheme.colors.positive,
} as const;

export const spacing = defaultTheme.spacing;
export const radius = defaultTheme.radii;
export const typography = defaultTheme.typography;
