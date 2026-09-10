import {StyleSheet} from 'react-native';

import type {AppTheme} from '@ui/theme';

export function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    header: {
      minHeight: 52,
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.sm,
    },
    identity: {
      flex: 1,
      gap: theme.spacing.xs,
    },
    accessory: {
      minWidth: 40,
      minHeight: 40,
      alignItems: 'center',
      justifyContent: 'center',
    },
    eyebrow: {
      ...theme.typography.eyebrow,
      color: theme.colors.textSecondary,
      textTransform: 'uppercase',
    },
    title: {
      ...theme.typography.sectionTitle,
      color: theme.colors.textPrimary,
    },
    subtitle: {
      ...theme.typography.caption,
      color: theme.colors.textSecondary,
    },
  });
}
