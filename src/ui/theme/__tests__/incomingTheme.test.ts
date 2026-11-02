import { createAppTheme } from '../createAppTheme';
import { defaultTheme } from '../defaultTheme';
it('keeps income blue independent of action/positive green and supports semantic palette overrides', () => {
  expect(defaultTheme.colors.incoming).toBe('#2563EB');
  expect(defaultTheme.colors.incoming).not.toBe(defaultTheme.colors.positive);
  const seed = { kind: 'image', primary: '#123456', secondary: '#654321' } as const;
  expect(createAppTheme(seed).colors.incoming).toBe(defaultTheme.colors.incoming);
  const custom = createAppTheme({ ...seed, semantic: { incoming: '#4455EE' } });
  expect(custom.colors.incoming).toBe('#4455EE');
  expect(custom.colors.actionPrimary).toBe(seed.primary);
  expect(custom.colors.positive).toBe(defaultTheme.colors.positive);
});
