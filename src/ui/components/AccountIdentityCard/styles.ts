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
    avatar: {
      width: 40,
      height: 40,
      borderRadius: theme.radii.pill,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.actionPrimaryMuted,
    },
    initial: { ...theme.typography.label, color: theme.colors.textPrimary },
    compactIdentity: { minWidth: 0 },
    identity: { flex: 1, gap: theme.spacing.xs },
    label: { ...theme.typography.caption, color: theme.colors.textSecondary },
    name: { ...theme.typography.label, color: theme.colors.textPrimary },
    address: { ...theme.typography.caption, color: theme.colors.textSecondary },
  });
}
