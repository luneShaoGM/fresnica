import { StyleSheet } from 'react-native';

import type { AppTheme } from '@ui/theme';

export function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    scroll: {
      maxHeight: 360,
    },
    list: {
      gap: theme.spacing.sm,
    },
    row: {
      minHeight: 64,
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.md,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.colors.border,
      borderRadius: theme.radii.md,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
    },
    rowSelected: {
      borderColor: theme.colors.actionPrimary,
      backgroundColor: theme.colors.surfaceMuted,
    },
    rowDisabled: {
      opacity: 0.55,
    },
    rowPressed: {
      opacity: 0.7,
    },
    identity: {
      flex: 1,
      gap: theme.spacing.xs,
    },
    label: {
      ...theme.typography.label,
      color: theme.colors.textPrimary,
    },
    address: {
      ...theme.typography.caption,
      color: theme.colors.textSecondary,
    },
    current: {
      ...theme.typography.caption,
      color: theme.colors.actionPrimary,
      fontWeight: '700',
    },
    error: {
      ...theme.typography.body,
      color: theme.colors.negative,
    },
  });
}
