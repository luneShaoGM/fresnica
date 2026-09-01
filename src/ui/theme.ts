import {defaultTheme} from './theme/defaultTheme';

export {defaultTheme};
export {useAppTheme} from './theme/useAppTheme';
export {useThemedStyles} from './theme/useThemedStyles';
export type {
  AppTheme,
  ThemeColors,
  ThemeFontWeight,
  ThemeRadii,
  ThemeSpacing,
  ThemeTextStyle,
  ThemeTypography,
} from './theme/types';

// Compatibility facade for the current product shell. New/reworked UI should
// depend on semantic AppTheme fields instead of adding more legacy palette names.
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
