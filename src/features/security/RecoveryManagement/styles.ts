import { StyleSheet } from 'react-native';
import type { AppTheme } from '@ui/theme';
export function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    content: { gap: theme.spacing.md },
    title: { ...theme.typography.title, color: theme.colors.textPrimary },
    body: { ...theme.typography.body, color: theme.colors.textSecondary },
    error: { ...theme.typography.body, color: theme.colors.negative },
    input: {
      ...theme.typography.body,
      color: theme.colors.textPrimary,
      backgroundColor: theme.colors.surfaceMuted,
      padding: theme.spacing.md,
      borderRadius: theme.radii.md,
      minHeight: 48,
    },
    material: {
      ...theme.typography.body,
      color: theme.colors.textPrimary,
      backgroundColor: theme.colors.surfaceMuted,
      padding: theme.spacing.md,
      minHeight: 160,
      textAlignVertical: 'top',
    },
  });
}
