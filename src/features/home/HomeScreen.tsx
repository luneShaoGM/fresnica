import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  Image,
  type ImageSourcePropType,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  Text,
  View,
} from 'react-native';

import type {AccountRecord} from '../../capabilities/account/types';
import {
  loadBalanceSnapshot,
  type BalanceDependencies,
} from '../../capabilities/balance/loadBalanceSnapshot';
import {StellarLoadingIndicator, StellarTouchableDebounce} from '../../ui/components/stellar';
import {stellarColors} from '../../ui/theme/stellar';
import {AccountSwitchElement} from './components/AccountSwitchElement';
import {AssetsList} from './components/AssetsList';
import {InactiveAccount} from './components/InactiveAccount';
import {NetworkSwitchButton} from './components/NetworkSwitchButton';
import {
  createHomeViewModel,
  type HomeBalanceState,
} from './homeViewModel';
import {styles} from './styles';

type Props = Readonly<{
  account: AccountRecord;
  accountCount: number;
  balanceDependencies: BalanceDependencies;
  canSign: boolean;
  onSwitchAccount: () => void;
  onAddAccount: () => void;
  onSend: () => void;
  onManageAssets: () => void;
  onSwap?: () => void;
  onRequest?: () => void;
}>;

const sendIcon = require('../../ui/assets/stellar/icon_send_v2.png');
const swapIcon = require('../../ui/assets/stellar/icon_swap.png');
const requestIcon = require('../../ui/assets/stellar/icon_request.png');

/**
 * Source-parity Home vertical slice.
 *
 * Presentation authority: Stellar/src/screens/Home/HomeView.tsx and the directly
 * used NetworkSwitchButton, AccountSwitchElement, InactiveAccount and AssetsList.
 * Data and action authority remains Fresnica Account/Balance/Trustline/runtime.
 */
export function HomeScreen({
  account,
  accountCount,
  balanceDependencies,
  canSign,
  onSwitchAccount,
  onAddAccount,
  onSend,
  onManageAssets,
  onSwap,
  onRequest,
}: Props) {
  const [balanceState, setBalanceState] = useState<HomeBalanceState>({kind: 'loading'});
  const requestVersion = useRef(0);

  const refreshBalances = useCallback(() => {
    const version = requestVersion.current + 1;
    requestVersion.current = version;
    setBalanceState({kind: 'loading'});

    void loadBalanceSnapshot(balanceDependencies, account)
      .then(snapshot => {
        if (requestVersion.current === version) {
          setBalanceState({kind: 'ready', snapshot});
        }
      })
      .catch(error => {
        if (requestVersion.current === version) {
          setBalanceState({
            kind: 'error',
            message: error instanceof Error ? error.message : 'Unable to load balances.',
          });
        }
      });
  }, [account, balanceDependencies]);

  useEffect(() => {
    refreshBalances();
    return () => {
      requestVersion.current += 1;
    };
  }, [refreshBalances]);

  const viewModel = useMemo(
    () =>
      createHomeViewModel(account, canSign, balanceState, {
        swap: typeof onSwap === 'function',
        request: typeof onRequest === 'function',
      }),
    [account, balanceState, canSign, onRequest, onSwap],
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            onRefresh={refreshBalances}
            refreshing={balanceState.kind === 'loading'}
            tintColor={stellarColors.green}
          />
        }
        showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View style={styles.brandRow}>
            <View style={styles.brandMark} />
            <Text style={styles.brand}>Fresnica</Text>
          </View>
          <NetworkSwitchButton networkLabel={viewModel.networkLabel} />
        </View>

        <AccountSwitchElement
          accountCount={accountCount}
          accountKindLabel={viewModel.accountKindLabel}
          label={viewModel.accountLabel}
          maskedAddress={viewModel.maskedAddress}
          onAddAccount={onAddAccount}
          onSwitchAccount={onSwitchAccount}
        />

        <View style={styles.actionsRow}>
          <HomeAction
            enabled={viewModel.canSend}
            label="Send"
            onPress={onSend}
            source={sendIcon}
            tone="green"
          />
          <HomeAction
            enabled={viewModel.canSwap}
            label="Swap"
            onPress={onSwap}
            source={swapIcon}
            tone="dark"
          />
          <HomeAction
            enabled={viewModel.canRequest}
            label="Request"
            onPress={onRequest}
            source={requestIcon}
            tone="green"
          />
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
          <StellarTouchableDebounce
            accessibilityRole="button"
            accessibilityState={{disabled: !viewModel.canManageAssets}}
            activeOpacity={0.7}
            disabled={!viewModel.canManageAssets}
            onPress={viewModel.canManageAssets ? onManageAssets : undefined}
            style={styles.sectionLinkButton}>
            <Text
              style={[
                styles.sectionLink,
                !viewModel.canManageAssets ? styles.sectionLinkDisabled : undefined,
              ]}>
              Add asset
            </Text>
          </StellarTouchableDebounce>
        </View>

        {renderPortfolio(balanceState, viewModel.accountAddress, refreshBalances)}
      </ScrollView>
    </SafeAreaView>
  );
}

function HomeAction({
  enabled,
  label,
  source,
  tone,
  onPress,
}: Readonly<{
  enabled: boolean;
  label: string;
  source: ImageSourcePropType;
  tone: 'green' | 'dark';
  onPress?: () => void;
}>) {
  return (
    <StellarTouchableDebounce
      accessibilityRole="button"
      accessibilityState={{disabled: !enabled}}
      activeOpacity={0.7}
      disabled={!enabled}
      onPress={enabled ? onPress : undefined}
      style={[
        styles.action,
        tone === 'dark' ? styles.actionDark : styles.actionGreen,
        !enabled ? styles.actionDisabled : undefined,
      ]}>
      <Image resizeMode="contain" source={source} style={styles.actionIcon} />
      <Text style={styles.actionText}>{label}</Text>
    </StellarTouchableDebounce>
  );
}

function renderPortfolio(
  state: HomeBalanceState,
  address: string,
  onRefresh: () => void,
): React.ReactNode {
  if (state.kind === 'loading') {
    return (
      <View style={styles.stateBox}>
        <StellarLoadingIndicator color="default" />
        <Text style={styles.stateText}>Loading assets…</Text>
      </View>
    );
  }

  if (state.kind === 'error') {
    return (
      <View style={styles.stateBox}>
        <Text style={styles.stateTitle}>Balances unavailable</Text>
        <Text style={styles.stateText}>{state.message}</Text>
        <StellarTouchableDebounce
          accessibilityRole="button"
          activeOpacity={0.7}
          onPress={onRefresh}
          style={styles.retryButton}>
          <Text style={styles.retryText}>Try again</Text>
        </StellarTouchableDebounce>
      </View>
    );
  }

  if (state.snapshot.status === 'inactive') {
    return <InactiveAccount address={address} onRefresh={onRefresh} />;
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
    <AssetsList
      balances={state.snapshot.balances}
      hiddenLiquidityPoolShareCount={state.snapshot.hiddenLiquidityPoolShareCount}
      onRefresh={onRefresh}
    />
  );
}
