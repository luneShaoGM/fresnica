import {defaultTheme} from './defaultTheme';
import type {AppTheme, ThemeSeed} from './types';

export const DEFAULT_THEME_SEED = {kind: 'default'} as const satisfies ThemeSeed;

export function createAppTheme(seed: ThemeSeed = DEFAULT_THEME_SEED): AppTheme {
  if (seed.kind === 'default') {
    return defaultTheme;
  }

  const semantic = seed.semantic ?? {};
  return {
    colors: {
      ...defaultTheme.colors,
      ...semantic,
      primary: seed.primary,
      secondary: seed.secondary,
      actionPrimary: semantic.actionPrimary ?? seed.primary,
      actionPrimaryPressed:
        semantic.actionPrimaryPressed ?? seed.primaryPressed ?? seed.primary,
      onActionPrimary:
        semantic.onActionPrimary ?? seed.onPrimary ?? defaultTheme.colors.onActionPrimary,
      surfaceStrong: semantic.surfaceStrong ?? seed.secondary,
    },
    spacing: defaultTheme.spacing,
    radii: defaultTheme.radii,
    typography: defaultTheme.typography,
  };
}
