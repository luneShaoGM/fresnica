import { StyleSheet } from 'react-native';

import type { AppTheme } from '@ui/theme';

export function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    screen: {
      flex: 1,
    },
    body: {
      flexGrow: 1,
      justifyContent: 'center',
      paddingHorizontal: theme.spacing.lg,
      paddingTop: theme.spacing.xl,
      paddingBottom: theme.spacing.lg,
      gap: theme.spacing.lg,
    },
    hero: {
      alignItems: 'center',
      gap: theme.spacing.sm,
    },
    title: {
      ...theme.typography.title,
      textAlign: 'center',
    },
    subtitle: {
      ...theme.typography.body,
      textAlign: 'center',
    },
    highlight: {
      fontSize: 22,
      lineHeight: 28,
      fontWeight: '700',
      color: theme.colors.textPrimary,
      textAlign: 'center',
    },
    mark: {
      width: 112,
      height: 112,
      borderRadius: 56,
      borderWidth: 6,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.surface,
    },
    markText: {
      fontSize: 48,
      lineHeight: 56,
      fontWeight: '700',
    },
    card: {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.radii.lg,
      padding: theme.spacing.lg,
      gap: theme.spacing.sm,
      shadowColor: theme.colors.secondary,
      shadowOffset: { width: 0, height: theme.elevation.medium.offsetY },
      shadowOpacity: theme.elevation.medium.opacity,
      shadowRadius: theme.elevation.medium.radius,
      elevation: theme.elevation.medium.androidElevation,
    },
    detail: {
      gap: theme.spacing.xs,
    },
    detailLabel: {
      ...theme.typography.caption,
      fontWeight: '700',
      color: theme.colors.textSecondary,
    },
    detailValue: {
      ...theme.typography.body,
      color: theme.colors.textPrimary,
    },
    divider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: theme.colors.separatorSubtle,
      marginVertical: theme.spacing.xs,
    },
    copyButton: {
      alignSelf: 'stretch',
      minHeight: 40,
      borderRadius: theme.radii.md,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.colors.border,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: theme.spacing.xs,
    },
    copyText: {
      ...theme.typography.label,
      color: theme.colors.textPrimary,
    },
    actions: {
      gap: theme.spacing.sm,
    },
    secondaryButton: {
      minHeight: 48,
      borderRadius: theme.radii.md,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: theme.spacing.md,
    },
    secondaryText: {
      ...theme.typography.button,
      color: theme.colors.textPrimary,
    },
    notice: {
      ...theme.typography.caption,
      color: theme.colors.negativeStrong,
      textAlign: 'center',
    },
    footer: {
      paddingHorizontal: theme.spacing.lg,
      paddingBottom: theme.spacing.lg,
    },
    primaryButton: {
      minHeight: 52,
      borderRadius: theme.radii.md,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: theme.spacing.md,
    },
    primaryText: {
      ...theme.typography.button,
    },
    pressed: {
      opacity: 0.82,
    },
    disabled: {
      opacity: 0.45,
    },
    successScreen: { backgroundColor: theme.colors.positiveMuted },
    successTone: { color: theme.colors.positive },
    successMark: { borderColor: theme.colors.positive },
    successButton: { backgroundColor: theme.colors.positive },
    failedScreen: { backgroundColor: theme.colors.negativeMuted },
    failedTone: { color: theme.colors.negative },
    failedMark: { borderColor: theme.colors.negative },
    failedButton: { backgroundColor: theme.colors.negative },
    unverifiedScreen: { backgroundColor: theme.colors.warningMuted },
    unverifiedTone: { color: theme.colors.warning },
    unverifiedMark: { borderColor: theme.colors.warning },
    unverifiedButton: { backgroundColor: theme.colors.warning },
    queuedScreen: { backgroundColor: theme.colors.actionPrimarySubtle },
    queuedTone: { color: theme.colors.actionPrimary },
    queuedMark: { borderColor: theme.colors.actionPrimary },
    queuedButton: { backgroundColor: theme.colors.actionPrimary },
    signedScreen: { backgroundColor: theme.colors.actionPrimarySubtle },
    signedTone: { color: theme.colors.actionPrimary },
    signedMark: { borderColor: theme.colors.actionPrimary },
    signedButton: { backgroundColor: theme.colors.actionPrimary },
    onToneText: { color: theme.colors.onActionPrimary },
    onWarningText: { color: theme.colors.textPrimary },
  });
}
