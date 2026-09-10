import {StyleSheet} from 'react-native';

import type {AppTheme} from '@ui/theme';

export function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    headerBar: {
      paddingHorizontal: theme.spacing.md,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.colors.border,
    },
    backButton: {width: 40, height: 40, alignItems: 'center', justifyContent: 'center'},
    backGlyph: {fontSize: 36, lineHeight: 38, fontWeight: '300', color: theme.colors.secondary},
    content: {flexGrow: 1, paddingBottom: theme.spacing.xl},
    ready: {flex: 1},
    hero: {alignItems: 'center', paddingHorizontal: theme.spacing.lg, paddingVertical: theme.spacing.xl, gap: theme.spacing.xs},
    heroIcon: {
      width: 60,
      height: 60,
      borderRadius: 30,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.surfaceStrong,
      marginBottom: theme.spacing.xs,
    },
    heroGlyph: {fontSize: 24, lineHeight: 29, fontWeight: '800', color: theme.colors.onSurfaceStrong},
    heroTitle: {...theme.typography.sectionTitle, color: theme.colors.textPrimary, textAlign: 'center'},
    heroPrimary: {...theme.typography.body, color: theme.colors.textSecondary, textAlign: 'center'},
    rows: {borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.colors.border},
    row: {
      minHeight: 58,
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.md,
      paddingHorizontal: theme.spacing.lg,
      paddingVertical: theme.spacing.sm,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.colors.border,
    },
    rowLabel: {...theme.typography.caption, fontWeight: '700', color: theme.colors.textSecondary},
    rowValue: {flex: 1, ...theme.typography.caption, color: theme.colors.textPrimary, textAlign: 'right'},
    mono: {fontSize: 10, lineHeight: 14, color: theme.colors.textSecondary, fontVariant: ['tabular-nums']},
  });
}
