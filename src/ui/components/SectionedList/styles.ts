import { StyleSheet } from 'react-native';
import type { AppTheme } from '@ui/theme';

export function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    list: { flex: 1, minHeight: 0 },
    content: { paddingBottom: theme.spacing.xl },
    header: {
      backgroundColor: theme.colors.background,
      paddingTop: theme.spacing.md,
      paddingBottom: theme.spacing.xs,
    },
    heading: { ...theme.typography.label, color: theme.colors.textSecondary },
  });
}
