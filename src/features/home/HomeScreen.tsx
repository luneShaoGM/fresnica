import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from 'react-native';

import {Screen} from '@ui/components';
import {useAppTheme, useThemedStyles} from '@ui/theme';

import type {AccountRecord} from '../../capabilities/account/types';
import {
  loadBalanceSnapshot,
  type BalanceDependencies,
} from '../../capabilities/balance/loadBalanceSnapshot';
import type {BalanceAsset} from '../../capabilities/balance/types';
import {projectFeatureError} from '../featureError';
import {AccountSummary} from './components/AccountSummary';
import {AssetList} from './components/AssetList';
import {InactiveAccountPanel} from './components/InactiveAccountPanel';
import {NetworkStatus} from './components/NetworkStatus';
import {
  createHomeViewModel,
  type HomeBalanceState,
} from './homeViewModel';
import {createStyles} from './styles';

type Props = Readonly<{
  account: AccountRecord;
  accountCount: number;
  balanceDependencies: BalanceDependencies;
  canSign: boolean;
  onSwitchAccount: () => void;
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
  balanceDependencies,
  canSign,
  onSwitchAccount,
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
  const styles = useThemedStyles(createStyles);
  const [balanceState, setBalanceState] = useState<HomeBalanceState>({kind: 'loading'});
  const requestVersion = useRef(0);

  const refreshBalances = useCallback((beforeLoad?: () => Promise<unknown>) => {
    const version = requestVersion.current + 1;
    requestVersion.current = version;
    setBalanceState({kind: 'loading'});

    const before = beforeLoad
      ? Promise.resolve().then(beforeLoad).catch(() => undefined)
      : Promise.resolve();

    void before
      .then(() => loadBalanceSnapshot(balanceDependencies, account))
      .then(snapshot => {
        if (requestVersion.current === version) {
          setBalanceState({kind: 'ready', snapshot});
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
  }, [account, balanceDependencies]);

  useEffect(() => {
    if (!active) {
      return;
    }

    refreshBalances();
    return () => {
      requestVersion.current += 1;
    };
  }, [active, invalidationRevision, refreshBalances]);

  const viewModel = useMemo(
    () =>
      createHomeViewModel(account, canSign, balanceState, {
        swap: typeof onSwap === 'function',
        request: typeof onRequest === 'function',
      }),
    [account, balanceState, canSign, onRequest, onSwap],
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
        showsVerticalScrollIndicator={false}>
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
          onSwitchAccount={onSwitchAccount}
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
              Balances can be viewed, but signing actions stay unavailable because this
              account has no supported Fresnica signer.
            </Text>
          </View>
        ) : null}

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Tokens</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{disabled: !viewModel.canManageAssets}}
            disabled={!viewModel.canManageAssets}
            onPress={viewModel.canManageAssets ? onManageAssets : undefined}
            style={({pressed}) => [
              styles.sectionLinkButton,
              pressed ? styles.pressed : undefined,
            ]}>
            <Text
              style={[
                styles.sectionLink,
                !viewModel.canManageAssets ? styles.sectionLinkDisabled : undefined,
              ]}>
              Add asset
            </Text>
          </Pressable>
        </View>

        {renderPortfolio(
          balanceState,
          viewModel.accountAddress,
          refreshBalances,
          onOpenAsset,
          theme.colors.actionPrimary,
          styles,
        )}
      </ScrollView>
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
      accessibilityState={{disabled: !enabled}}
      disabled={!enabled}
      onPress={enabled ? onPress : undefined}
      style={({pressed}) => [
        styles.action,
        !enabled ? styles.actionDisabled : undefined,
        pressed ? styles.pressed : undefined,
      ]}>
      <Text style={styles.actionText}>{label}</Text>
    </Pressable>
  );
}

function renderPortfolio(
  state: HomeBalanceState,
  address: string,
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
          style={({pressed}) => [styles.retryButton, pressed ? styles.pressed : undefined]}>
          <Text style={styles.retryText}>Try again</Text>
        </Pressable>
      </View>
    );
  }

  if (state.snapshot.status === 'inactive') {
    return <InactiveAccountPanel address={address} onRefresh={onRefresh} />;
  }

  if (state.snapshot.status === 'unsupported-account') {
    return (
      <View style={styles.stateBox}>
        <Text style={styles.stateTitle}>Assets unavailable</Text>
        <Text style={styles.stateText}>
          Classic Horizon balance semantics are not applied to contract accounts.
        </Text>
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
