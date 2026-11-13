import { getDeviceLocale, getDeviceNumberLocale } from '../locales';
import { createLocalization } from '../localization';
it.each(['de-CH', 'fr-CH', 'en-IN'])('retains the full device number region %s separately from UI language', region => {
  const original = Intl.NumberFormat;
  const spy = jest
    .spyOn(Intl, 'NumberFormat')
    .mockImplementation((locales, options) => new original(locales ?? region, options));
  try {
    expect(getDeviceNumberLocale()).toBe(region);
    expect(getDeviceLocale()).not.toBe(region);
    const localization = createLocalization('en', getDeviceNumberLocale());
    const amount = '12345678901234567890.1234567';
    // Decimal formatting stays on strings; it must never round through Number.
    const formatted = localization.formatNumber(amount);
    expect(formatted.replace(/[^0-9]/g, '')).toBe(amount.replace('.', ''));
    const parts = new original(region).formatToParts(1234.5);
    expect(formatted).toContain(parts.find(p => p.type === 'decimal')!.value);
    expect(formatted).toContain(parts.find(p => p.type === 'group')!.value);
  } finally {
    spy.mockRestore();
  }
});
it('falls back safely on an invalid or unavailable device locale', () => {
  const spy = jest.spyOn(Intl, 'NumberFormat').mockImplementation(() => {
    throw new Error('unavailable');
  });
  expect(getDeviceNumberLocale()).toBe('en');
  spy.mockRestore();
});
