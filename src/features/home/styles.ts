import {StyleSheet} from 'react-native';

import {stellarColors, stellarThemeColors} from '../../ui/theme/stellar';

const light = stellarThemeColors.light;

export const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: light.background,
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
    backgroundColor: stellarColors.green,
  },
  brand: {
    fontSize: 24,
    lineHeight: 29,
    fontWeight: '800',
    color: light.textPrimary,
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
    backgroundColor: light.tint,
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
    backgroundColor: stellarColors.orange,
  },
  networkText: {
    fontSize: 12,
    lineHeight: 15,
    fontWeight: '700',
    color: light.textSecondary,
  },
  accountSwitchContainer: {
    minHeight: 72,
    borderRadius: 11,
    backgroundColor: light.tint,
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
    color: light.textPrimary,
  },
  accountAddress: {
    fontSize: 12,
    lineHeight: 15,
    color: light.textSecondary,
    fontVariant: ['tabular-nums'],
  },
  switchChevron: {
    fontSize: 24,
    lineHeight: 26,
    color: stellarColors.darkBlue,
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
    color: stellarColors.silver,
  },
  addAccountButton: {
    paddingVertical: 6,
  },
  addAccountText: {
    fontSize: 11,
    lineHeight: 14,
    color: light.textSecondary,
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
    backgroundColor: stellarColors.green,
  },
  actionDark: {
    backgroundColor: stellarColors.darkBlue,
  },
  actionDisabled: {
    opacity: 0.4,
  },
  actionIcon: {
    width: 18,
    height: 18,
  },
  actionText: {
    color: stellarColors.white,
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
    color: light.textPrimary,
  },
  sectionLinkButton: {
    paddingVertical: 6,
  },
  sectionLink: {
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '700',
    color: stellarColors.primaryActive,
  },
  sectionLinkDisabled: {
    color: stellarColors.silver,
  },
  stateBox: {
    minHeight: 90,
    borderRadius: 10,
    backgroundColor: light.tint,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    gap: 7,
  },
  stateTitle: {
    fontSize: 15,
    lineHeight: 19,
    fontWeight: '800',
    color: light.textPrimary,
    textAlign: 'center',
  },
  stateText: {
    fontSize: 12,
    lineHeight: 17,
    color: light.textSecondary,
    textAlign: 'center',
  },
  retryButton: {
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  retryText: {
    color: stellarColors.primaryActive,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
  },
  readOnlyNotice: {
    marginBottom: 14,
    borderRadius: 10,
    backgroundColor: light.lightOrange,
    paddingHorizontal: 14,
    paddingVertical: 11,
    gap: 3,
  },
  readOnlyTitle: {
    fontSize: 12,
    lineHeight: 16,
    color: stellarColors.darkBlue,
    fontWeight: '800',
  },
  readOnlyText: {
    fontSize: 11,
    lineHeight: 16,
    color: light.textSecondary,
  },
  inactiveContainer: {
    borderRadius: 12,
    backgroundColor: light.lightBlue,
    paddingHorizontal: 18,
    paddingVertical: 20,
    gap: 14,
  },
  inactiveTitle: {
    fontSize: 16,
    lineHeight: 21,
    fontWeight: '800',
    color: stellarColors.darkBlue,
    textAlign: 'center',
  },
  inactiveStep: {
    gap: 4,
  },
  inactiveStepTitle: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '800',
    color: stellarColors.darkBlue,
  },
  inactiveStepText: {
    fontSize: 12,
    lineHeight: 18,
    color: light.textSecondary,
  },
  inactiveAddress: {
    fontSize: 11,
    lineHeight: 16,
    color: light.textSecondary,
    textAlign: 'center',
  },
  assetList: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: light.transparentContrast,
  },
  assetRow: {
    minHeight: 68,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: light.transparentContrast,
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
    backgroundColor: stellarColors.darkBlue,
  },
  assetFallbackText: {
    color: stellarColors.white,
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
    color: light.textPrimary,
  },
  assetIssuer: {
    fontSize: 11,
    lineHeight: 14,
    color: stellarColors.silver,
  },
  assetBalanceBlock: {
    alignItems: 'flex-end',
    gap: 2,
  },
  assetBalance: {
    fontSize: 15,
    lineHeight: 18,
    color: light.textPrimary,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  assetSymbol: {
    fontSize: 10,
    lineHeight: 13,
    color: stellarColors.silver,
  },
  hiddenAssetsText: {
    fontSize: 10,
    lineHeight: 14,
    color: stellarColors.silver,
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
    color: stellarColors.primaryActive,
  },
});
