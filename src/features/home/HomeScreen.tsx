import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';

import { Screen } from '@ui/components';
import { useAppTheme, useThemedStyles } from '@ui/theme';

import type { AccountRecord } from '../../capabilities/account/types';
import { loadBalanceSnapshot, type BalanceDependencies } from '../../capabilities/balance/loadBalanceSnapshot';
import type { BalanceAsset } from '../../capabilities/balance/types';
import {
  fundTestnetAccountWithFriendbot,
  isFriendbotFundingAvailable,
  type FriendbotDependencies,
} from '../../capabilities/network/fundTestnetAccountWithFriendbot';
import { useLocalization } from '../../locale';
import { projectFeatureError } from '../featureError';
import { AccountPickerModal } from './components/AccountPickerModal';
import { AccountSummary } from './components/AccountSummary';
import { AssetList } from './components/AssetList';
import { InactiveAccountPanel, type FriendbotFundingState } from './components/InactiveAccountPanel';
import { NetworkStatus } from './components/NetworkStatus';
import { createHomeViewModel, type HomeBalanceState } from './homeViewModel';
import { createStyles } from './styles';

type Props = Readonly<{
  account: AccountRecord;
  accountCount: number;
  selectableAccounts: readonly AccountRecord[];
  balanceDependencies: BalanceDependencies;
  friendbotDependencies: FriendbotDependencies;
  canSign: boolean;
  onSelectAccount: (accountId: string) => void | Promise<void>;
  onAddAccount: () => void;
  onSend: () => void;
  onManageAssets: () => void;
  onOpenAsset: (asset: BalanceAsset) => void;
  onManualRefresh: () => Promise<unknown>;
  invalidationRevision: number;
  onSwap?: () => void;
  onRequest?: () => void;
  active: boolean;
}>;

export function HomeScreen({
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
  onOpenAsset,
  onManualRefresh,
  invalidationRevision,
  onSwap,
  onRequest,
  active,
}: Props) {
  const theme = useAppTheme();
  const { t } = useLocalization();
  const styles = useThemedStyles(createStyles);
  const [balanceState, setBalanceState] = useState<HomeBalanceState>({ kind: 'loading' });
  const [accountPickerVisible, setAccountPickerVisible] = useState(false);
  const [friendbotStateByAccount, setFriendbotStateByAccount] = useState<Record<string, FriendbotFundingState>>({});
  const requestVersion = useRef(0);
  const currentAccountId = useRef(account.id);
  const friendbotRequestAccountIds = useRef<Set<string>>(new Set());
  currentAccountId.current = account.id;

  const refreshBalances = useCallback(
    (beforeLoad?: () => Promise<unknown>) => {
      const version = requestVersion.current + 1;
      requestVersion.current = version;
      setBalanceState({ kind: 'loading' });

      const before = beforeLoad
        ? Promise.resolve()
            .then(beforeLoad)
            .catch(() => undefined)
        : Promise.resolve();

      void before
        .then(() => loadBalanceSnapshot(balanceDependencies, account))
        .then(snapshot => {
          if (requestVersion.current === version) {
            setBalanceState({ kind: 'ready', snapshot });
          }
        })
        .catch(error => {
          if (requestVersion.current === version) {
            setBalanceState({
              kind: 'error',
              message: projectFeatureError(error, {
                fallbackMessage: 'Unable to load balances.',
                fallbackRetryable: true,
              }).message,
            });
          }
        });
    },
    [account, balanceDependencies],
  );

  useEffect(() => {
    if (!active) {
      return;
    }

    refreshBalances();
    return () => {
      requestVersion.current += 1;
    };
  }, [active, invalidationRevision, refreshBalances]);

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
    const accountId = account.id;
    if (friendbotRequestAccountIds.current.has(accountId)) {
      return;
    }

    friendbotRequestAccountIds.current.add(accountId);
    setFriendbotStateByAccount(current => ({ ...current, [accountId]: 'funding' }));
    try {
      await fundTestnetAccountWithFriendbot(friendbotDependencies, account);
      clearFriendbotState(accountId);
      if (currentAccountId.current === accountId) {
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
  }, [account, clearFriendbotState, friendbotDependencies, refreshBalances, t]);

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

  return (
    <Screen scrollable={false} contentInset="none">
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            onRefresh={() => refreshBalances(onManualRefresh)}
            refreshing={balanceState.kind === 'loading'}
            tintColor={theme.colors.actionPrimary}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.brand}>Fresnica</Text>
          <NetworkStatus networkLabel={viewModel.networkLabel} />
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
          <Text style={styles.sectionTitle}>Tokens</Text>
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
        </View>

        {renderPortfolio(
          balanceState,
          viewModel.accountAddress,
          viewModel.canFundWithFriendbot,
          visibleFriendbotState,
          fundWithFriendbot,
          refreshBalances,
          onOpenAsset,
          theme.colors.actionPrimary,
          styles,
        )}
      </ScrollView>
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
  onFundWithFriendbot: () => void,
  onRefresh: () => void,
  onOpenAsset: (asset: BalanceAsset) => void,
  loadingColor: string,
  styles: ReturnType<typeof createStyles>,
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
      <View style={styles.stateBox}>
        <Text style={styles.stateTitle}>Balances unavailable</Text>
        <Text style={styles.stateText}>{state.message}</Text>
        <Pressable
          accessibilityRole="button"
          onPress={onRefresh}
          style={({ pressed }) => [styles.retryButton, pressed ? styles.pressed : undefined]}
        >
          <Text style={styles.retryText}>Try again</Text>
        </Pressable>
      </View>
    );
  }

  if (state.snapshot.status === 'inactive') {
    return (
      <InactiveAccountPanel
        address={address}
        friendbotAvailable={friendbotAvailable}
        friendbotState={friendbotState}
        onFundWithFriendbot={onFundWithFriendbot}
        onRefresh={onRefresh}
      />
    );
  }

  if (state.snapshot.status === 'unsupported-account') {
    return (
      <View style={styles.stateBox}>
        <Text style={styles.stateTitle}>Assets unavailable</Text>
        <Text style={styles.stateText}>Classic Horizon balance semantics are not applied to contract accounts.</Text>
      </View>
    );
  }

  return (
    <AssetList
      balances={state.snapshot.balances}
      hiddenLiquidityPoolShareCount={state.snapshot.hiddenLiquidityPoolShareCount}
      onRefresh={onRefresh}
      onOpenAsset={onOpenAsset}
    />
  );
}
