import { StyleSheet } from 'react-native';

import type { AppTheme } from '@ui/theme';

export function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    content: {
      flex: 1,
      gap: theme.spacing.md,
      paddingHorizontal: theme.spacing.lg,
    },
    header: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: theme.spacing.sm,
    },
    heading: {
      flexShrink: 1,
      gap: theme.spacing.xs,
    },
    title: {
      ...theme.typography.sectionTitle,
      color: theme.colors.textPrimary,
    },
    description: {
      ...theme.typography.body,
      color: theme.colors.textSecondary,
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
      minWidth: 0,
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
    kind: {
      ...theme.typography.caption,
      color: theme.colors.textPrimary,
      fontWeight: '700',
      alignSelf: 'flex-start',
      backgroundColor: theme.colors.surfaceMuted,
      borderRadius: theme.radii.sm,
      paddingHorizontal: theme.spacing.xs,
      paddingVertical: theme.spacing.xs,
      overflow: 'hidden',
    },
    current: {
      ...theme.typography.caption,
      color: theme.colors.textPrimary,
      maxWidth: '45%',
      flexShrink: 1,
      textAlign: 'right',
      fontWeight: '700',
    },
    error: {
      ...theme.typography.body,
      color: theme.colors.negativeStrong,
    },
  });
}
