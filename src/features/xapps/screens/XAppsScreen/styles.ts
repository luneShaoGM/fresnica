import {StyleSheet} from 'react-native';

import type {AppTheme} from '../../../../ui/theme';

export function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    content: {
      flex: 1,
      justifyContent: 'center',
      paddingHorizontal: theme.spacing.lg,
      gap: theme.spacing.sm,
    },
    eyebrow: {
      ...theme.typography.eyebrow,
      color: theme.colors.actionPrimary,
      textTransform: 'uppercase',
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
