import {StyleSheet} from 'react-native';

import type {AppTheme} from '@ui/theme';

export function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    row: {
      minHeight: 64,
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.sm,
      paddingVertical: theme.spacing.sm,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.colors.border,
    },
    leading: {
      minWidth: 36,
      alignItems: 'center',
      justifyContent: 'center',
    },
    identity: {
      flex: 1,
      gap: theme.spacing.xs,
    },
    title: {
      ...theme.typography.label,
      color: theme.colors.textPrimary,
    },
    subtitle: {
      ...theme.typography.caption,
      color: theme.colors.textSecondary,
    },
    trailing: {
      minWidth: 36,
      alignItems: 'flex-end',
      justifyContent: 'center',
    },
    selected: {
      backgroundColor: theme.colors.actionPrimarySubtle,
    },
    pressed: {
      opacity: 0.68,
    },
    disabled: {
      opacity: 0.45,
    },
  });
}
