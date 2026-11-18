import { StyleSheet } from 'react-native';
import type { AppTheme } from '@ui/theme';

export function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    pageContent: { paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.xxl },
    content: { gap: 14, paddingVertical: 12 },
    heading: { fontSize: 20, fontWeight: '700', color: theme.colors.textPrimary },
    text: { fontSize: 14, lineHeight: 21, color: theme.colors.textPrimary },
    label: { fontSize: 13, lineHeight: 19, color: theme.colors.textSecondary },
    error: { fontSize: 14, lineHeight: 21, color: theme.colors.negativeStrong },
    card: {
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.radii.md,
      padding: 14,
      gap: 10,
      backgroundColor: theme.colors.surface,
    },
    input: {
      minHeight: 48,
      padding: 12,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.radii.sm,
      fontSize: 16,
      color: theme.colors.textPrimary,
      backgroundColor: theme.colors.surface,
    },
    row: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, alignItems: 'center' },
    scroll: { flex: 1 },
    footer: {
      paddingVertical: 12,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderColor: theme.colors.border,
      gap: 10,
    },
    field: { gap: 6 },
    selected: { borderColor: theme.colors.actionPrimary },
  });
}
