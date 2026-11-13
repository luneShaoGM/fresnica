import {
  createGeneralPreferences,
  DEFAULT_GENERAL_PREFERENCES,
  paletteFromSamples,
  validateGeneralPreferences,
} from '../generalPreferences';
it('persists validated preferences, publishes after save, and restores them', () => {
  let stored: unknown;
  const save = jest.fn(value => {
    stored = value;
  });
  const preferences = createGeneralPreferences({ load: () => stored, save });
  const changed = jest.fn();
  preferences.subscribe(changed);
  preferences.update({ theme: 'dark', currency: 'CNY', haptics: false });
  expect(changed).toHaveBeenCalledTimes(1);
  expect(createGeneralPreferences({ load: () => stored, save }).getSnapshot()).toMatchObject({
    theme: 'dark',
    currency: 'CNY',
    haptics: false,
  });
});
it('keeps previous values if saving fails and refuses late retired writes', () => {
  const failed = createGeneralPreferences({
    load: () => undefined,
    save: () => {
      throw new Error('disk');
    },
  });
  expect(() => failed.update({ theme: 'dark' })).toThrow();
  expect(failed.getSnapshot()).toBe(DEFAULT_GENERAL_PREFERENCES);
  const save = jest.fn();
  const retired = createGeneralPreferences({ load: () => undefined, save }, () => {
    throw new Error('retired');
  });
  expect(() => retired.update({ currency: 'EUR' })).toThrow();
  expect(save).not.toHaveBeenCalled();
});
it('falls back on corrupt public preferences and rejects invalid palettes and enums', () => {
  expect(createGeneralPreferences({ load: () => '{broken}', save: jest.fn() }).getSnapshot()).toBe(
    DEFAULT_GENERAL_PREFERENCES,
  );
  for (const patch of [
    { theme: 'image' },
    { theme: 'unknown' },
    { currency: 'SSECRET' },
    { haptics: 'yes' },
    { imagePalette: { primary: 'url(red)', secondary: '#000000' } },
  ])
    expect(() => validateGeneralPreferences({ ...DEFAULT_GENERAL_PREFERENCES, ...patch })).toThrow();
});
it('keeps only the local palette, never image paths or data', () => {
  const palette = paletteFromSamples(['#111111', '#da5060', '#aaaaaa']);
  expect(palette).toEqual({ primary: '#DA5060', secondary: '#111111' });
  expect(
    validateGeneralPreferences({
      ...DEFAULT_GENERAL_PREFERENCES,
      theme: 'image',
      imagePalette: palette,
      path: '/private/photo.jpg',
    }),
  ).not.toHaveProperty('path');
  expect(() => paletteFromSamples(['file:///private/photo.jpg'])).toThrow();
});
