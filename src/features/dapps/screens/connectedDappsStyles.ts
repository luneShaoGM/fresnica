import { StyleSheet } from 'react-native';

import type { AppTheme } from '../../../ui/theme';

export function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    header: {
      minHeight: 58,
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: theme.spacing.lg,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.colors.border,
      gap: theme.spacing.sm,
    },
    title: { ...theme.typography.sectionTitle, color: theme.colors.textPrimary },
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
      alignItems: 'center',
      gap: theme.spacing.sm,
    },
    details: { flex: 1, gap: theme.spacing.xs },
    origin: { ...theme.typography.label, color: theme.colors.textPrimary },
    account: { ...theme.typography.caption, color: theme.colors.textSecondary },
    error: {
      ...theme.typography.caption,
      color: theme.colors.negative,
      marginTop: theme.spacing.md,
    },
  });
}
