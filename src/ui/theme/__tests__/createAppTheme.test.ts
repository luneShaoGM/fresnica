import {createAppTheme, DEFAULT_THEME_SEED} from '../createAppTheme';
import {defaultTheme} from '../defaultTheme';

const IMAGE_SEED = {
  kind: 'image',
  primary: '#123456',
  secondary: '#654321',
  primaryPressed: '#102F4D',
  onPrimary: '#FFFFFF',
} as const;

describe('createAppTheme', () => {
  it('returns the default theme for the default seed', () => {
    expect(createAppTheme(DEFAULT_THEME_SEED)).toBe(defaultTheme);
  });

  it('maps an image palette seed into semantic theme roles', () => {
    const theme = createAppTheme(IMAGE_SEED);

    expect(theme.colors.primary).toBe(IMAGE_SEED.primary);
    expect(theme.colors.secondary).toBe(IMAGE_SEED.secondary);
    expect(theme.colors.actionPrimary).toBe(IMAGE_SEED.primary);
    expect(theme.colors.actionPrimaryPressed).toBe(IMAGE_SEED.primaryPressed);
    expect(theme.colors.onActionPrimary).toBe(IMAGE_SEED.onPrimary);
    expect(theme.colors.surfaceStrong).toBe(IMAGE_SEED.secondary);
    expect(theme.spacing).toBe(defaultTheme.spacing);
    expect(theme.radii).toBe(defaultTheme.radii);
    expect(theme.typography).toBe(defaultTheme.typography);
  });

  it('accepts semantic overrides without changing primary and secondary identity', () => {
    const theme = createAppTheme({
      ...IMAGE_SEED,
      semantic: {
        background: '#F7F7F7',
        actionPrimary: '#ABCDEF',
      },
    });

    expect(theme.colors.background).toBe('#F7F7F7');
    expect(theme.colors.actionPrimary).toBe('#ABCDEF');
    expect(theme.colors.primary).toBe(IMAGE_SEED.primary);
    expect(theme.colors.secondary).toBe(IMAGE_SEED.secondary);
  });
});
