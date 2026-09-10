import {StyleSheet} from 'react-native';

import type {AppTheme} from '@ui/theme';

export function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    content: {
      paddingHorizontal: theme.spacing.lg,
      paddingTop: theme.spacing.sm,
      paddingBottom: theme.spacing.xl,
    },
    header: {
      minHeight: 48,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: theme.spacing.md,
      gap: theme.spacing.md,
    },
    brand: {
      ...theme.typography.title,
      color: theme.colors.textPrimary,
    },
    networkButton: {
      minHeight: 36,
      justifyContent: 'center',
      borderRadius: theme.radii.md,
      backgroundColor: theme.colors.surfaceMuted,
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: theme.spacing.xs,
    },
    networkButtonDisabled: {
      opacity: 0.8,
    },
    networkText: {
      ...theme.typography.caption,
      color: theme.colors.textSecondary,
      fontWeight: '700',
    },
    accountSwitchContainer: {
      minHeight: 68,
      borderRadius: theme.radii.md,
      backgroundColor: theme.colors.surfaceMuted,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
      justifyContent: 'center',
    },
    accountTextBlock: {
      gap: theme.spacing.xs,
    },
    accountLabel: {
      ...theme.typography.label,
      color: theme.colors.textPrimary,
      fontWeight: '700',
    },
    accountAddress: {
      ...theme.typography.caption,
      color: theme.colors.textSecondary,
      fontVariant: ['tabular-nums'],
    },
    accountMetaRow: {
      minHeight: 36,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: theme.spacing.sm,
      paddingHorizontal: theme.spacing.xs,
    },
    accountMeta: {
      ...theme.typography.caption,
      color: theme.colors.textTertiary,
    },
    addAccountButton: {
      paddingVertical: theme.spacing.xs,
      paddingHorizontal: theme.spacing.xs,
    },
    addAccountText: {
      ...theme.typography.caption,
      color: theme.colors.actionPrimaryPressed,
      fontWeight: '700',
    },
    actionsRow: {
      flexDirection: 'row',
      gap: theme.spacing.sm,
      marginTop: theme.spacing.xs,
      marginBottom: theme.spacing.lg,
    },
    action: {
      flex: 1,
      minHeight: 44,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: theme.radii.md,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surfaceMuted,
      paddingHorizontal: theme.spacing.sm,
    },
    actionDisabled: {
      opacity: 0.45,
    },
    actionText: {
      ...theme.typography.button,
      color: theme.colors.textPrimary,
    },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: theme.spacing.sm,
      marginBottom: theme.spacing.sm,
    },
    sectionTitle: {
      ...theme.typography.sectionTitle,
      color: theme.colors.textPrimary,
    },
    sectionLinkButton: {
      paddingVertical: theme.spacing.xs,
      paddingHorizontal: theme.spacing.xs,
    },
    sectionLink: {
      ...theme.typography.label,
      color: theme.colors.actionPrimaryPressed,
    },
    sectionLinkDisabled: {
      color: theme.colors.textTertiary,
    },
    stateBox: {
      minHeight: 96,
      borderRadius: theme.radii.md,
      backgroundColor: theme.colors.surfaceMuted,
      alignItems: 'center',
      justifyContent: 'center',
      padding: theme.spacing.md,
      gap: theme.spacing.sm,
    },
    stateTitle: {
      ...theme.typography.label,
      color: theme.colors.textPrimary,
      textAlign: 'center',
      fontWeight: '700',
    },
    stateText: {
      ...theme.typography.body,
      color: theme.colors.textSecondary,
      textAlign: 'center',
    },
    retryButton: {
      minHeight: 40,
      justifyContent: 'center',
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.xs,
    },
    retryText: {
      ...theme.typography.label,
      color: theme.colors.actionPrimaryPressed,
    },
    readOnlyNotice: {
      marginBottom: theme.spacing.md,
      borderRadius: theme.radii.md,
      backgroundColor: theme.colors.warningMuted,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
      gap: theme.spacing.xs,
    },
    readOnlyTitle: {
      ...theme.typography.label,
      color: theme.colors.textPrimary,
      fontWeight: '700',
    },
    readOnlyText: {
      ...theme.typography.caption,
      color: theme.colors.textSecondary,
    },
    inactiveContainer: {
      borderRadius: theme.radii.md,
      backgroundColor: theme.colors.actionPrimarySoft,
      paddingHorizontal: theme.spacing.lg,
      paddingVertical: theme.spacing.lg,
      gap: theme.spacing.md,
    },
    inactiveTitle: {
      ...theme.typography.sectionTitle,
      color: theme.colors.textPrimary,
      textAlign: 'center',
    },
    inactiveStep: {
      gap: theme.spacing.xs,
    },
    inactiveStepTitle: {
      ...theme.typography.label,
      color: theme.colors.textPrimary,
      fontWeight: '700',
    },
    inactiveStepText: {
      ...theme.typography.body,
      color: theme.colors.textSecondary,
    },
    inactiveAddress: {
      ...theme.typography.caption,
      color: theme.colors.textSecondary,
      textAlign: 'center',
    },
    assetList: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.colors.separatorSubtle,
    },
    assetRow: {
      minHeight: 68,
      flexDirection: 'row',
      alignItems: 'center',
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.colors.separatorSubtle,
      gap: theme.spacing.sm,
      paddingVertical: theme.spacing.sm,
    },
    assetBadge: {
      minWidth: 44,
      minHeight: 36,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: theme.radii.md,
      backgroundColor: theme.colors.surfaceMuted,
      paddingHorizontal: theme.spacing.xs,
    },
    assetBadgeText: {
      ...theme.typography.caption,
      color: theme.colors.textPrimary,
      fontWeight: '700',
    },
    assetIdentity: {
      flex: 1,
      gap: theme.spacing.xs,
    },
    assetCode: {
      ...theme.typography.label,
      color: theme.colors.textPrimary,
      fontWeight: '700',
    },
    assetIssuer: {
      ...theme.typography.caption,
      color: theme.colors.textTertiary,
    },
    assetBalanceBlock: {
      alignItems: 'flex-end',
      gap: theme.spacing.xs,
    },
    assetBalance: {
      ...theme.typography.label,
      color: theme.colors.textPrimary,
      fontVariant: ['tabular-nums'],
    },
    assetSymbol: {
      ...theme.typography.caption,
      color: theme.colors.textTertiary,
    },
    hiddenAssetsText: {
      ...theme.typography.caption,
      color: theme.colors.textTertiary,
      paddingTop: theme.spacing.sm,
    },
    refreshLink: {
      alignSelf: 'center',
      minHeight: 44,
      justifyContent: 'center',
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
    },
    refreshText: {
      ...theme.typography.label,
      color: theme.colors.actionPrimaryPressed,
    },
    pressed: {
      opacity: 0.68,
    },
  });
}
