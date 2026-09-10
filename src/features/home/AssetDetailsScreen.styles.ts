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
    content: {flex: 1},
    ready: {flex: 1},
    hero: {alignItems: 'center', paddingHorizontal: 24, paddingTop: 30, paddingBottom: 26, gap: 6},
    assetIcon: {
      width: 64,
      height: 64,
      borderRadius: 32,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.surfaceStrong,
      marginBottom: 6,
    },
    assetIconText: {fontSize: 25, lineHeight: 30, color: theme.colors.onSurfaceStrong, fontWeight: '800'},
    assetCode: {fontSize: 22, lineHeight: 27, color: theme.colors.textPrimary, fontWeight: '800'},
    balance: {fontSize: 28, lineHeight: 34, color: theme.colors.textPrimary, fontWeight: '800'},
    balanceLabel: {fontSize: 11, lineHeight: 15, color: theme.colors.textSecondary},
    rows: {borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.colors.border},
    row: {
      minHeight: 56,
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 18,
      gap: 18,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.colors.border,
    },
    rowLabel: {fontSize: 12, lineHeight: 16, color: theme.colors.textSecondary, fontWeight: '600'},
    rowValue: {flex: 1, fontSize: 12, lineHeight: 16, color: theme.colors.textPrimary, textAlign: 'right'},
    mono: {fontSize: 10, lineHeight: 14, color: theme.colors.textSecondary, fontVariant: ['tabular-nums']},
    note: {paddingHorizontal: 20, paddingTop: 18, fontSize: 10, lineHeight: 15, color: theme.colors.textTertiary},
    action: {marginTop: 'auto', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12},
  });
}
