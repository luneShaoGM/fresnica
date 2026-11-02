import { StyleSheet } from 'react-native';

import type { AppTheme } from '@ui/theme';

export function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    surface: {
      alignItems: 'center',
      maxHeight: '90%',
      borderRadius: theme.radii.lg * 2,
      borderWidth: 1,
      borderColor: theme.colors.border,
      gap: 0,
    },
    scrollArea: {
      flexGrow: 0,
      flexShrink: 1,
      width: '100%',
    },
    content: {
      alignItems: 'center',
      paddingBottom: theme.spacing.xs,
    },
    statusIcon: {
      width: 60,
      height: 60,
      borderRadius: 30,
      borderWidth: 3,
      alignItems: 'center',
      justifyContent: 'center',
    },
    warningIcon: { borderColor: theme.colors.warning },
    destructiveIcon: { borderColor: theme.colors.negative },
    statusGlyph: { fontSize: 34, lineHeight: 42, fontWeight: '700' },
    title: {
      ...theme.typography.sectionTitle,
      textAlign: 'center',
      marginTop: theme.spacing.md,
    },
    warningTitle: { color: theme.colors.warning },
    destructiveTitle: { color: theme.colors.negative },
    message: {
      ...theme.typography.body,
      textAlign: 'center',
      color: theme.colors.textPrimary,
      marginTop: theme.spacing.md,
    },
    detail: {
      ...theme.typography.body,
      fontSize: 14,
      lineHeight: 20,
      textAlign: 'center',
      color: theme.colors.textSecondary,
      marginTop: theme.spacing.sm,
    },
    error: {
      ...theme.typography.label,
      textAlign: 'center',
      color: theme.colors.negative,
      marginTop: theme.spacing.md,
    },
    actions: {
      width: '100%',
      marginTop: theme.spacing.xl,
      gap: theme.spacing.sm,
    },
    actionsRow: { flexDirection: 'row' },
    actionsColumn: { flexDirection: 'column' },
    action: {
      minHeight: 52,
      borderRadius: theme.radii.md,
      borderWidth: 1,
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: theme.spacing.sm,
      flexDirection: 'row',
      gap: theme.spacing.sm,
      alignItems: 'center',
      justifyContent: 'center',
    },
    rowAction: { flex: 1, minWidth: 0 },
    stackedAction: { width: '100%' },
    cancelAction: {
      backgroundColor: theme.colors.surfaceMuted,
      borderColor: theme.colors.border,
    },
    primaryAction: {
      backgroundColor: theme.colors.actionPrimary,
      borderColor: theme.colors.actionPrimary,
    },
    destructiveAction: {
      backgroundColor: theme.colors.negative,
      borderColor: theme.colors.negative,
    },
    cancelText: {
      ...theme.typography.button,
      color: theme.colors.textPrimary,
      textAlign: 'center',
      flexShrink: 1,
    },
    confirmText: {
      ...theme.typography.button,
      color: theme.colors.onActionPrimary,
      textAlign: 'center',
      flexShrink: 1,
    },
    pressed: { opacity: 0.82 },
    disabled: { opacity: 0.48 },
  });
}
