import type {AppTheme as NativeUiTheme} from '@fresnica/ui-native';

import {createAppTheme} from '../createAppTheme';
import {defaultTheme} from '../defaultTheme';
import {toNativeUiTheme} from '../toNativeUiTheme';

const base: NativeUiTheme = {
  mode: 'light',
  colors: {
    background: 'base-background',
    surface: 'base-surface',
    surfaceRaised: 'base-raised',
    primary: 'base-primary',
    primaryPressed: 'base-pressed',
    onPrimary: 'base-on-primary',
    accentPurple: 'base-purple',
    accentPurpleContainer: 'base-purple-container',
    accentBlue: 'base-blue',
    accentBlueContainer: 'base-blue-container',
    accentOrange: 'base-orange',
    accentOrangeContainer: 'base-orange-container',
    accentYellow: 'base-yellow',
    accentYellowContainer: 'base-yellow-container',
    contentPrimary: 'base-text',
    contentSecondary: 'base-secondary',
    contentMuted: 'base-muted',
    border: 'base-border',
    separator: 'base-separator',
    positive: 'base-positive',
    negative: 'base-negative',
    warning: 'base-warning',
    overlay: 'base-overlay',
    statusBar: 'base-status-bar',
    navigationBar: 'base-navigation-bar',
  },
  spacing: {xs: 4, sm: 8, md: 12, lg: 16, xl: 24},
  radii: {sm: 4, control: 8, base: 12, lg: 16, pill: 999},
  typography: {body: 16, supporting: 14, action: 16, sectionTitle: 20, screenTitle: 26, display: 36},
  sizes: {controlSm: 28, controlCompact: 36, controlBase: 44, controlEmphasis: 52, controlLg: 56, border: 1},
  systemBars: {statusBarStyle: 'dark-content', navigationBarStyle: 'dark-content'},
};

describe('toNativeUiTheme', () => {
  it('maps the App semantic presentation colors without creating another theme authority', () => {
    const result = toNativeUiTheme(defaultTheme, base);

    expect(result.colors).toEqual(
      expect.objectContaining({
        background: defaultTheme.colors.background,
        surface: defaultTheme.colors.surface,
        surfaceRaised: defaultTheme.colors.surfaceMuted,
        primary: defaultTheme.colors.actionPrimary,
        primaryPressed: defaultTheme.colors.actionPrimaryPressed,
        onPrimary: defaultTheme.colors.onActionPrimary,
        contentPrimary: defaultTheme.colors.textPrimary,
        contentSecondary: defaultTheme.colors.textSecondary,
        contentMuted: defaultTheme.colors.textTertiary,
        positive: defaultTheme.colors.positive,
        negative: defaultTheme.colors.negative,
        warning: defaultTheme.colors.warning,
      }),
    );
    expect(result.colors.accentPurple).toBe(base.colors.accentPurple);
    expect(result.colors.accentBlue).toBe(base.colors.accentBlue);
    expect(result.spacing).toBe(base.spacing);
    expect(result.radii).toBe(base.radii);
    expect(result.typography).toBe(base.typography);
    expect(result.sizes).toBe(base.sizes);
    expect(result.systemBars.statusBarStyle).toBe('dark-content');
    expect(base.colors.primary).toBe('base-primary');
  });

  it('reflects a complete App custom-theme override without mutating the pinned library base', () => {
    const custom = createAppTheme({
      kind: 'image',
      primary: '#13579B',
      secondary: '#123456',
      statusBarContent: 'light',
      semantic: {background: '#090909', textPrimary: '#FAFAFA', negative: '#AB1212'},
    });

    const result = toNativeUiTheme(custom, base);
    expect(result.colors.primary).toBe('#13579B');
    expect(result.colors.background).toBe('#090909');
    expect(result.colors.contentPrimary).toBe('#FAFAFA');
    expect(result.colors.negative).toBe('#AB1212');
    expect(result.systemBars.statusBarStyle).toBe('light-content');
    expect(result.systemBars.navigationBarStyle).toBe('light-content');
    expect(base.systemBars.statusBarStyle).toBe('dark-content');
  });
});
