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
    fill: { flex: 1, minHeight: 0 },
    section: { marginTop: theme.spacing.lg, gap: theme.spacing.sm },
    toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: theme.spacing.md },
    toggleTitle: { ...theme.typography.body, color: theme.colors.textPrimary, flexShrink: 1 },
    helper: { ...theme.typography.body, color: theme.colors.textSecondary, marginVertical: theme.spacing.sm },
    error: { ...theme.typography.body, color: theme.colors.negative },
    label: { ...theme.typography.caption, color: theme.colors.textSecondary },
  });
}
