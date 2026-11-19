import { StyleSheet } from 'react-native';
import type { AppTheme } from '@ui/theme';
export function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    compactHint: {
      ...theme.typography.caption,
      color: theme.colors.textSecondary,
      textAlign: 'right',
      paddingBottom: theme.spacing.xs,
    },
    hint: {
      ...theme.typography.caption,
      color: theme.colors.textSecondary,
      paddingHorizontal: theme.spacing.lg,
      paddingVertical: theme.spacing.sm,
    },
  });
}
