export type LocaleDescriptor = Readonly<{
  code: string;
  englishName: string;
  localName: string;
}>;

export const LOCALE_DESCRIPTORS = [
  {code: 'en', englishName: 'English', localName: 'English'},
  {code: 'af', englishName: 'Afrikaans', localName: 'Afrikaans'},
  {code: 'ar', englishName: 'Arabic', localName: 'العربية'},
  {code: 'bg', englishName: 'Bulgarian', localName: 'Български'},
  {code: 'bn-BD', englishName: 'Bengali', localName: 'বাংলা Bangla'},
  {code: 'ca', englishName: 'Catalan', localName: 'Català'},
  {code: 'cs', englishName: 'Czech', localName: 'Čeština'},
  {code: 'da', englishName: 'Danish', localName: 'Dansk'},
  {code: 'de', englishName: 'German', localName: 'Deutsch'},
  {code: 'el', englishName: 'Greek', localName: 'Ελληνικά'},
  {code: 'en-AU', englishName: 'English (Australian)', localName: 'English (Australian)'},
  {code: 'es', englishName: 'Spanish (Spain)', localName: 'Español (España)'},
  {code: 'es-419', englishName: 'Spanish (Latin America)', localName: 'Español (Latinoamericanos)'},
  {code: 'et', englishName: 'Estonian', localName: 'Eesti keel'},
  {code: 'eu', englishName: 'Basque', localName: 'Euskara'},
  {code: 'fi', englishName: 'Finnish', localName: 'Suomi'},
  {code: 'fil', englishName: 'Filipino', localName: 'Wikang Filipino'},
  {code: 'fr', englishName: 'French', localName: 'Français'},
  {code: 'gl-ES', englishName: 'Galician', localName: 'Galego'},
  {code: 'gu', englishName: 'Gujarati', localName: 'ગુજરાતી'},
  {code: 'he', englishName: 'Hebrew', localName: 'עברית'},
  {code: 'hi-IN', englishName: 'Hindi', localName: 'हिन्दी Hindī'},
  {code: 'hr', englishName: 'Croatian', localName: 'Hrvatski'},
  {code: 'ht', englishName: 'Creole', localName: 'Creole'},
  {code: 'hu', englishName: 'Hungarian', localName: 'magyar nyelv'},
  {code: 'id', englishName: 'Indonesian (Bahasa)', localName: 'Bahasa'},
  {code: 'it', englishName: 'Italian', localName: 'Italiano'},
  {code: 'ja', englishName: 'Japanese', localName: '日本語'},
  {code: 'ka', englishName: 'Georgian', localName: 'ქართული ენა (Kartuli ena)'},
  {code: 'kk', englishName: 'Kazakh', localName: 'Kazakh'},
  {code: 'kn', englishName: 'Kannada', localName: 'ಕನ್ನಡ'},
  {code: 'ko', englishName: 'Korean', localName: '한국어'},
  {code: 'lt', englishName: 'Lithuanian', localName: 'lietuvių kalba'},
  {code: 'lv', englishName: 'Latvian', localName: 'Latviešu valoda'},
  {code: 'ml', englishName: 'Malayalam', localName: 'മലയാളം'},
  {code: 'mr', englishName: 'Marathi', localName: 'Marāṭhī, मराठी'},
  {code: 'nl', englishName: 'Dutch', localName: 'Nederlands'},
  {code: 'no-NO', englishName: 'Norwegian', localName: 'Norsk'},
  {code: 'pa', englishName: 'Punjabi', localName: 'ਪੰਜਾਬੀ'},
  {code: 'pl', englishName: 'Polish', localName: 'Polski'},
  {code: 'pt', englishName: 'Portuguese (Portugal)', localName: 'Português (Portugal)'},
  {code: 'pt-BR', englishName: 'Portuguese (Brazil)', localName: 'Português (Brasileiro)'},
  {code: 'ro', englishName: 'Romanian', localName: 'Română'},
  {code: 'ru', englishName: 'Russian', localName: 'русский'},
  {code: 'sd', englishName: 'Sindhi', localName: 'سنڌي'},
  {code: 'sk', englishName: 'Slovak', localName: 'Slovenský'},
  {code: 'sl', englishName: 'Slovenian', localName: 'Slovenský'},
  {code: 'sr', englishName: 'Serbian', localName: 'српски'},
  {code: 'sv', englishName: 'Swedish', localName: 'Svenska'},
  {code: 'sw', englishName: 'Swahili', localName: 'Kiswahili'},
  {code: 'ta-IN', englishName: 'Tamil', localName: 'தமிழ் Tamiḻ'},
  {code: 'te-IN', englishName: 'Telugu', localName: 'తెలుగు'},
  {code: 'tr', englishName: 'Turkish', localName: 'Türkçe'},
  {code: 'uk', englishName: 'Ukrainian', localName: 'Українська'},
  {code: 'ur', englishName: 'Urdu', localName: 'اُردُو'},
  {code: 'uz', englishName: 'Uzbek', localName: 'Uzbek'},
  {code: 'vi', englishName: 'Vietnamese', localName: 'Tiếng Việt'},
  {code: 'zh', englishName: 'Chinese (Simplified)', localName: '简体中文'},
  {code: 'zh-TW', englishName: 'Chinese (Traditional)', localName: '漢語'},
] as const satisfies readonly LocaleDescriptor[];

export type SupportedLocale = (typeof LOCALE_DESCRIPTORS)[number]['code'];

const canonicalByNormalizedCode = new Map<string, SupportedLocale>(
  LOCALE_DESCRIPTORS.map(locale => [normalizeLocale(locale.code), locale.code]),
);

const aliases: Readonly<Record<string, SupportedLocale>> = {
  'iw-il': 'he',
  br: 'pt-BR',
  'zh-cn': 'zh',
  'es-mx': 'es-419',
  nn: 'no-NO',
  gl: 'gl-ES',
  te: 'te-IN',
  hi: 'hi-IN',
  'fr-ht': 'ht',
  bn: 'bn-BD',
  ta: 'ta-IN',
  'en-us': 'en',
  'en-gb': 'en',
};

export function resolveLocale(locale: string | null | undefined): SupportedLocale {
  if (!locale) {
    return 'en';
  }

  const normalized = normalizeLocale(locale);
  const exact = canonicalByNormalizedCode.get(normalized) ?? aliases[normalized];
  if (exact) {
    return exact;
  }

  const base = normalized.split('-')[0];
  return canonicalByNormalizedCode.get(base) ?? aliases[base] ?? 'en';
}

export function getDeviceLocale(): SupportedLocale {
  try {
    return resolveLocale(Intl.DateTimeFormat().resolvedOptions().locale);
  } catch {
    return 'en';
  }
}

function normalizeLocale(locale: string): string {
  return locale.trim().replace(/_/g, '-').toLowerCase();
}
