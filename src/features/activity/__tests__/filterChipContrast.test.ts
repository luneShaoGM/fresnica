import { defaultTheme } from '@ui/theme';
import { createAppearanceTheme } from '@ui/theme/appearanceTheme';

import { createStyles } from '../styles';

describe('Activity filter chip contrast', () => {
  it.each([
    ['light', false],
    ['dark', true],
  ])('matches selected labels to their background in %s mode', (_mode, dark) => {
    const theme = createAppearanceTheme(dark);
    const styles = createStyles(theme);

    expect(styles.filterChipSelected.backgroundColor).toBe(theme.colors.surfaceStrong);
    expect(styles.filterTextSelected.color).toBe(theme.colors.onSurfaceStrong);
  });

  it('supports custom color palettes', () => {
    const theme = createAppearanceTheme(true, {
      primary: defaultTheme.colors.actionPrimary,
      secondary: defaultTheme.colors.surfaceStrong,
    });
    const styles = createStyles(theme);

    expect(styles.filterTextSelected.color).toBe(theme.colors.onSurfaceStrong);
  });
});
