import { StyleSheet } from 'react-native';
import type { AppTheme } from '@ui/theme';
export function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    content: { gap: theme.spacing.lg, padding: theme.spacing.lg },
    modalContent: { gap: theme.spacing.md },
    field: { gap: theme.spacing.sm },
    title: { ...theme.typography.sectionTitle, color: theme.colors.textPrimary },
    body: { ...theme.typography.body, color: theme.colors.textSecondary },
    input: {
      ...theme.typography.body,
      color: theme.colors.textPrimary,
      minHeight: 48,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.radii.md,
      padding: theme.spacing.md,
    },
  });
}
