import {StyleSheet} from 'react-native';

import type {AppTheme} from '@ui/theme';

export function createStyles(theme: AppTheme) {
  return StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  content: {
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 24,
  },
  header: {
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  brandMark: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: theme.colors.actionPrimary,
  },
  brand: {
    fontSize: 24,
    lineHeight: 29,
    fontWeight: '800',
    color: theme.colors.textPrimary,
    letterSpacing: -0.6,
  },
  networkButton: {
    minHeight: 30,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 15,
    backgroundColor: theme.colors.surfaceMuted,
  },
  networkButtonPressed: {
    opacity: 0.7,
  },
  networkButtonDisabled: {
    opacity: 0.85,
  },
  networkDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: theme.colors.warning,
  },
  networkText: {
    fontSize: 12,
    lineHeight: 15,
    fontWeight: '700',
    color: theme.colors.textSecondary,
  },
  accountSwitchContainer: {
    minHeight: 72,
    borderRadius: 11,
    backgroundColor: theme.colors.surfaceMuted,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  accountSwitchPressed: {
    opacity: 0.7,
  },
  accountTextBlock: {
    flex: 1,
    gap: 4,
  },
  accountLabel: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '800',
    color: theme.colors.textPrimary,
  },
  accountAddress: {
    fontSize: 12,
    lineHeight: 15,
    color: theme.colors.textSecondary,
    fontVariant: ['tabular-nums'],
  },
  switchChevron: {
    fontSize: 24,
    lineHeight: 26,
    color: theme.colors.surfaceStrong,
    fontWeight: '700',
  },
  accountMetaRow: {
    minHeight: 31,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  accountMeta: {
    fontSize: 11,
    lineHeight: 14,
    color: theme.colors.textTertiary,
  },
  addAccountButton: {
    paddingVertical: 6,
  },
  addAccountText: {
    fontSize: 11,
    lineHeight: 14,
    color: theme.colors.textSecondary,
    fontWeight: '600',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
    marginBottom: 18,
  },
  action: {
    flex: 1,
    height: 42,
    borderRadius: 9,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: 8,
  },
  actionGreen: {
    backgroundColor: theme.colors.actionPrimary,
  },
  actionDark: {
    backgroundColor: theme.colors.surfaceStrong,
  },
  actionDisabled: {
    opacity: 0.4,
  },
  actionIcon: {
    width: 18,
    height: 18,
  },
  actionText: {
    color: theme.colors.onActionPrimary,
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '800',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 20,
    lineHeight: 25,
    fontWeight: '800',
    color: theme.colors.textPrimary,
  },
  sectionLinkButton: {
    paddingVertical: 6,
  },
  sectionLink: {
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '700',
    color: theme.colors.actionPrimaryPressed,
  },
  sectionLinkDisabled: {
    color: theme.colors.textTertiary,
  },
  stateBox: {
    minHeight: 90,
    borderRadius: 10,
    backgroundColor: theme.colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    gap: 7,
  },
  stateTitle: {
    fontSize: 15,
    lineHeight: 19,
    fontWeight: '800',
    color: theme.colors.textPrimary,
    textAlign: 'center',
  },
  stateText: {
    fontSize: 12,
    lineHeight: 17,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
  retryButton: {
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  retryText: {
    color: theme.colors.actionPrimaryPressed,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
  },
  readOnlyNotice: {
    marginBottom: 14,
    borderRadius: 10,
    backgroundColor: theme.colors.warningMuted,
    paddingHorizontal: 14,
    paddingVertical: 11,
    gap: 3,
  },
  readOnlyTitle: {
    fontSize: 12,
    lineHeight: 16,
    color: theme.colors.surfaceStrong,
    fontWeight: '800',
  },
  readOnlyText: {
    fontSize: 11,
    lineHeight: 16,
    color: theme.colors.textSecondary,
  },
  inactiveContainer: {
    borderRadius: 12,
    backgroundColor: theme.colors.actionPrimarySoft,
    paddingHorizontal: 18,
    paddingVertical: 20,
    gap: 14,
  },
  inactiveTitle: {
    fontSize: 16,
    lineHeight: 21,
    fontWeight: '800',
    color: theme.colors.surfaceStrong,
    textAlign: 'center',
  },
  inactiveStep: {
    gap: 4,
  },
  inactiveStepTitle: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '800',
    color: theme.colors.surfaceStrong,
  },
  inactiveStepText: {
    fontSize: 12,
    lineHeight: 18,
    color: theme.colors.textSecondary,
  },
  inactiveAddress: {
    fontSize: 11,
    lineHeight: 16,
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
    gap: 12,
  },
  assetIcon: {
    width: 36,
    height: 36,
  },
  assetFallbackIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surfaceStrong,
  },
  assetFallbackText: {
    color: theme.colors.onSurfaceStrong,
    fontSize: 15,
    lineHeight: 18,
    fontWeight: '800',
  },
  assetIdentity: {
    flex: 1,
    gap: 3,
  },
  assetCode: {
    fontSize: 15,
    lineHeight: 18,
    fontWeight: '800',
    color: theme.colors.textPrimary,
  },
  assetIssuer: {
    fontSize: 11,
    lineHeight: 14,
    color: theme.colors.textTertiary,
  },
  assetBalanceBlock: {
    alignItems: 'flex-end',
    gap: 2,
  },
  assetBalance: {
    fontSize: 15,
    lineHeight: 18,
    color: theme.colors.textPrimary,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  assetSymbol: {
    fontSize: 10,
    lineHeight: 13,
    color: theme.colors.textTertiary,
  },
  hiddenAssetsText: {
    fontSize: 10,
    lineHeight: 14,
    color: theme.colors.textTertiary,
    paddingTop: 10,
  },
  refreshLink: {
    alignSelf: 'center',
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  refreshText: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
    color: theme.colors.actionPrimaryPressed,
  },
  });
}
