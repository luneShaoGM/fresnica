import {
  createLocalization,
  LOCALE_DESCRIPTORS,
  resolveLocale,
} from '..';

describe('localization', () => {
  it('preserves Stellar canonical locale inventory and compatibility aliases', () => {
    const codes = LOCALE_DESCRIPTORS.map(locale => locale.code);

    for (const code of [
      'af',
      'ar',
      'bn-BD',
      'en-AU',
      'es-419',
      'gl-ES',
      'hi-IN',
      'no-NO',
      'pt-BR',
      'ta-IN',
      'te-IN',
      'zh',
      'zh-TW',
    ]) {
      expect(codes).toContain(code);
    }

    expect(resolveLocale('zh_CN')).toBe('zh');
    expect(resolveLocale('es_MX')).toBe('es-419');
    expect(resolveLocale('iw-IL')).toBe('he');
    expect(resolveLocale('en-US')).toBe('en');
  });

  it('falls back from an unsupported regional locale to its base language, then English', () => {
    expect(resolveLocale('fr-CA')).toBe('fr');
    expect(resolveLocale('xx-YY')).toBe('en');
  });

  it('falls back per translation key while preserving the selected locale', () => {
    const french = createLocalization('fr');
    expect(french.locale).toBe('fr');
    expect(french.t('nav.home')).toBe('Home');

    const simplifiedChinese = createLocalization('zh-CN');
    expect(simplifiedChinese.locale).toBe('zh');
    expect(simplifiedChinese.t('nav.home')).toBe('首页');
  });

  it('interpolates and pluralizes account counts', () => {
    const english = createLocalization('en');
    expect(english.tPlural('settings.accountCount', 1)).toBe('1 account');
    expect(english.tPlural('settings.accountCount', 2)).toBe('2 accounts');
  });

  it('pluralizes without Intl.PluralRules', () => {
    const intl = Intl as typeof Intl & {PluralRules?: unknown};
    const original = intl.PluralRules;
    Reflect.deleteProperty(intl, 'PluralRules');

    try {
      const english = createLocalization('en');
      expect(english.tPlural('settings.accountCount', 1)).toBe('1 account');
      expect(english.tPlural('settings.accountCount', 2)).toBe('2 accounts');

      const chinese = createLocalization('zh');
      expect(chinese.tPlural('settings.accountCount', 1)).toBe('1 个账户');
      expect(chinese.tPlural('settings.accountCount', 2)).toBe('2 个账户');
    } finally {
      intl.PluralRules = original;
    }
  });

  it('formats decimal strings without converting wallet values through floating point', () => {
    const german = createLocalization('de');
    expect(german.formatNumber('1234567.890000')).toBe('1.234.567,89');
    expect(german.formatNumber('9999999999999999.123456789', 8)).toBe(
      '9.999.999.999.999.999,12345678',
    );
  });

  it('marks only migrated Fresnica dictionaries as translated', () => {
    const locales = createLocalization('en').locales;
    expect(locales.find(locale => locale.code === 'en')?.translated).toBe(true);
    expect(locales.find(locale => locale.code === 'zh')?.translated).toBe(true);
    expect(locales.find(locale => locale.code === 'zh-TW')?.translated).toBe(true);
    expect(locales.find(locale => locale.code === 'fr')?.translated).toBe(false);
  });
});
