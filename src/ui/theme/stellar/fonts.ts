/**
 * Stellar presentation typography.
 *
 * Source: luneShaoGM/Stellar@stellar-migration/src/theme/fonts.ts
 * Font family names and sizing rules are kept source-compatible. The font
 * resource/native-project migration is tracked separately in the parity map.
 */
import {NativeModules, Platform} from 'react-native';

import stellarSizes from './sizes';

const guidelineBaseWidth = Platform.OS === 'ios' ? 350 : 400;

export const scaleStellarFontSize = (size: number): number =>
  (stellarSizes.screen.width / guidelineBaseWidth) * size;

const getDeviceLocale = (): string => {
  try {
    if (Platform.OS === 'ios') {
      const settingsManager = (NativeModules as any)?.SettingsManager;
      const settings = settingsManager?.settings || settingsManager?.getConstants?.()?.settings || {};
      const locale = settings?.AppleLocale || settings?.AppleLanguages?.[0];
      return typeof locale === 'string' ? locale : '';
    }

    const localeIdentifier = (NativeModules as any)?.I18nManager?.localeIdentifier;
    return typeof localeIdentifier === 'string' ? localeIdentifier : '';
  } catch {
    return '';
  }
};

const normalizedLocale = getDeviceLocale().replace(/_/g, '-').toLowerCase();
const isChineseLocale = normalizedLocale.startsWith('zh');
const isTraditionalChineseLocale =
  normalizedLocale.startsWith('zh-tw') || normalizedLocale.startsWith('zh-hk');

const resolveBaseFamily = (): string | undefined => {
  if (!isChineseLocale) {
    return Platform.select({ios: 'ProximaNova-Regular', android: 'Proxima Nova Regular'});
  }
  if (Platform.OS === 'ios') {
    return isTraditionalChineseLocale ? 'PingFangTC-Regular' : 'PingFangSC-Regular';
  }
  return 'sans-serif';
};

const resolveBoldFamily = (): string | undefined => {
  if (!isChineseLocale) {
    return Platform.select({ios: 'ProximaNova-Bold', android: 'Proxima Nova Bold'});
  }
  if (Platform.OS === 'ios') {
    return isTraditionalChineseLocale ? 'PingFangTC-Semibold' : 'PingFangSC-Semibold';
  }
  return 'sans-serif-medium';
};

const resolveExtraBoldFamily = (): string | undefined => {
  if (!isChineseLocale) {
    return Platform.select({ios: 'ProximaNova-Extrabld', android: 'Proxima Nova Extrabold'});
  }
  if (Platform.OS === 'ios') {
    return isTraditionalChineseLocale ? 'PingFangTC-Semibold' : 'PingFangSC-Semibold';
  }
  return 'sans-serif-medium';
};

export const createStellarLineHeight = (size: number, ratio = 1.45): number =>
  Math.ceil(size * ratio);

const baseSize = scaleStellarFontSize(15);
const smallSize = scaleStellarFontSize(12);
const subtextSize = scaleStellarFontSize(14);
const paragraphSize = scaleStellarFontSize(16);
const h1Size = scaleStellarFontSize(40);
const h2Size = scaleStellarFontSize(35);
const h3Size = scaleStellarFontSize(30);
const h4Size = scaleStellarFontSize(25);
const h5Size = scaleStellarFontSize(20);

const base = {
  size: baseSize,
  lineHeight: createStellarLineHeight(baseSize),
  family: resolveBaseFamily(),
  familyBold: resolveBoldFamily(),
  familyExtraBold: resolveExtraBoldFamily(),
  familyMono: 'UbuntuMono-Regular',
  familyMonoBold: 'UbuntuMono-Bold',
};

const stellarFonts = {
  scaleFontSize: scaleStellarFontSize,
  createLineHeight: createStellarLineHeight,
  base: {...base},
  small: {size: smallSize, lineHeight: createStellarLineHeight(smallSize), family: base.family},
  subtext: {size: subtextSize, lineHeight: createStellarLineHeight(subtextSize), family: base.family},
  p: {...base, size: paragraphSize, lineHeight: createStellarLineHeight(paragraphSize), family: base.family},
  pb: {
    ...base,
    size: paragraphSize,
    lineHeight: createStellarLineHeight(paragraphSize),
    family: base.familyBold,
  },
  h1: {...base, size: h1Size, lineHeight: createStellarLineHeight(h1Size, 1.2), family: base.familyExtraBold},
  h2: {...base, size: h2Size, lineHeight: createStellarLineHeight(h2Size, 1.22), family: base.familyExtraBold},
  h3: {...base, size: h3Size, lineHeight: createStellarLineHeight(h3Size, 1.24), family: base.familyExtraBold},
  h4: {...base, size: h4Size, lineHeight: createStellarLineHeight(h4Size, 1.28), family: base.familyExtraBold},
  h5: {...base, size: h5Size, lineHeight: createStellarLineHeight(h5Size, 1.32), family: base.familyExtraBold},
} as const;

export default stellarFonts;
