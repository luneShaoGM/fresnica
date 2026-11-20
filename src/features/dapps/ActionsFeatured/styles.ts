import { StyleSheet } from 'react-native';
import type { AppTheme } from '@ui/theme';
export function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    section: { gap: theme.spacing.sm },
    heading: { ...theme.typography.label, color: theme.colors.textSecondary },
    list: { gap: theme.spacing.sm },
    item: {
      width: 140,
      minHeight: 100,
      alignItems: 'center',
      gap: theme.spacing.xs,
      padding: theme.spacing.sm,
      borderRadius: theme.radii.md,
      backgroundColor: theme.colors.surfaceMuted,
    },
    title: { ...theme.typography.label, color: theme.colors.textPrimary, textAlign: 'center' },
    notice: { ...theme.typography.caption, color: theme.colors.textSecondary },
    appIcon: {
      width: 44,
      height: 44,
      borderRadius: theme.radii.md,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.surface,
    },
    appInitials: { ...theme.typography.label, color: theme.colors.textPrimary },
  });
}
