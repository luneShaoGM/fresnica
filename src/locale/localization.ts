import {
  LOCALE_DESCRIPTORS,
  resolveLocale,
  type LocaleDescriptor,
  type SupportedLocale,
} from './locales';

type TranslationDictionary = Readonly<Record<string, string>>;
export type TranslationParams = Readonly<Record<string, string | number>>;

export type LocaleOption = LocaleDescriptor &
  Readonly<{
    translated: boolean;
  }>;

export type LocalizationRuntime = Readonly<{
  locale: SupportedLocale;
  locales: readonly LocaleOption[];
  t: (key: string, params?: TranslationParams) => string;
  tPlural: (baseKey: string, count: number, params?: TranslationParams) => string;
  formatNumber: (value: string | number, precision?: number) => string;
  formatDate: (value: Date | string | number) => string;
}>;

const englishTranslations = require('./translations/en.json') as TranslationDictionary;
const translations: Partial<Record<SupportedLocale, TranslationDictionary>> = {
  en: englishTranslations,
  zh: require('./translations/zh.json') as TranslationDictionary,
  'zh-TW': require('./translations/zh-TW.json') as TranslationDictionary,
};

export function createLocalization(localeInput: string): LocalizationRuntime {
  const locale = resolveLocale(localeInput);
  const localeTranslations = translations[locale];

  const t = (key: string, params: TranslationParams = {}): string => {
    const template = localeTranslations?.[key] ?? englishTranslations[key] ?? key;
    return interpolate(template, params);
  };

  const tPlural = (
    baseKey: string,
    count: number,
    params: TranslationParams = {},
  ): string => {
    const category = new Intl.PluralRules(locale).select(count);
    const categoryKey = `${baseKey}.${category}`;
    const otherKey = `${baseKey}.other`;
    const key = hasTranslationKey(locale, categoryKey) ? categoryKey : otherKey;
    return t(key, {...params, count});
  };

  return {
    locale,
    locales: LOCALE_DESCRIPTORS.map(descriptor => ({
      ...descriptor,
      translated: Boolean(translations[descriptor.code]),
    })),
    t,
    tPlural,
    formatNumber: (value, precision = 8) => formatNumber(value, locale, precision),
    formatDate: value => formatDate(value, locale),
  };
}

function hasTranslationKey(locale: SupportedLocale, key: string): boolean {
  return Boolean(translations[locale]?.[key] ?? englishTranslations[key]);
}

function interpolate(template: string, params: TranslationParams): string {
  return template.replace(/\{\{([A-Za-z0-9_]+)\}\}/g, (match, key: string) => {
    const value = params[key];
    return value === undefined ? match : String(value);
  });
}

function formatNumber(
  value: string | number,
  locale: SupportedLocale,
  precision: number,
): string {
  const raw = String(value).trim();
  const match = /^([+-]?)(\d+)(?:\.(\d+))?$/.exec(raw);
  if (!match) {
    return raw;
  }

  const safePrecision = Math.max(0, Math.trunc(precision));
  const fraction = (match[3] ?? '').slice(0, safePrecision).replace(/0+$/, '');
  const parts = new Intl.NumberFormat(locale).formatToParts(12345.6);
  const groupSeparator = parts.find(part => part.type === 'group')?.value ?? ',';
  const decimalSeparator = parts.find(part => part.type === 'decimal')?.value ?? '.';
  const groupedInteger = match[2].replace(/\B(?=(\d{3})+(?!\d))/g, groupSeparator);

  return `${match[1]}${groupedInteger}${fraction ? `${decimalSeparator}${fraction}` : ''}`;
}

function formatDate(value: Date | string | number, locale: SupportedLocale): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}
