import { StyleSheet } from 'react-native';

import type { AppTheme } from '@ui/theme';

export function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    content: {
      paddingHorizontal: theme.spacing.lg,
      paddingTop: theme.spacing.sm,
      paddingBottom: theme.spacing.xl,
    },
    title: {
      ...theme.typography.title,
      color: theme.colors.textPrimary,
      marginBottom: theme.spacing.md,
    },
    group: {
      marginBottom: theme.spacing.lg,
    },
    footer: {
      ...theme.typography.caption,
      color: theme.colors.textTertiary,
      textAlign: 'center',
      marginTop: theme.spacing.xs,
    },
  });
}
