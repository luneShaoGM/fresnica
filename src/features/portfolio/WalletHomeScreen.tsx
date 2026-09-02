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
          <View style={styles.sectionTitleRow}>
            <Text style={styles.sectionTitle}>Tokens</Text>
            <Text style={styles.sectionChevron}>⌄</Text>
          </View>
          <Pressable accessibilityRole="button" onPress={onManageAssets} style={styles.addAssetButton}>
            <Text style={styles.addAssetPlus}>＋</Text>
            <Text style={styles.sectionLink}>Add asset</Text>
          </Pressable>
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

  if (snapshot.balances.length === 0) {
    return (
      <View style={styles.stateBox}>
        <Text style={styles.stateText}>No displayable assets.</Text>
      </View>
    );
  }

  return (
    <View style={styles.assetList}>
      {snapshot.balances.map(line => {
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
                {line.asset.kind === 'credit'
                  ? shortAddress(line.asset.issuer)
                  : 'Stellar native asset'}
              </Text>
            </View>
            <Text selectable numberOfLines={1} style={styles.assetBalance}>
              {line.balance}
            </Text>
          </View>
        );
      })}
      {snapshot.hiddenLiquidityPoolShareCount > 0 ? (
        <Text style={styles.hiddenAssetsText}>
          {snapshot.hiddenLiquidityPoolShareCount} liquidity-pool position(s) hidden
        </Text>
      ) : null}
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
    paddingBottom: 24,
  },
  header: {
    minHeight: 60,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
    backgroundColor: '#00CA8A',
  },
  brand: {
    fontSize: 24,
    lineHeight: 29,
    fontWeight: '800',
    color: '#000000',
    letterSpacing: -0.6,
  },
  networkPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
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
    minHeight: 72,
    borderRadius: 11,
    backgroundColor: '#F3F6FA',
    paddingHorizontal: 16,
    paddingVertical: 12,
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
    fontSize: 16,
    lineHeight: 20,
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
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  switchGlyph: {
    fontSize: 20,
    lineHeight: 23,
    color: '#181D41',
    fontWeight: '700',
  },
  accountMetaRow: {
    minHeight: 29,
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
    gap: 8,
    marginTop: 15,
    marginBottom: 15,
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
    backgroundColor: '#00CA8A',
  },
  actionDark: {
    backgroundColor: '#181D41',
  },
  actionDisabled: {
    opacity: 0.4,
  },
  actionIcon: {
    width: 18,
    height: 18,
  },
  actionText: {
    color: '#FFFFFF',
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '800',
  },
  sectionHeader: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 20,
    lineHeight: 25,
    fontWeight: '800',
    color: '#000000',
  },
  sectionChevron: {
    marginLeft: 3,
    marginTop: 1,
    fontSize: 20,
    lineHeight: 23,
    color: '#181D41',
    fontWeight: '700',
  },
  addAssetButton: {
    minHeight: 30,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    gap: 1,
  },
  addAssetPlus: {
    fontSize: 17,
    lineHeight: 19,
    color: '#00B279',
    fontWeight: '700',
  },
  sectionLink: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
    color: '#00B279',
  },
  stateBox: {
    minHeight: 110,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    gap: 6,
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
    paddingVertical: 6,
  },
  retryText: {
    color: '#00B279',
    fontSize: 12,
    fontWeight: '700',
  },
  assetList: {
    paddingBottom: 6,
  },
  assetRow: {
    minHeight: 55,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  assetIcon: {
    width: 35,
    height: 35,
  },
  assetFallbackIcon: {
    width: 35,
    height: 35,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#181D41',
  },
  assetFallbackText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  assetIdentity: {
    flex: 1,
    gap: 1,
  },
  assetCode: {
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '800',
    color: '#000000',
  },
  assetIssuer: {
    fontSize: 11,
    lineHeight: 14,
    color: '#606885',
  },
  assetBalance: {
    maxWidth: '44%',
    fontSize: 14,
    lineHeight: 18,
    color: '#000000',
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    textAlign: 'right',
  },
  hiddenAssetsText: {
    fontSize: 10,
    lineHeight: 14,
    color: '#ACB1C1',
    paddingTop: 8,
  },
  pressed: {
    opacity: 0.7,
  },
});
