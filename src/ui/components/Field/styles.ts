import {StyleSheet} from 'react-native';

import type {AppTheme} from '@ui/theme';

export function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    field: {
      gap: theme.spacing.xs,
    },
    label: {
      ...theme.typography.label,
      color: theme.colors.textPrimary,
    },
    input: {
      minHeight: 50,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.radii.md,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
      backgroundColor: theme.colors.surface,
      color: theme.colors.textPrimary,
      ...theme.typography.body,
    },
    multiline: {
      minHeight: 112,
      textAlignVertical: 'top',
    },
    hint: {
      ...theme.typography.caption,
      color: theme.colors.textSecondary,
    },
  });
}
