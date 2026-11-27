import { StyleSheet } from 'react-native';
import type { AppTheme } from '@ui/theme';

export function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    content: { alignSelf: 'stretch', gap: theme.spacing.xs },
    label: { ...theme.typography.caption, color: theme.colors.textSecondary, textAlign: 'center' },
    error: { ...theme.typography.caption, color: theme.colors.negative, textAlign: 'center' },
  });
}
