import {StyleSheet} from 'react-native';

import type {AppTheme} from '@ui/theme';

export function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    container: {
      minHeight: 180,
      alignItems: 'center',
      justifyContent: 'center',
      gap: theme.spacing.sm,
      padding: theme.spacing.lg,
    },
    icon: {
      width: 52,
      height: 52,
      borderRadius: 26,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.surfaceMuted,
      marginBottom: theme.spacing.xs,
    },
    errorIcon: {
      backgroundColor: theme.colors.negativeMuted,
    },
    glyph: {
      ...theme.typography.sectionTitle,
      color: theme.colors.textSecondary,
    },
    errorGlyph: {
      color: theme.colors.negative,
    },
    title: {
      ...theme.typography.sectionTitle,
      color: theme.colors.textPrimary,
      textAlign: 'center',
    },
    message: {
      ...theme.typography.body,
      color: theme.colors.textSecondary,
      textAlign: 'center',
    },
    action: {
      minWidth: 180,
      marginTop: theme.spacing.sm,
    },
  });
}
