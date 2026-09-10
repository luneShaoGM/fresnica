import {StyleSheet} from 'react-native';

import type {AppTheme} from '@ui/theme';

export function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    card: {
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.radii.lg,
      padding: theme.spacing.md,
      backgroundColor: theme.colors.surface,
      gap: theme.spacing.sm,
    },
    title: {
      ...theme.typography.sectionTitle,
      color: theme.colors.textPrimary,
    },
    description: {
      ...theme.typography.caption,
      color: theme.colors.textSecondary,
    },
  });
}
