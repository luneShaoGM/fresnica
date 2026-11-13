import type { XlmQuotePort } from '@capabilities/valuation/xlmQuote';
import { NativeFiatEstimate } from '@features/valuation/NativeFiatEstimate';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';

import { Screen } from '@ui/components';
import { NativeButton } from '@ui/components/NativeButton';
import { NativeStateView } from '@ui/components/NativeStateView';
import { useAppTheme, useThemedStyles } from '@ui/theme';

import type { AccountRecord } from '../../capabilities/account/types';
import type { BalanceProductDependencies } from '@capabilities/balance/BalanceCacheHydration';
import { useBalanceDisplay } from './useBalanceDisplay';
import { BalanceFreshnessNotice } from './components/BalanceFreshnessNotice';
import type { BalanceAsset } from '../../capabilities/balance/types';
import {
  fundTestnetAccountWithFriendbot,
  isFriendbotFundingAvailable,
  type FriendbotDependencies,
} from '../../capabilities/network/fundTestnetAccountWithFriendbot';
import { useLocalization } from '../../locale';
import { AccountPickerModal } from './components/AccountPickerModal';
import { AccountSummary } from './components/AccountSummary';
import { AssetList, PinnedNativeAssetRow } from './components/AssetList';
import { matchingNativeBalance, useNativeBalanceBreakdown } from './useNativeBalanceBreakdown';
import { SmallChevron, SmallClock } from '../../ui/components/SmallIcons';
import { AppBrandMark } from '@ui/components/AppBrandMark';
import { InactiveAccountPanel, type FriendbotFundingState } from './components/InactiveAccountPanel';
import { NetworkStatus } from './components/NetworkStatus';
import { createHomeViewModel, type HomeBalanceState } from './homeViewModel';
import { createStyles } from './styles';

type Props = Readonly<{
  xlmQuotes?: XlmQuotePort;
  account: AccountRecord;
  accountCount: number;
  selectableAccounts: readonly AccountRecord[];
  balanceDependencies: BalanceProductDependencies;
  friendbotDependencies: FriendbotDependencies;
  canSign: boolean;
  onSelectAccount: (accountId: string) => void | Promise<void>;
  onAddAccount: () => void;
  onSend: () => void;
  onManageAssets: () => void;
  assetCategory?: 'tokens' | 'claimable';
  onOpenAssetCategory?: () => void;
  onShowClaimable?: () => void;
  claimableContent?: React.ReactNode;
  onClaimablePullRefresh?: () => void;
  claimableNowCount?: number;
  onOpenAsset: (asset: BalanceAsset) => void;
  onManualRefresh: () => Promise<unknown>;
  onBalanceReload?: () => void;
  invalidationRevision: number;
  onSwitchNetwork?: () => void;
  onSwap?: () => void;
  onRequest?: () => void;
  active: boolean;
}>;

export function HomeScreen({
  xlmQuotes,
  account,
  accountCount,
  selectableAccounts,
  balanceDependencies,
  friendbotDependencies,
  canSign,
  onSelectAccount,
  onAddAccount,
  onSend,
  onManageAssets,
  assetCategory = 'tokens',
  onOpenAssetCategory,
  onShowClaimable,
  claimableContent,
  onClaimablePullRefresh,
  claimableNowCount = 0,
  onOpenAsset,
  onManualRefresh,
  onBalanceReload,
  invalidationRevision,
  onSwitchNetwork,
  onSwap,
  onRequest,
  active,
}: Props) {
  const theme = useAppTheme();
  const { t, formatNumber, displayPreferences } = useLocalization();
  const styles = useThemedStyles(createStyles);
  const {
    state: balanceState,
    refresh: refreshBalances,
    verifiedInactive,
    hasFreshInactiveSnapshot,
  } = useBalanceDisplay(account, balanceDependencies, active, invalidationRevision);
  const [accountPickerVisible, setAccountPickerVisible] = useState(false);
  const [manualRefreshing, setManualRefreshing] = useState(false);
  const [friendbotStateByAccount, setFriendbotStateByAccount] = useState<Record<string, FriendbotFundingState>>({});
  const currentAccountId = useRef(account.id);
  const friendbotRequestAccountIds = useRef<Set<string>>(new Set());
  currentAccountId.current = account.id;

  const clearFriendbotState = useCallback((accountId: string) => {
    setFriendbotStateByAccount(current => {
      if (current[accountId] === undefined) {
        return current;
      }
      const next = { ...current };
      delete next[accountId];
      return next;
    });
  }, []);

  const fundWithFriendbot = useCallback(async () => {
    if (balanceState.kind !== 'ready' || balanceState.stale || balanceState.snapshot.status !== 'inactive') return;
    const accountId = account.id;
    if (friendbotRequestAccountIds.current.has(accountId)) {
      return;
    }

    friendbotRequestAccountIds.current.add(accountId);
    setFriendbotStateByAccount(current => ({ ...current, [accountId]: 'funding' }));
    try {
      if (!hasFreshInactiveSnapshot()) await refreshBalances();
      if (currentAccountId.current !== accountId || !hasFreshInactiveSnapshot()) {
        clearFriendbotState(accountId);
        return;
      }
      await fundTestnetAccountWithFriendbot(friendbotDependencies, account);
      clearFriendbotState(accountId);
      if (currentAccountId.current === accountId) {
        onBalanceReload?.();
        refreshBalances();
      }
    } catch {
      if (currentAccountId.current === accountId) {
        setFriendbotStateByAccount(current => ({ ...current, [accountId]: 'error' }));
        AccessibilityInfo.announceForAccessibility(t('home.friendbot.error'));
      } else {
        clearFriendbotState(accountId);
      }
    } finally {
      friendbotRequestAccountIds.current.delete(accountId);
    }
  }, [
    account,
    balanceState,
    clearFriendbotState,
    friendbotDependencies,
    hasFreshInactiveSnapshot,
    onBalanceReload,
    refreshBalances,
    t,
  ]);

  const visibleFriendbotState: FriendbotFundingState = friendbotStateByAccount[account.id] ?? 'idle';
  const friendbotAvailable = isFriendbotFundingAvailable(friendbotDependencies, account);

  const viewModel = useMemo(
    () =>
      createHomeViewModel(account, canSign, balanceState, {
        swap: typeof onSwap === 'function',
        request: typeof onRequest === 'function',
        friendbot: friendbotAvailable,
      }),
    [account, balanceState, canSign, friendbotAvailable, onRequest, onSwap],
  );

  const nativeLine =
    balanceState.kind === 'ready' && balanceState.snapshot.status === 'active'
      ? balanceState.snapshot.balances.find(line => line.asset.kind === 'native')
      : undefined;
  const nativeReady =
    active && !!nativeLine && balanceState.kind === 'ready' && !balanceState.stale && !balanceState.refreshing;
  const nativeDetails = useNativeBalanceBreakdown(
    account,
    balanceDependencies,
    nativeReady,
    invalidationRevision,
    balanceState.kind === 'ready' ? balanceState.lastSuccessfulUpdateAt?.getTime() : undefined,
  );
  const safeNativeDetails = nativeLine
    ? matchingNativeBalance(nativeDetails, nativeLine.balance, !nativeReady)
    : undefined;

  return (
    <Screen scrollable={false} contentInset="none">
      <View style={styles.homeLayout}>
        <ScrollView
          style={styles.headerScroll}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <View style={styles.brandLockup}>
              <AppBrandMark />
              <Text numberOfLines={1} style={styles.brand}>
                Fresnica
              </Text>
            </View>
            <NetworkStatus networkLabel={viewModel.networkLabel} onPress={onSwitchNetwork} />
          </View>

          <AccountSummary
            accountCount={accountCount}
            accountKindLabel={viewModel.accountKindLabel}
            label={viewModel.accountLabel}
            maskedAddress={viewModel.maskedAddress}
            onAddAccount={onAddAccount}
            onOpenAccountPicker={() => setAccountPickerVisible(true)}
          />

          <View style={styles.actionsRow}>
            <HomeAction enabled={viewModel.canSend} label="Send" onPress={onSend} />
            <HomeAction enabled={viewModel.canSwap} label="Swap" onPress={onSwap} />
            <HomeAction enabled={viewModel.canRequest} label="Request" onPress={onRequest} />
          </View>

          {viewModel.isReadOnly ? (
            <View style={styles.readOnlyNotice}>
              <Text style={styles.readOnlyTitle}>Read-only account</Text>
              <Text style={styles.readOnlyText}>
                Balances can be viewed, but signing actions stay unavailable because this account has no supported
                Fresnica signer.
              </Text>
            </View>
          ) : null}

          <View style={styles.sectionHeader}>
            <View style={styles.categoryTitleRow}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('claimable.category.choose')}
                onPress={onOpenAssetCategory}
                disabled={!onOpenAssetCategory}
                style={styles.categoryTitleButton}
              >
                <Text style={styles.sectionTitle}>
                  {assetCategory === 'claimable' ? t('claimable.category.claimable') : t('claimable.category.assets')}
                </Text>
                <SmallChevron color={theme.colors.textSecondary} />
              </Pressable>
              {assetCategory === 'tokens' && claimableNowCount > 0 && onShowClaimable ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t('claimable.hint') + ' ' + claimableNowCount}
                  onPress={onShowClaimable}
                  style={styles.claimableHintBadge}
                >
                  <SmallClock color={theme.colors.actionPrimaryPressed} />
                  <Text style={styles.claimableHintText}>{claimableNowCount}</Text>
                </Pressable>
              ) : null}
            </View>
            {assetCategory === 'tokens' ? (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ disabled: !viewModel.canManageAssets }}
                disabled={!viewModel.canManageAssets}
                onPress={viewModel.canManageAssets ? onManageAssets : undefined}
                style={({ pressed }) => [styles.sectionLinkButton, pressed ? styles.pressed : undefined]}
              >
                <Text style={[styles.sectionLink, !viewModel.canManageAssets ? styles.sectionLinkDisabled : undefined]}>
                  Add asset
                </Text>
              </Pressable>
            ) : null}
          </View>

          {assetCategory === 'tokens' ? (
            <>
              <BalanceFreshnessNotice state={balanceState} onRefresh={refreshBalances} showRefreshStatus={false} />
            </>
          ) : null}
        </ScrollView>
        {assetCategory === 'tokens' && nativeLine ? (
          <View style={styles.nativeFixedWrap}>
            <PinnedNativeAssetRow showReserve={displayPreferences?.reserveDisplay} formatAmount={formatNumber ? value => formatNumber(value, 7) : undefined} line={nativeLine} breakdown={safeNativeDetails} onOpenAsset={onOpenAsset} t={t} />
            {account.networkId === 'stellar-mainnet' ? <NativeFiatEstimate quotes={xlmQuotes} amount={safeNativeDetails?.available ?? nativeLine.balance} currency={displayPreferences?.currency ?? 'USD'} active={active} /> : null}
          </View>
        ) : null}
        <ScrollView
          style={styles.tokenScroll}
          contentContainerStyle={styles.tokenContent}
          refreshControl={
            <RefreshControl
              onRefresh={() => {
                if (assetCategory === 'claimable') {
                  onClaimablePullRefresh?.();
                  return;
                }
                setManualRefreshing(true);
                void Promise.resolve(refreshBalances(onManualRefresh)).finally(() => {
                  setManualRefreshing(false);
                  onBalanceReload?.();
                });
              }}
              refreshing={manualRefreshing}
              tintColor={theme.colors.actionPrimary}
            />
          }
          showsVerticalScrollIndicator={false}
        >
          {assetCategory === 'claimable'
            ? claimableContent
            : renderPortfolio(
                balanceState,
                viewModel.accountAddress,
                friendbotAvailable,
                visibleFriendbotState,
                verifiedInactive === true,
                fundWithFriendbot,
                refreshBalances,
                onOpenAsset,
                theme.colors.actionPrimary,
                styles,
                formatNumber ? value => formatNumber(value, 7) : undefined,
              )}
        </ScrollView>
      </View>
      <AccountPickerModal
        accounts={selectableAccounts}
        onRequestClose={() => setAccountPickerVisible(false)}
        onSelectAccount={onSelectAccount}
        selectedAccountId={account.id}
        visible={accountPickerVisible}
      />
    </Screen>
  );
}

function HomeAction({
  enabled,
  label,
  onPress,
}: Readonly<{
  enabled: boolean;
  label: string;
  onPress?: () => void;
}>) {
  const styles = useThemedStyles(createStyles);
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      accessibilityState={{ disabled: !enabled }}
      disabled={!enabled}
      onPress={enabled ? onPress : undefined}
      style={({ pressed }) => [
        styles.action,
        !enabled ? styles.actionDisabled : undefined,
        pressed ? styles.pressed : undefined,
      ]}
    >
      <Text style={styles.actionText}>{label}</Text>
    </Pressable>
  );
}

function renderPortfolio(
  state: HomeBalanceState,
  address: string,
  friendbotAvailable: boolean,
  friendbotState: FriendbotFundingState,
  verifiedInactive: boolean,
  onFundWithFriendbot: () => void,
  onRefresh: () => void,
  onOpenAsset: (asset: BalanceAsset) => void,
  loadingColor: string,
  styles: ReturnType<typeof createStyles>,
  formatAmount?: (value: string) => string,
): React.ReactNode {
  if (state.kind === 'loading') {
    return (
      <View style={styles.stateBox}>
        <ActivityIndicator color={loadingColor} />
        <Text style={styles.stateText}>Loading assets…</Text>
      </View>
    );
  }

  if (state.kind === 'error') {
    return (
      <NativeStateView
        action={<NativeButton label="Try again" onPress={onRefresh} size="sm" variant="secondary" />}
        description={state.message}
        title="Balances unavailable"
        tone="error"
      />
    );
  }

  if (state.snapshot.status === 'inactive') {
    return (
      <InactiveAccountPanel
        address={address}
        stale={state.stale}
        verifiedInactive={verifiedInactive}
        friendbotAvailable={friendbotAvailable}
        friendbotState={friendbotState}
        onFundWithFriendbot={onFundWithFriendbot}
        onRefresh={onRefresh}
      />
    );
  }

  if (state.snapshot.status === 'unsupported-account') {
    return (
      <NativeStateView
        description="Classic Horizon balance semantics are not applied to contract accounts."
        title="Assets unavailable"
      />
    );
  }

  return (
    <AssetList
      formatAmount={formatAmount}
      balances={state.snapshot.balances}
      hiddenLiquidityPoolShareCount={state.snapshot.hiddenLiquidityPoolShareCount}
      onOpenAsset={onOpenAsset}
    />
  );
}
