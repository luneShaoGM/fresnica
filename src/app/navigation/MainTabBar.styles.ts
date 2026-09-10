import {StyleSheet} from 'react-native';

import type {AppTheme} from '@ui/theme';

export function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    tabBar: {
      minHeight: 64,
      flexDirection: 'row',
      alignItems: 'stretch',
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
      paddingHorizontal: theme.spacing.xs,
      paddingTop: theme.spacing.xs,
      paddingBottom: theme.spacing.xs,
    },
    tab: {
      flex: 1,
      minHeight: 48,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: theme.spacing.xs,
    },
    tabText: {
      ...theme.typography.caption,
      color: theme.colors.textSecondary,
      fontWeight: '600',
      textAlign: 'center',
    },
    selectedTabText: {
      color: theme.colors.actionPrimaryPressed,
      fontWeight: '800',
    },
    pressed: {
      opacity: 0.68,
    },
    actionsSlot: {
      flex: 1,
      minHeight: 48,
      alignItems: 'center',
      justifyContent: 'center',
    },
    actionsButton: {
      minWidth: 58,
      minHeight: 48,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: theme.radii.md,
      backgroundColor: theme.colors.actionPrimarySubtle,
      paddingHorizontal: theme.spacing.xs,
    },
    actionsPlus: {
      fontSize: 24,
      lineHeight: 24,
      color: theme.colors.actionPrimaryPressed,
      fontWeight: '500',
    },
    actionsLabel: {
      ...theme.typography.caption,
      color: theme.colors.actionPrimaryPressed,
      fontWeight: '700',
    },
    overlay: {
      flex: 1,
      justifyContent: 'flex-end',
      backgroundColor: theme.colors.overlayBackdrop,
    },
    actionsSheet: {
      backgroundColor: theme.colors.surface,
      borderTopLeftRadius: theme.radii.lg,
      borderTopRightRadius: theme.radii.lg,
      paddingHorizontal: theme.spacing.lg,
      paddingTop: theme.spacing.lg,
      paddingBottom: theme.spacing.lg,
      gap: theme.spacing.md,
    },
    actionsTitle: {
      ...theme.typography.sectionTitle,
      color: theme.colors.textPrimary,
    },
    actionRow: {
      flexDirection: 'row',
      gap: theme.spacing.sm,
    },
    actionItem: {
      flex: 1,
      minHeight: 54,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: theme.radii.md,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surfaceMuted,
      paddingHorizontal: theme.spacing.sm,
      gap: theme.spacing.xs,
    },
    actionItemDisabled: {
      opacity: 0.45,
    },
    actionLabel: {
      ...theme.typography.label,
      color: theme.colors.textPrimary,
      fontWeight: '700',
      textAlign: 'center',
    },
    actionStatus: {
      ...theme.typography.caption,
      color: theme.colors.textTertiary,
      textAlign: 'center',
    },
  });
}
