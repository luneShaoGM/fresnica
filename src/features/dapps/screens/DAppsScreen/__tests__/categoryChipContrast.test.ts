import { defaultTheme } from '@ui/theme';
import { createAppearanceTheme } from '@ui/theme/appearanceTheme';

import { createStyles } from '../styles';

describe('dApps category chip contrast', () => {
  it.each([
    ['light', false],
    ['dark', true],
  ])('uses the matching selected-background text token in %s mode', (_mode, dark) => {
    const theme = createAppearanceTheme(dark);
    const styles = createStyles(theme);

    expect(styles.chipSelected.backgroundColor).toBe(theme.colors.surfaceStrong);
    expect(styles.chipTextSelected.color).toBe(theme.colors.onSurfaceStrong);
  });

  it('stays readable with a custom color palette', () => {
    const theme = createAppearanceTheme(true, {
      primary: defaultTheme.colors.actionPrimary,
      secondary: defaultTheme.colors.surfaceStrong,
    });
    const styles = createStyles(theme);

    expect(styles.chipTextSelected.color).toBe(theme.colors.onSurfaceStrong);
  });
});
