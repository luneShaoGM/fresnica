import {StyleSheet} from 'react-native';

import type {AppTheme} from '@ui/theme';

export function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    base: {
      minHeight: 52,
      borderRadius: theme.radii.md,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.md,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
    },
    primary: {
      backgroundColor: theme.colors.actionPrimary,
      borderColor: theme.colors.actionPrimary,
    },
    secondary: {
      backgroundColor: theme.colors.surface,
      borderColor: theme.colors.border,
    },
    ghost: {
      borderWidth: 0,
    },
    pressed: {
      opacity: 0.82,
    },
    disabled: {
      opacity: 0.45,
    },
    text: {
      ...theme.typography.button,
    },
    primaryText: {
      color: theme.colors.onActionPrimary,
    },
    secondaryText: {
      color: theme.colors.textPrimary,
    },
    ghostText: {
      color: theme.colors.actionPrimary,
    },
  });
}
