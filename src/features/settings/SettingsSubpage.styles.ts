import { StyleSheet } from 'react-native';
import type { AppTheme } from '@ui/theme';

export function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    header: {
      minHeight: 58,
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: theme.spacing.md,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.colors.border,
    },
    side: { flex: 1, alignItems: 'flex-start' },
    title: { ...theme.typography.title, color: theme.colors.textPrimary },
    content: { paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.xl },
    section: { marginTop: theme.spacing.lg, gap: theme.spacing.sm },
    label: { ...theme.typography.caption, color: theme.colors.textSecondary },
  });
}
