import {defaultTheme} from '../defaultTheme';
import {palette, radius, spacing, typography} from '../../theme';

describe('default theme compatibility facade', () => {
  it('keeps legacy palette exports mapped to semantic colors', () => {
    expect(defaultTheme.colors.primary).toBe(defaultTheme.colors.actionPrimary);
    expect(defaultTheme.colors.secondary).toBe(defaultTheme.colors.surfaceStrong);
    expect(palette.background).toBe(defaultTheme.colors.background);
    expect(palette.surface).toBe(defaultTheme.colors.surface);
    expect(palette.surfaceMuted).toBe(defaultTheme.colors.surfaceMuted);
    expect(palette.text).toBe(defaultTheme.colors.textPrimary);
    expect(palette.textMuted).toBe(defaultTheme.colors.textSecondary);
    expect(palette.border).toBe(defaultTheme.colors.border);
    expect(palette.accent).toBe(defaultTheme.colors.actionPrimary);
    expect(palette.accentPressed).toBe(defaultTheme.colors.actionPrimaryPressed);
    expect(palette.accentText).toBe(defaultTheme.colors.onActionPrimary);
    expect(palette.danger).toBe(defaultTheme.colors.negative);
    expect(palette.success).toBe(defaultTheme.colors.positive);
  });

  it('reuses semantic spacing, radii and typography tokens', () => {
    expect(spacing).toBe(defaultTheme.spacing);
    expect(radius).toBe(defaultTheme.radii);
    expect(typography).toBe(defaultTheme.typography);
  });
});
