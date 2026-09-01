import React, {useCallback, useEffect, useRef, useState} from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import type {AccountRecord} from '../../capabilities/account/types';
import {
  loadBalanceSnapshot,
  type BalanceDependencies,
} from '../../capabilities/balance/loadBalanceSnapshot';
import type {BalanceSnapshot} from '../../capabilities/balance/types';
import {palette} from '../../ui/theme';

type BalanceState =
  | Readonly<{kind: 'loading'}>
  | Readonly<{kind: 'error'; message: string}>
  | Readonly<{kind: 'ready'; snapshot: BalanceSnapshot}>;

type Props = Readonly<{
  account: AccountRecord;
  accountCount: number;
  balanceDependencies: BalanceDependencies;
  onSwitchAccount: () => void;
  onAddAccount: () => void;
  onOpenAccount: () => void;
  onSend: () => void;
  onManageAssets: () => void;
  onSwap?: () => void;
  onRequest?: () => void;
}>;

const sendIcon = require('../../ui/assets/stellar/icon_send_v2.png');
const swapIcon = require('../../ui/assets/stellar/icon_swap.png');
const requestIcon = require('../../ui/assets/stellar/icon_request.png');
const xlmIcon = require('../../ui/assets/stellar/icon_xlm.png');

export function WalletHomeScreen({
  account,
  accountCount,
  balanceDependencies,
  onSwitchAccount,
  onAddAccount,
  onOpenAccount,
  onSend,
  onManageAssets,
  onSwap,
  onRequest,
}: Props) {
  const [balanceState, setBalanceState] = useState<BalanceState>({kind: 'loading'});
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

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={balanceState.kind === 'loading'}
            tintColor={palette.accent}
            onRefresh={refreshBalances}
          />
        }
        showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View style={styles.brandRow}>
            <View style={styles.brandMark} />
            <Text style={styles.brand}>Fresnica</Text>
          </View>
          <View style={styles.networkPill}>
            <View style={styles.networkDot} />
            <Text style={styles.networkText}>Testnet</Text>
          </View>
        </View>

        <Pressable
          accessibilityRole="button"
          onPress={onOpenAccount}
          style={({pressed}) => [styles.accountCard, pressed ? styles.pressed : undefined]}>
          <View style={styles.accountTextBlock}>
            <Text numberOfLines={1} style={styles.accountLabel}>
              {account.label || 'Stellar account'}
            </Text>
            <Text numberOfLines={1} selectable style={styles.accountAddress}>
              {shortAddress(account.address)}
            </Text>
          </View>
          <Pressable
            accessibilityLabel="Switch account"
            accessibilityRole="button"
            hitSlop={10}
            onPress={event => {
              event.stopPropagation();
              onSwitchAccount();
            }}
            style={({pressed}) => [styles.switchButton, pressed ? styles.pressed : undefined]}>
            <Text style={styles.switchGlyph}>⇄</Text>
          </Pressable>
        </Pressable>

        <View style={styles.accountMetaRow}>
          <Text style={styles.accountMeta}>{account.identityKind}</Text>
          <Pressable accessibilityRole="button" onPress={onAddAccount}>
            <Text style={styles.addAccountText}>
              {accountCount === 1 ? '+ Add account' : `${accountCount} accounts · Add`}
            </Text>
          </Pressable>
        </View>

        <View style={styles.actionsRow}>
          <HomeAction label="Send" source={sendIcon} onPress={onSend} tone="green" />
          <HomeAction label="Swap" source={swapIcon} onPress={onSwap} tone="dark" />
          <HomeAction label="Request" source={requestIcon} onPress={onRequest} tone="green" />
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Tokens</Text>
          <Pressable accessibilityRole="button" onPress={onManageAssets}>
            <Text style={styles.sectionLink}>Add asset</Text>
          </Pressable>
        </View>

        <View style={styles.assetTools}>
          <Text style={styles.toolText}>Filter</Text>
          <View style={styles.toolDivider} />
          <Text style={styles.toolText}>Sort</Text>
          <View style={styles.toolDivider} />
          <Text style={styles.toolText}>Favorites</Text>
        </View>

        {renderPortfolio(balanceState, refreshBalances)}
      </ScrollView>
    </SafeAreaView>
  );
}

function HomeAction({
  label,
  source,
  tone,
  onPress,
}: Readonly<{
  label: string;
  source: number;
  tone: 'green' | 'dark';
  onPress?: () => void;
}>) {
  const enabled = typeof onPress === 'function';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{disabled: !enabled}}
      disabled={!enabled}
      onPress={onPress}
      style={({pressed}) => [
        styles.action,
        tone === 'dark' ? styles.actionDark : styles.actionGreen,
        !enabled ? styles.actionDisabled : undefined,
        pressed ? styles.pressed : undefined,
      ]}>
      <Image resizeMode="contain" source={source} style={styles.actionIcon} />
      <Text style={styles.actionText}>{label}</Text>
    </Pressable>
  );
}

function renderPortfolio(state: BalanceState, onRefresh: () => void): React.ReactNode {
  if (state.kind === 'loading') {
    return (
      <View style={styles.stateBox}>
        <ActivityIndicator color={palette.accent} />
        <Text style={styles.stateText}>Loading assets…</Text>
      </View>
    );
  }

  if (state.kind === 'error') {
    return (
      <View style={styles.stateBox}>
        <Text style={styles.stateTitle}>Balances unavailable</Text>
        <Text style={styles.stateText}>{state.message}</Text>
        <Pressable onPress={onRefresh} style={styles.retryButton}>
          <Text style={styles.retryText}>Try again</Text>
        </Pressable>
      </View>
    );
  }

  const {snapshot} = state;
  if (snapshot.status === 'inactive') {
    return (
      <View style={styles.stateBox}>
        <Text style={styles.stateTitle}>Account not activated</Text>
        <Text style={styles.stateText}>
          Fund this account on Testnet before balances can appear.
        </Text>
        <Pressable onPress={onRefresh} style={styles.retryButton}>
          <Text style={styles.retryText}>Refresh</Text>
        </Pressable>
      </View>
    );
  }

  if (snapshot.status === 'unsupported-account') {
    return (
      <View style={styles.stateBox}>
        <Text style={styles.stateTitle}>Assets unavailable</Text>
        <Text style={styles.stateText}>
          Classic Horizon balances are not applied to contract accounts.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.assetList}>
      {snapshot.balances.length === 0 ? (
        <View style={styles.stateBox}>
          <Text style={styles.stateText}>No displayable assets.</Text>
        </View>
      ) : (
        snapshot.balances.map(line => {
          const assetKey =
            line.asset.kind === 'native'
              ? 'XLM'
              : `${line.asset.code}:${line.asset.issuer}`;
          return (
            <View key={assetKey} style={styles.assetRow}>
              {line.asset.kind === 'native' ? (
                <Image resizeMode="contain" source={xlmIcon} style={styles.assetIcon} />
              ) : (
                <View style={styles.assetFallbackIcon}>
                  <Text style={styles.assetFallbackText}>{line.asset.code.slice(0, 1)}</Text>
                </View>
              )}
              <View style={styles.assetIdentity}>
                <Text style={styles.assetCode}>{line.asset.code}</Text>
                <Text numberOfLines={1} style={styles.assetIssuer}>
                  {line.asset.kind === 'credit' ? shortAddress(line.asset.issuer) : 'Stellar native asset'}
                </Text>
              </View>
              <View style={styles.assetBalanceBlock}>
                <Text selectable style={styles.assetBalance}>
                  {line.balance}
                </Text>
                <Text style={styles.assetSymbol}>{line.asset.code}</Text>
              </View>
            </View>
          );
        })
      )}
      {snapshot.hiddenLiquidityPoolShareCount > 0 ? (
        <Text style={styles.hiddenAssetsText}>
          {snapshot.hiddenLiquidityPoolShareCount} liquidity-pool position(s) hidden
        </Text>
      ) : null}
      <Pressable onPress={onRefresh} style={styles.refreshLink}>
        <Text style={styles.refreshText}>Refresh balances</Text>
      </Pressable>
    </View>
  );
}

function shortAddress(value: string): string {
  if (value.length <= 20) {
    return value;
  }
  return `${value.slice(0, 9)}…${value.slice(-7)}`;
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  content: {
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 30,
  },
  header: {
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  brandMark: {
    width: 13,
    height: 13,
    borderRadius: 7,
    backgroundColor: '#00CA8A',
  },
  brand: {
    fontSize: 25,
    lineHeight: 30,
    fontWeight: '800',
    color: '#000000',
    letterSpacing: -0.6,
  },
  networkPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 15,
    backgroundColor: '#F3F6FA',
  },
  networkDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#F8BF4C',
  },
  networkText: {
    fontSize: 12,
    lineHeight: 15,
    fontWeight: '700',
    color: '#606885',
  },
  accountCard: {
    minHeight: 74,
    borderRadius: 12,
    backgroundColor: '#F3F6FA',
    paddingHorizontal: 16,
    paddingVertical: 13,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  accountTextBlock: {
    flex: 1,
    gap: 4,
  },
  accountLabel: {
    fontSize: 17,
    lineHeight: 21,
    fontWeight: '800',
    color: '#000000',
  },
  accountAddress: {
    fontSize: 12,
    lineHeight: 15,
    color: '#606885',
    fontVariant: ['tabular-nums'],
  },
  switchButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  switchGlyph: {
    fontSize: 22,
    lineHeight: 25,
    color: '#181D41',
    fontWeight: '700',
  },
  accountMetaRow: {
    minHeight: 32,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  accountMeta: {
    fontSize: 11,
    color: '#ACB1C1',
  },
  addAccountText: {
    fontSize: 11,
    color: '#606885',
    fontWeight: '600',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 9,
    marginTop: 5,
    marginBottom: 24,
  },
  action: {
    flex: 1,
    minHeight: 88,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  actionGreen: {
    backgroundColor: '#00CA8A',
  },
  actionDark: {
    backgroundColor: '#181D41',
  },
  actionDisabled: {
    opacity: 0.38,
  },
  actionIcon: {
    width: 31,
    height: 31,
  },
  actionText: {
    color: '#FFFFFF',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '800',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 21,
    lineHeight: 26,
    fontWeight: '800',
    color: '#000000',
  },
  sectionLink: {
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '700',
    color: '#00B279',
  },
  assetTools: {
    minHeight: 34,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  toolText: {
    fontSize: 11,
    color: '#ACB1C1',
    fontWeight: '600',
  },
  toolDivider: {
    width: 1,
    height: 12,
    backgroundColor: '#E7EAF0',
    marginHorizontal: 10,
  },
  stateBox: {
    minHeight: 92,
    borderRadius: 10,
    backgroundColor: '#F3F6FA',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    gap: 7,
  },
  stateTitle: {
    fontSize: 15,
    lineHeight: 19,
    fontWeight: '800',
    color: '#000000',
    textAlign: 'center',
  },
  stateText: {
    fontSize: 12,
    lineHeight: 17,
    color: '#606885',
    textAlign: 'center',
  },
  retryButton: {
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  retryText: {
    color: '#00B279',
    fontSize: 12,
    fontWeight: '700',
  },
  assetList: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E7EAF0',
  },
  assetRow: {
    minHeight: 70,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E7EAF0',
    gap: 12,
  },
  assetIcon: {
    width: 38,
    height: 38,
  },
  assetFallbackIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#181D41',
  },
  assetFallbackText: {
    color: '#FFFFFF',
    fontSize: 16,
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
    color: '#000000',
  },
  assetIssuer: {
    fontSize: 11,
    lineHeight: 14,
    color: '#ACB1C1',
  },
  assetBalanceBlock: {
    alignItems: 'flex-end',
    gap: 2,
  },
  assetBalance: {
    fontSize: 15,
    lineHeight: 18,
    color: '#000000',
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  assetSymbol: {
    fontSize: 10,
    lineHeight: 13,
    color: '#ACB1C1',
  },
  hiddenAssetsText: {
    fontSize: 10,
    lineHeight: 14,
    color: '#ACB1C1',
    paddingTop: 10,
  },
  refreshLink: {
    alignSelf: 'center',
    paddingHorizontal: 14,
    paddingVertical: 16,
  },
  refreshText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#00B279',
  },
  pressed: {
    opacity: 0.7,
  },
});
