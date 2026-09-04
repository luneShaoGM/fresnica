export type ThemeColors = Readonly<{
  primary: string;
  secondary: string;
  background: string;
  surface: string;
  surfaceMuted: string;
  surfaceStrong: string;
  textPrimary: string;
  textSecondary: string;
  textTertiary: string;
  border: string;
  actionPrimary: string;
  actionPrimaryPressed: string;
  onActionPrimary: string;
  overlayBackdrop: string;
  negative: string;
  positive: string;
}>;

export type ThemeSpacing = Readonly<{
  xs: number;
  sm: number;
  md: number;
  lg: number;
  xl: number;
  xxl: number;
}>;

export type ThemeRadii = Readonly<{
  sm: number;
  md: number;
  lg: number;
  pill: number;
}>;

export type ThemeFontWeight = '400' | '600' | '700';

export type ThemeTextStyle = Readonly<{
  fontSize: number;
  lineHeight: number;
  fontWeight: ThemeFontWeight;
}>;

export type ThemeTypography = Readonly<{
  eyebrow: ThemeTextStyle;
  title: ThemeTextStyle;
  sectionTitle: ThemeTextStyle;
  body: ThemeTextStyle;
  label: ThemeTextStyle;
  caption: ThemeTextStyle;
  button: ThemeTextStyle;
}>;

export type AppTheme = Readonly<{
  colors: ThemeColors;
  spacing: ThemeSpacing;
  radii: ThemeRadii;
  typography: ThemeTypography;
}>;

export type ThemeSeed =
  | Readonly<{kind: 'default'}>
  | Readonly<{
      kind: 'image';
      primary: string;
      secondary: string;
      primaryPressed?: string;
      onPrimary?: string;
      semantic?: Partial<ThemeColors>;
    }>;
