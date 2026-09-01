import {StyleSheet} from 'react-native';

import type {AppTheme} from '../../ui/theme';

export function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    content: {
      flex: 1,
    },
    tabBar: {
      minHeight: 70,
      flexDirection: 'row',
      alignItems: 'flex-end',
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
      paddingHorizontal: theme.spacing.xs,
      paddingTop: theme.spacing.xs,
      paddingBottom: theme.spacing.sm,
    },
    tab: {
      flex: 1,
      minHeight: 48,
      alignItems: 'center',
      justifyContent: 'center',
      gap: theme.spacing.xs,
    },
    tabIndicator: {
      width: 20,
      height: 2,
      borderRadius: theme.radii.pill,
      backgroundColor: theme.colors.actionPrimary,
    },
    tabIndicatorHidden: {
      opacity: 0,
    },
    tabText: {
      ...theme.typography.caption,
      color: theme.colors.textSecondary,
      fontWeight: '600',
    },
    selectedTabText: {
      color: theme.colors.textPrimary,
      fontWeight: '700',
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
      width: 54,
      height: 54,
      borderRadius: 27,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.actionPrimary,
      transform: [{translateY: -10}],
    },
    actionsButtonPressed: {
      backgroundColor: theme.colors.actionPrimaryPressed,
    },
    actionsButtonText: {
      color: theme.colors.onActionPrimary,
      fontSize: 30,
      lineHeight: 32,
      fontWeight: '400',
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
      paddingTop: theme.spacing.md,
      paddingBottom: theme.spacing.xl,
      gap: theme.spacing.md,
    },
    sheetHandle: {
      width: 38,
      height: 4,
      alignSelf: 'center',
      borderRadius: theme.radii.pill,
      backgroundColor: theme.colors.border,
    },
    actionsTitle: {
      ...theme.typography.sectionTitle,
      color: theme.colors.textPrimary,
      textAlign: 'center',
    },
    actionRow: {
      flexDirection: 'row',
      gap: theme.spacing.sm,
    },
    actionItem: {
      flex: 1,
      minHeight: 78,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: theme.radii.md,
      backgroundColor: theme.colors.surfaceMuted,
      paddingHorizontal: theme.spacing.sm,
      gap: theme.spacing.xs,
    },
    actionItemDisabled: {
      opacity: 0.5,
    },
    actionLabel: {
      ...theme.typography.label,
      color: theme.colors.textPrimary,
      textAlign: 'center',
    },
    actionStatus: {
      ...theme.typography.caption,
      color: theme.colors.textSecondary,
      textAlign: 'center',
    },
  });
}
