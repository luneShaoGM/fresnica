import { StyleSheet } from 'react-native';

import type { AppTheme } from '../../../../ui/theme';

export function createConnectSheetStyles(theme: AppTheme) {
  return StyleSheet.create({
    sheet: { paddingHorizontal: theme.spacing.lg, gap: theme.spacing.md },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: theme.spacing.sm },
    title: { ...theme.typography.sectionTitle, color: theme.colors.textPrimary, flex: 1, textAlign: 'center' },
    close: {
      minHeight: 32,
      minWidth: 32,
      borderRadius: theme.radii.pill,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.surfaceMuted,
    },
    closeText: { ...theme.typography.label, color: theme.colors.textPrimary },
    spacer: { width: 32 },
    hero: { alignItems: 'center', gap: theme.spacing.xs },
    address: { ...theme.typography.caption, color: theme.colors.textSecondary },
    avatar: {
      width: 64,
      height: 64,
      borderRadius: 32,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.actionPrimaryMuted,
      marginTop: theme.spacing.sm,
    },
    avatarText: { ...theme.typography.title, color: theme.colors.textPrimary },
    name: { ...theme.typography.sectionTitle, color: theme.colors.textPrimary },
    origin: { ...theme.typography.caption, color: theme.colors.textSecondary },
    message: { ...theme.typography.body, color: theme.colors.textSecondary, textAlign: 'center' },
    card: {
      borderRadius: theme.radii.md,
      backgroundColor: theme.colors.surface,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: theme.spacing.sm,
    },
    cardLabel: { ...theme.typography.caption, color: theme.colors.textSecondary },
    cardValue: { ...theme.typography.label, color: theme.colors.textPrimary, flexShrink: 1 },
    hint: { ...theme.typography.caption, color: theme.colors.textTertiary, textAlign: 'center' },
    actions: { flexDirection: 'row', gap: theme.spacing.sm },
    action: {
      flex: 1,
      minHeight: 48,
      borderRadius: theme.radii.md,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.actionPrimary,
    },
    secondary: { backgroundColor: theme.colors.surfaceStrong },
    actionText: { ...theme.typography.button, color: theme.colors.onActionPrimary, textAlign: 'center' },
  });
}
