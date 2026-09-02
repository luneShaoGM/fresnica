/**
 * Stellar presentation colors.
 *
 * Source: luneShaoGM/Stellar@stellar-migration/src/theme/colors.ts
 * Fresnica keeps these tokens isolated from its product theme so source-parity
 * screens can be migrated without silently changing the donor presentation.
 */

const colorLuminance = (hexValue: string, luminance: number): string => {
  let hex = String(hexValue).replace(/[^0-9a-f]/gi, '');
  if (hex.length < 6) {
    hex = `${hex[0]}${hex[0]}${hex[1]}${hex[1]}${hex[2]}${hex[2]}`;
  }

  const lum = luminance || 0;
  let rgb = '#';
  for (let index = 0; index < 3; index += 1) {
    const component = parseInt(hex.substr(index * 2, 2), 16);
    const adjusted = Math.round(Math.min(Math.max(0, component + component * lum), 255)).toString(16);
    rgb += `00${adjusted}`.substr(adjusted.length);
  }
  return rgb;
};

const hexToRgba = (hex: string, opacity: number): string => {
  if (!/^#([A-Fa-f0-9]{3}){1,2}$/.test(hex)) {
    throw new Error(`hexToRgba: ${hex} is not a valid hex value`);
  }

  let parts = hex.substring(1).split('');
  if (parts.length === 3) {
    parts = [parts[0], parts[0], parts[1], parts[1], parts[2], parts[2]];
  }
  const value = parseInt(parts.join(''), 16);
  return `rgba(${[(value >> 16) & 255, (value >> 8) & 255, value & 255].join(',')},${opacity})`;
};

export const stellarColors = {
  blue: '#00CA8A',
  darkBlue: '#181D41',
  primaryActive: '#00B279',
  orange: '#F8BF4C',
  green: '#00CA8A',
  red: '#FF5B5B',
  purple: '#572B81',
  black: '#000000',
  white: '#ffffff',
  grey: '#606885',
  silver: '#ACB1C1',
  light: '#F3F6FA',
  themeLight: '#ffffff',
  themeDark: '#000000',
  themeMoonlight: '#181A21',
  themeRoyal: '#030B36',
  transparent: 'transparent',
  brandBithomp: '#3fa3b5',
  brandXrplns: '#3767CE',
  brandXrpscan: '#004a7c',
  brandPayid: '#38D39F',
  brandFIO: '#564FC6',
} as const;

export const stellarGeneralColors = {
  ...stellarColors,
  transparentBlue: hexToRgba(stellarColors.blue, 0.7),
  transparentBlack: hexToRgba(stellarColors.black, 0.7),
  transparentWhite: hexToRgba(stellarColors.white, 0.4),
  darkGrey: colorLuminance(stellarColors.grey, -0.75),
  darkRed: colorLuminance(stellarColors.red, -0.3),
  darkGreen: colorLuminance(stellarColors.green, -0.3),
} as const;

export const stellarThemeColors = {
  light: {
    background: stellarColors.white,
    tint: stellarColors.light,
    contrast: stellarColors.black,
    transparentContrast: hexToRgba(stellarColors.black, 0.1),
    textContrast: stellarColors.white,
    textPrimary: stellarColors.black,
    textSecondary: stellarColors.grey,
    lightBlue: hexToRgba(stellarColors.blue, 0.08),
    lightOrange: hexToRgba(stellarColors.orange, 0.06),
    lightGreen: hexToRgba(stellarColors.green, 0.08),
    lightRed: hexToRgba(stellarColors.red, 0.06),
    lightGrey: hexToRgba(stellarColors.grey, 0.06),
  },
  dark: {
    background: stellarColors.black,
    tint: colorLuminance(stellarColors.grey, -0.75),
    contrast: stellarColors.white,
    transparentContrast: hexToRgba(stellarColors.white, 0.1),
    textContrast: stellarColors.black,
    textPrimary: stellarColors.white,
    textSecondary: stellarColors.silver,
    lightBlue: hexToRgba(stellarColors.blue, 0.22),
    lightOrange: hexToRgba(stellarColors.orange, 0.22),
    lightGreen: hexToRgba(stellarColors.green, 0.22),
    lightRed: hexToRgba(stellarColors.red, 0.22),
    lightGrey: hexToRgba(stellarColors.grey, 0.22),
  },
  moonlight: {
    background: stellarColors.themeMoonlight,
    tint: colorLuminance(stellarColors.grey, -0.65),
    contrast: stellarColors.white,
    transparentContrast: hexToRgba(stellarColors.white, 0.1),
    textContrast: stellarColors.black,
    textPrimary: stellarColors.white,
    textSecondary: stellarColors.silver,
    lightBlue: hexToRgba(stellarColors.blue, 0.17),
    lightOrange: hexToRgba(stellarColors.orange, 0.17),
    lightGreen: hexToRgba(stellarColors.green, 0.17),
    lightRed: hexToRgba(stellarColors.red, 0.17),
    lightGrey: hexToRgba(stellarColors.grey, 0.17),
  },
  royal: {
    background: stellarColors.themeRoyal,
    tint: colorLuminance(stellarColors.blue, -0.55),
    contrast: stellarColors.white,
    transparentContrast: hexToRgba(stellarColors.white, 0.1),
    textContrast: stellarColors.black,
    textPrimary: stellarColors.white,
    textSecondary: stellarColors.silver,
    lightBlue: hexToRgba(stellarColors.blue, 0.25),
    lightOrange: hexToRgba(stellarColors.orange, 0.17),
    lightGreen: hexToRgba(stellarColors.green, 0.17),
    lightRed: hexToRgba(stellarColors.red, 0.17),
    lightGrey: hexToRgba(stellarColors.grey, 0.17),
  },
} as const;
