import { StyleSheet } from 'react-native';
import type { AppTheme } from '@ui/theme';
export function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    compact: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm },
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.sm,
      padding: theme.spacing.md,
      borderRadius: theme.radii.md,
      backgroundColor: theme.colors.surfaceMuted,
    },
    selectable: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.sm,
      paddingVertical: theme.spacing.md,
    },
    pressed: { backgroundColor: theme.colors.surfaceMuted },
    compactIdentity: { minWidth: 0 },
    identity: { flex: 1, gap: theme.spacing.xs },
    label: { ...theme.typography.caption, color: theme.colors.textSecondary },
    name: { ...theme.typography.label, color: theme.colors.textPrimary },
    address: { ...theme.typography.caption, color: theme.colors.textSecondary },
  });
}
