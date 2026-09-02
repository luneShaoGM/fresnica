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
      minHeight: 72,
      flexDirection: 'row',
      alignItems: 'flex-end',
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
      paddingHorizontal: 4,
      paddingTop: 5,
      paddingBottom: 7,
    },
    tab: {
      flex: 1,
      minHeight: 54,
      alignItems: 'center',
      justifyContent: 'flex-end',
      gap: 2,
    },
    tabIcon: {
      width: 28,
      height: 28,
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
      minHeight: 54,
      alignItems: 'center',
      justifyContent: 'flex-end',
    },
    actionsButton: {
      width: 62,
      height: 62,
      borderRadius: 31,
      alignItems: 'center',
      justifyContent: 'center',
      transform: [{translateY: -12}],
      shadowColor: theme.colors.textPrimary,
      shadowOpacity: 0.14,
      shadowRadius: 10,
      shadowOffset: {width: 0, height: 4},
      elevation: 5,
    },
    actionsButtonPressed: {
      opacity: 0.7,
    },
    actionsImage: {
      width: 62,
      height: 62,
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
      paddingHorizontal: 20,
      paddingTop: 10,
      paddingBottom: 28,
      gap: 18,
    },
    sheetHandle: {
      width: 42,
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
      gap: 10,
    },
    actionItem: {
      flex: 1,
      minHeight: 94,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 12,
      paddingHorizontal: 8,
      gap: 5,
    },
    actionItemGreen: {
      backgroundColor: theme.colors.actionPrimary,
    },
    actionItemDark: {
      backgroundColor: theme.colors.surfaceStrong,
    },
    actionItemDisabled: {
      opacity: 0.38,
    },
    actionIcon: {
      width: 30,
      height: 30,
    },
    actionLabel: {
      fontSize: 14,
      lineHeight: 18,
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
