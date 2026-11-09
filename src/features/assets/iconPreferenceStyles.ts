import { StyleSheet } from 'react-native';
import type { AppTheme } from '@ui/theme';

export function createIconPreferenceStyles(theme: AppTheme) {
  return StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
      minHeight: 52,
    },
    copy: { flex: 1, minWidth: 0, gap: theme.spacing.xs },
    title: { ...theme.typography.body, color: theme.colors.textPrimary },
    hint: { ...theme.typography.caption, color: theme.colors.textSecondary },
  });
}
