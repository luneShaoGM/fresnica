import {StyleSheet} from 'react-native';

import type {AppTheme} from '@ui/theme';

export function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    tabBar: {
      minHeight: 64,
      flexDirection: 'row',
      alignItems: 'flex-end',
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
      paddingHorizontal: theme.spacing.xs,
      paddingTop: 3,
      paddingBottom: 5,
    },
    tab: {
      flex: 1,
      minHeight: 48,
      alignItems: 'center',
      justifyContent: 'flex-end',
      gap: 1,
    },
    tabIcon: {
      width: 25,
      height: 25,
    },
    tabText: {
      fontSize: 10,
      lineHeight: 13,
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
      justifyContent: 'flex-end',
    },
    actionsButton: {
      width: 48,
      height: 48,
      borderRadius: theme.radii.pill,
      alignItems: 'center',
      justifyContent: 'center',
      transform: [{translateY: -6}],
      shadowColor: theme.colors.textPrimary,
      shadowOpacity: 0.1,
      shadowRadius: 6,
      shadowOffset: {width: 0, height: 3},
      elevation: 3,
    },
    actionsButtonPressed: {
      opacity: 0.7,
    },
    actionsImage: {
      width: 48,
      height: 48,
    },
    overlay: {
      flex: 1,
      justifyContent: 'flex-end',
      backgroundColor: theme.colors.overlayBackdrop,
    },
    actionsSheet: {
      backgroundColor: theme.colors.surface,
      borderTopLeftRadius: 22,
      borderTopRightRadius: 22,
      paddingHorizontal: 18,
      paddingTop: 9,
      paddingBottom: 20,
      gap: 14,
    },
    sheetHandle: {
      width: 40,
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
      minHeight: 72,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: theme.radii.md,
      paddingHorizontal: theme.spacing.sm,
      gap: 3,
    },
    actionItemPrimary: {
      backgroundColor: theme.colors.actionPrimary,
    },
    actionItemStrong: {
      backgroundColor: theme.colors.surfaceStrong,
    },
    actionItemDisabled: {
      opacity: 0.38,
    },
    actionIcon: {
      width: 23,
      height: 23,
    },
    actionLabel: {
      fontSize: 13,
      lineHeight: 17,
      color: theme.colors.onActionPrimary,
      fontWeight: '700',
      textAlign: 'center',
    },
    actionStatus: {
      fontSize: 9,
      lineHeight: 11,
      color: theme.colors.onActionPrimary,
      textAlign: 'center',
      opacity: 0.8,
    },
  });
}
