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
  separatorSubtle: string;
  actionPrimary: string;
  actionPrimaryPressed: string;
  actionPrimarySubtle: string;
  actionPrimarySoft: string;
  actionPrimaryMuted: string;
  actionPrimaryDecoration: string;
  actionPrimaryOutline: string;
  actionPrimaryTrack: string;
  onActionPrimary: string;
  onActionPrimarySubtle: string;
  onActionPrimaryMuted: string;
  onSurfaceStrong: string;
  onSurfaceStrongMuted: string;
  overlayBackdrop: string;
  negative: string;
  negativeStrong: string;
  negativeMuted: string;
  positive: string;
  positiveMuted: string;
  warning: string;
  warningMuted: string;
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

export type ThemeElevationLevel = Readonly<{
  offsetY: number;
  opacity: number;
  radius: number;
  androidElevation: number;
}>;

export type ThemeElevation = Readonly<{
  low: ThemeElevationLevel;
  medium: ThemeElevationLevel;
  high: ThemeElevationLevel;
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

export type ThemeStatusBarContent = 'dark' | 'light';

export type AppTheme = Readonly<{
  colors: ThemeColors;
  spacing: ThemeSpacing;
  radii: ThemeRadii;
  elevation: ThemeElevation;
  typography: ThemeTypography;
  statusBarContent: ThemeStatusBarContent;
}>;

export type ThemeSeed =
  | Readonly<{ kind: 'default' }>
  | Readonly<{
      kind: 'image';
      primary: string;
      secondary: string;
      primaryPressed?: string;
      onPrimary?: string;
      statusBarContent?: ThemeStatusBarContent;
      semantic?: Partial<ThemeColors>;
    }>;
