import {StyleSheet} from 'react-native';

import type {AppTheme} from '@ui/theme';

export function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    screen: {
      flexGrow: 1,
      backgroundColor: theme.colors.background,
      paddingHorizontal: theme.spacing.lg,
      paddingTop: theme.spacing.xxl,
      paddingBottom: theme.spacing.xxl,
      gap: theme.spacing.md,
    },
    eyebrow: {
      ...theme.typography.eyebrow,
      color: theme.colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.8,
    },
    title: {
      ...theme.typography.title,
      color: theme.colors.textPrimary,
    },
    description: {
      ...theme.typography.body,
      color: theme.colors.textSecondary,
    },
  });
}
