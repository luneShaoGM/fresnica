import {defaultTheme} from './defaultTheme';
import type {AppTheme, ThemeSeed, ThemeStatusBarContent} from './types';

export const DEFAULT_THEME_SEED = {kind: 'default'} as const satisfies ThemeSeed;

export function createAppTheme(seed: ThemeSeed = DEFAULT_THEME_SEED): AppTheme {
  if (seed.kind === 'default') {
    return defaultTheme;
  }

  const semantic = seed.semantic ?? {};
  const colors = {
    ...defaultTheme.colors,
    ...semantic,
    primary: seed.primary,
    secondary: seed.secondary,
    actionPrimary: semantic.actionPrimary ?? seed.primary,
    actionPrimaryPressed: semantic.actionPrimaryPressed ?? seed.primaryPressed ?? seed.primary,
    onActionPrimary: semantic.onActionPrimary ?? seed.onPrimary ?? defaultTheme.colors.onActionPrimary,
    surfaceStrong: semantic.surfaceStrong ?? seed.secondary,
  };

  return {
    colors,
    spacing: defaultTheme.spacing,
    radii: defaultTheme.radii,
    typography: defaultTheme.typography,
    statusBarContent: seed.statusBarContent ?? resolveStatusBarContent(colors.background),
  };
}

export function resolveStatusBarContent(background: string): ThemeStatusBarContent {
  const rgb = parseHexColor(background);
  if (!rgb) {
    return defaultTheme.statusBarContent;
  }

  return relativeLuminance(rgb) > 0.179 ? 'dark' : 'light';
}

function parseHexColor(color: string): readonly [number, number, number] | undefined {
  const normalized = color.trim();
  const shortMatch = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/i.exec(normalized);
  if (shortMatch) {
    const [, red, green, blue] = shortMatch;
    if (!red || !green || !blue) {
      return undefined;
    }
    return [
      Number.parseInt(red + red, 16),
      Number.parseInt(green + green, 16),
      Number.parseInt(blue + blue, 16),
    ];
  }

  const longMatch = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(normalized);
  if (!longMatch) {
    return undefined;
  }
  const [, red, green, blue] = longMatch;
  if (!red || !green || !blue) {
    return undefined;
  }

  return [Number.parseInt(red, 16), Number.parseInt(green, 16), Number.parseInt(blue, 16)];
}

function relativeLuminance(rgb: readonly [number, number, number]): number {
  const [red, green, blue] = rgb;
  return (
    linearizeSrgbChannel(red) * 0.2126 +
    linearizeSrgbChannel(green) * 0.7152 +
    linearizeSrgbChannel(blue) * 0.0722
  );
}

function linearizeSrgbChannel(channel: number): number {
  const normalized = channel / 255;
  return normalized <= 0.04045
    ? normalized / 12.92
    : ((normalized + 0.055) / 1.055) ** 2.4;
}
