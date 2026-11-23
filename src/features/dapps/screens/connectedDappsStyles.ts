import { StyleSheet } from 'react-native';

import type { AppTheme } from '../../../ui/theme';

export function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    content: {
      paddingHorizontal: theme.spacing.lg,
      paddingTop: theme.spacing.md,
      paddingBottom: theme.spacing.xxl,
    },
    note: {
      ...theme.typography.caption,
      color: theme.colors.textSecondary,
      marginBottom: theme.spacing.md,
    },
    empty: { ...theme.typography.body, color: theme.colors.textSecondary },
    row: {
      paddingVertical: theme.spacing.md,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.colors.border,
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: theme.spacing.sm,
    },
    details: { flexGrow: 1, flexShrink: 1, flexBasis: '55%', minWidth: 0, gap: theme.spacing.xs },
    disconnect: { maxWidth: '100%' },
    origin: { ...theme.typography.label, color: theme.colors.textPrimary },
    account: { ...theme.typography.caption, color: theme.colors.textSecondary },
    error: {
      ...theme.typography.caption,
      color: theme.colors.negative,
      marginTop: theme.spacing.md,
    },
  });
}
