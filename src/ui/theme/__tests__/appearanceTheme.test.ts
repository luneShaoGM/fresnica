import { contrastText, createAppearanceTheme } from '../appearanceTheme';
it('resolves light/dark semantic surfaces and status bars', () => {
  expect(createAppearanceTheme(false).statusBarContent).toBe('dark');
  expect(createAppearanceTheme(true).statusBarContent).toBe('light');
  expect(createAppearanceTheme(true).colors.background).not.toBe(createAppearanceTheme(false).colors.background);
});
it('generates related colors and readable action/strong text even for white and black source images', () => {
  for (const dark of [true, false])
    for (const color of ['#FFFFFF', '#000000', '#FFFF00', '#00FF00']) {
      const theme = createAppearanceTheme(dark, { primary: color, secondary: color });
      expect(theme.colors.onActionPrimary).toBe(contrastText(theme.colors.actionPrimary));
      expect(theme.colors.onSurfaceStrong).toBe(contrastText(theme.colors.surfaceStrong));
      expect(theme.colors.actionPrimaryMuted).toMatch(/^rgba/);
      expect(theme.colors.actionPrimary).not.toBe(dark ? '#000000' : '#FFFFFF');
    }
});
