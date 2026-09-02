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
      minHeight: 64,
      flexDirection: 'row',
      alignItems: 'flex-end',
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
      paddingHorizontal: 4,
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
      borderRadius: 24,
      alignItems: 'center',
      justifyContent: 'center',
      transform: [{translateY: -6}],
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
      minHeight: 410,
      backgroundColor: theme.colors.surface,
      borderTopLeftRadius: 30,
      borderTopRightRadius: 30,
      borderColor: theme.colors.surfaceMuted,
      borderWidth: 1,
      padding: 15,
      paddingBottom: 24,
      shadowColor: theme.colors.textSecondary,
      shadowOffset: {width: 0, height: 0},
      shadowRadius: 5,
      shadowOpacity: 0.3,
      elevation: 8,
    },
    sheetHandle: {
      width: 40,
      height: 6,
      alignSelf: 'center',
      borderRadius: 4,
      backgroundColor: theme.colors.textSecondary,
      marginBottom: 20,
    },
    actionsSectionTitle: {
      fontSize: 13,
      lineHeight: 17,
      color: theme.colors.textPrimary,
      fontWeight: '700',
      paddingVertical: 8,
      paddingHorizontal: 4,
    },
    shortcutRow: {
      flexDirection: 'row',
      minHeight: 90,
    },
    shortcutItem: {
      flex: 1,
      alignItems: 'center',
      paddingHorizontal: 4,
    },
    shortcutIconShell: {
      width: 58,
      height: 58,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 5,
    },
    shortcutPlaceholder: {
      backgroundColor: theme.colors.surfaceMuted,
      opacity: 0.75,
    },
    shortcutLabelPlaceholder: {
      width: 38,
      height: 7,
      borderRadius: 4,
      backgroundColor: theme.colors.surfaceMuted,
      opacity: 0.75,
    },
    nativeShortcutIcon: {
      backgroundColor: theme.colors.actionPrimary,
    },
    shortcutIcon: {
      width: 27,
      height: 27,
    },
    shortcutLabel: {
      minHeight: 25,
      fontSize: 11,
      lineHeight: 12,
      color: theme.colors.textPrimary,
      fontWeight: '500',
      textAlign: 'center',
    },
    shortcutDisabled: {
      opacity: 0.35,
    },
    scanButton: {
      minHeight: 48,
      marginTop: 16,
      borderRadius: 10,
      backgroundColor: theme.colors.textPrimary,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingHorizontal: 16,
    },
    scanButtonDisabled: {
      opacity: 0.35,
    },
    scanGlyph: {
      fontSize: 17,
      lineHeight: 20,
      color: theme.colors.surface,
      fontWeight: '700',
    },
    scanLabel: {
      fontSize: 13,
      lineHeight: 17,
      color: theme.colors.surface,
      fontWeight: '700',
    },
  });
}
