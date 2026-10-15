import type {AppTheme as NativeUiTheme} from '@fresnica/ui-native';

import type {AppTheme} from './types';

// Fresnica remains the theme authority. The library keeps its own reviewed
// dimensions and accent roles until product semantics justify overrides.
export function toNativeUiTheme(theme: AppTheme, base: NativeUiTheme): NativeUiTheme {
  const barStyle = theme.statusBarContent === 'dark' ? 'dark-content' : 'light-content';

  return {
    ...base,
    colors: {
      ...base.colors,
      background: theme.colors.background,
      surface: theme.colors.surface,
      surfaceRaised: theme.colors.surfaceMuted,
      primary: theme.colors.actionPrimary,
      primaryPressed: theme.colors.actionPrimaryPressed,
      onPrimary: theme.colors.onActionPrimary,
      contentPrimary: theme.colors.textPrimary,
      contentSecondary: theme.colors.textSecondary,
      contentMuted: theme.colors.textTertiary,
      border: theme.colors.border,
      separator: theme.colors.separatorSubtle,
      positive: theme.colors.positive,
      negative: theme.colors.negative,
      warning: theme.colors.warning,
      overlay: theme.colors.overlayBackdrop,
      statusBar: theme.colors.background,
      navigationBar: theme.colors.background,
    },
    systemBars: {
      ...base.systemBars,
      statusBarStyle: barStyle,
      navigationBarStyle: barStyle,
    },
  };
}
