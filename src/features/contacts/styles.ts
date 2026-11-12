import { StyleSheet } from 'react-native';
import type { AppTheme } from '@ui/theme';

export function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    content: { padding: theme.spacing.md, gap: theme.spacing.md },
    sheet: { flex: 1 },
    title: { ...theme.typography.sectionTitle, color: theme.colors.textPrimary },
    hint: { ...theme.typography.caption, color: theme.colors.textSecondary },
    address: { ...theme.typography.body, color: theme.colors.textPrimary },
    error: { ...theme.typography.body, color: theme.colors.negative },
    actions: { gap: theme.spacing.sm },
    types: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm },
    moreActions: { fontSize: 24, lineHeight: 28, color: theme.colors.textSecondary },
    card: { gap: theme.spacing.xs, marginVertical: theme.spacing.sm },
    scanContent: { flex: 1, padding: theme.spacing.md, gap: theme.spacing.md },
    // Let the camera preview shrink on short screens so Retry/Cancel remain visible.
    scanFrame: { flex: 1, minHeight: 0, overflow: 'hidden', borderRadius: theme.radii.md },
    confirmation: {
      padding: theme.spacing.md,
      gap: theme.spacing.md,
      backgroundColor: theme.colors.surfaceMuted,
      borderRadius: theme.radii.md,
    },
  });
}
