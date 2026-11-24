import { StyleSheet } from 'react-native';
import type { AppTheme } from '@ui/theme';
export function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    creditHint: {
      ...theme.typography.caption,
      color: theme.colors.textSecondary,
      textAlign: 'center',
    },
    compactHint: {
      ...theme.typography.caption,
      color: theme.colors.textSecondary,
      textAlign: 'right',
      marginLeft: 'auto',
      flexShrink: 1,
    },
    hint: {
      ...theme.typography.caption,
      color: theme.colors.textSecondary,
      paddingHorizontal: theme.spacing.lg,
      paddingVertical: theme.spacing.sm,
    },
  });
}
