import React, {useCallback, useEffect, useRef, useState} from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
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
import type {BalanceLine, BalanceSnapshot} from '../../capabilities/balance/types';
import {stellarDonorAssets} from '../../ui/stellarDonorAssets';
import {palette, radius, spacing, typography} from '../../ui/theme';

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
}>;

export function WalletHomeScreen({
  account,
  accountCount,
  balanceDependencies,
  onSwitchAccount,
  onAddAccount,
  onOpenAccount,
  onSend,
  onManageAssets,
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
    <View style={styles.root}>
      <View style={styles.header}>
        <View style={styles.brandWrap}>
          <Text style={styles.brand}>Fresnica</Text>
        </View>
        <View style={styles.networkPill}>
          <View style={styles.networkDot} />
          <Text style={styles.networkText}>TESTNET</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}>
        <View style={styles.accountSwitchContainer}>
          <Pressable
            accessibilityLabel="Switch account"
            onPress={onSwitchAccount}
            style={({pressed}) => [styles.accountMain, pressed ? styles.pressed : undefined]}>
            <View style={styles.accountAvatar}>
              <Text style={styles.accountAvatarText}>{account.identityKind === 'classic' ? 'S' : 'C'}</Text>
            </View>
            <View style={styles.accountCopy}>
              <Text numberOfLines={1} style={styles.accountLabel}>
                {account.label || 'Stellar account'}
              </Text>
              <Text numberOfLines={1} style={styles.address}>
                {compactAddress(account.address)}
              </Text>
            </View>
            <View style={styles.accountMeta}>
              <Text style={styles.accountCount}>{accountCount}</Text>
              <Text style={styles.chevron}>⌄</Text>
            </View>
          </Pressable>
          <Pressable
            accessibilityLabel="Add account"
            onPress={onAddAccount}
            style={({pressed}) => [styles.addAccount, pressed ? styles.pressed : undefined]}>
            <Text style={styles.addAccountText}>＋</Text>
          </Pressable>
        </View>

        <View style={styles.actionRow}>
          <ActionButton
            label="Send"
            icon={stellarDonorAssets.actionSend}
            backgroundColor={palette.accent}
            onPress={onSend}
          />
          <ActionButton
            label="Swap"
            icon={stellarDonorAssets.actionSwap}
            backgroundColor={palette.darkBlue}
            disabled
          />
          <ActionButton
            label="Request"
            icon={stellarDonorAssets.actionRequest}
            backgroundColor={palette.green}
            disabled
          />
        </View>

        {renderPortfolio(balanceState, refreshBalances, onManageAssets, onOpenAccount)}
      </ScrollView>
    </View>
  );
}

function renderPortfolio(
  state: BalanceState,
  onRefresh: () => void,
  onManageAssets: () => void,
  onOpenAccount: () => void,
): React.ReactNode {
  return (
    <View style={styles.assetsSection}>
      <View style={styles.assetsHeader}>
        <Text style={styles.assetsTitle}>Tokens</Text>
        <Pressable onPress={onManageAssets} style={({pressed}) => pressed ? styles.pressed : undefined}>
          <Text style={styles.addAsset}>＋ Add asset</Text>
        </Pressable>
      </View>

      <View style={styles.assetTools}>
        <Tool label="Filter" />
        <Tool label="Sort" />
        <Tool label="Favorites" />
        <View style={styles.flexSpacer} />
        <Pressable onPress={onRefresh} style={({pressed}) => pressed ? styles.pressed : undefined}>
          <Text style={styles.refresh}>Refresh</Text>
        </Pressable>
      </View>

      {state.kind === 'loading' ? (
        <View style={styles.stateBox}>
          <ActivityIndicator color={palette.accent} />
          <Text style={styles.stateText}>Loading current ledger balances…</Text>
        </View>
      ) : state.kind === 'error' ? (
        <View style={styles.stateBox}>
          <Text style={styles.stateTitle}>Unable to load tokens</Text>
          <Text style={styles.stateText}>{state.message}</Text>
          <Pressable onPress={onRefresh} style={styles.stateAction}>
            <Text style={styles.stateActionText}>Try again</Text>
          </Pressable>
        </View>
      ) : state.snapshot.status === 'inactive' ? (
        <View style={styles.inactiveBox}>
          <Text style={styles.stateTitle}>Account not activated</Text>
          <Text style={styles.stateText}>
            Fund this account on Stellar Testnet before tokens can appear.
          </Text>
          <Pressable onPress={onOpenAccount} style={styles.stateAction}>
            <Text style={styles.stateActionText}>Account details</Text>
          </Pressable>
        </View>
      ) : state.snapshot.status === 'unsupported-account' ? (
        <View style={styles.stateBox}>
          <Text style={styles.stateTitle}>Token list unavailable</Text>
          <Text style={styles.stateText}>Classic Horizon balances do not apply to this contract account.</Text>
        </View>
      ) : (
        <ActiveAssets snapshot={state.snapshot} />
      )}
    </View>
  );
}

function ActiveAssets({snapshot}: Readonly<{snapshot: Extract<BalanceSnapshot, {status: 'active'}>}>) {
  if (snapshot.balances.length === 0) {
    return (
      <View style={styles.stateBox}>
        <Text style={styles.stateText}>No displayable tokens.</Text>
      </View>
    );
  }

  return (
    <View style={styles.assetList}>
      {snapshot.balances.map(line => (
        <AssetRow key={assetKey(line)} line={line} />
      ))}
      {snapshot.hiddenLiquidityPoolShareCount > 0 ? (
        <Text style={styles.hiddenAssets}>
          {snapshot.hiddenLiquidityPoolShareCount} liquidity-pool position(s) hidden.
        </Text>
      ) : null}
    </View>
  );
}

function AssetRow({line}: Readonly<{line: BalanceLine}>) {
  const native = line.asset.kind === 'native';
  return (
    <View style={styles.assetRow}>
      <View style={[styles.assetIcon, native ? styles.nativeAssetIcon : undefined]}>
        <Text style={[styles.assetIconText, native ? styles.nativeAssetIconText : undefined]}>
          {native ? '✦' : line.asset.code.slice(0, 1).toUpperCase()}
        </Text>
      </View>
      <View style={styles.assetIdentity}>
        <Text style={styles.assetCode}>{line.asset.code}</Text>
        <Text numberOfLines={1} style={styles.assetIssuer}>
          {native ? 'Stellar' : compactAddress(line.asset.issuer)}
        </Text>
      </View>
      <View style={styles.assetValue}>
        <Text selectable style={styles.balanceAmount}>{line.balance}</Text>
        <Text style={styles.assetTicker}>{line.asset.code}</Text>
      </View>
    </View>
  );
}

function Tool({label}: Readonly<{label: string}>) {
  return (
    <View style={styles.tool}>
      <Text style={styles.toolText}>{label}</Text>
    </View>
  );
}

function ActionButton({
  label,
  icon,
  backgroundColor,
  onPress,
  disabled = false,
}: Readonly<{
  label: string;
  icon: number;
  backgroundColor: string;
  onPress?: () => void;
  disabled?: boolean;
}>) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{disabled}}
      disabled={disabled}
      onPress={onPress}
      style={({pressed}) => [
        styles.actionButton,
        {backgroundColor},
        disabled ? styles.disabledAction : undefined,
        pressed ? styles.actionPressed : undefined,
      ]}>
      <Image source={icon} style={styles.actionIcon} />
      <Text style={styles.actionText}>{label}</Text>
    </Pressable>
  );
}

function compactAddress(address: string): string {
  if (address.length <= 18) {
    return address;
  }
  return `${address.slice(0, 9)}…${address.slice(-7)}`;
}

function assetKey(line: BalanceLine): string {
  return line.asset.kind === 'native'
    ? 'XLM'
    : `${line.asset.code}:${line.asset.issuer}`;
}

const styles = StyleSheet.create({
  root: {flex: 1, backgroundColor: palette.background},
  header: {
    height: 60,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  brandWrap: {flex: 1},
  brand: {
    color: palette.text,
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '800',
    letterSpacing: -0.8,
  },
  networkPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: radius.pill,
    backgroundColor: palette.tint,
  },
  networkDot: {width: 8, height: 8, borderRadius: 4, backgroundColor: palette.accent},
  networkText: {...typography.caption, color: palette.text, fontWeight: '800', fontSize: 10},
  content: {paddingBottom: spacing.xl},
  accountSwitchContainer: {
    backgroundColor: palette.tint,
    marginHorizontal: spacing.md,
    paddingTop: 7,
    paddingBottom: 4,
    paddingLeft: 10,
    paddingRight: 6,
    borderRadius: radius.md,
    flexDirection: 'row',
    alignItems: 'center',
  },
  accountMain: {flex: 1, minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: spacing.sm},
  accountAvatar: {width: 38, height: 38, borderRadius: 19, backgroundColor: palette.surface, alignItems: 'center', justifyContent: 'center'},
  accountAvatarText: {...typography.label, color: palette.text},
  accountCopy: {flex: 1, minWidth: 0},
  accountLabel: {...typography.body, color: palette.text, fontWeight: '700'},
  address: {...typography.caption, color: palette.textMuted},
  accountMeta: {alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5},
  accountCount: {...typography.caption, color: palette.textMuted, fontWeight: '700'},
  chevron: {color: palette.text, fontSize: 17, lineHeight: 18},
  addAccount: {width: 40, height: 46, alignItems: 'center', justifyContent: 'center', borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: palette.border},
  addAccountText: {fontSize: 22, color: palette.text},
  actionRow: {flexDirection: 'row', marginVertical: spacing.md, marginHorizontal: spacing.md - 4, gap: 8},
  actionButton: {flex: 1, minHeight: 46, borderRadius: radius.sm, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, paddingHorizontal: 8},
  actionIcon: {width: 18, height: 18, resizeMode: 'contain', tintColor: palette.white},
  actionText: {...typography.button, color: palette.white},
  disabledAction: {opacity: 0.48},
  actionPressed: {opacity: 0.72},
  assetsSection: {paddingTop: 2},
  assetsHeader: {paddingHorizontal: spacing.lg, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between'},
  assetsTitle: {...typography.sectionTitle, color: palette.text},
  addAsset: {...typography.label, color: palette.accent},
  assetTools: {flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: spacing.lg, paddingVertical: spacing.md},
  tool: {backgroundColor: palette.tint, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 6},
  toolText: {...typography.caption, color: palette.text, fontWeight: '700'},
  flexSpacer: {flex: 1},
  refresh: {...typography.caption, color: palette.textMuted, fontWeight: '700'},
  assetList: {borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: palette.border},
  assetRow: {minHeight: 70, paddingHorizontal: spacing.lg, flexDirection: 'row', alignItems: 'center', gap: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: palette.border},
  assetIcon: {width: 42, height: 42, borderRadius: 9, backgroundColor: palette.tint, alignItems: 'center', justifyContent: 'center'},
  nativeAssetIcon: {backgroundColor: palette.darkBlue},
  assetIconText: {...typography.label, color: palette.text},
  nativeAssetIconText: {color: palette.white, fontSize: 19},
  assetIdentity: {flex: 1, minWidth: 0},
  assetCode: {...typography.body, color: palette.text, fontWeight: '800'},
  assetIssuer: {...typography.caption, color: palette.textMuted},
  assetValue: {alignItems: 'flex-end'},
  balanceAmount: {...typography.body, color: palette.text, fontWeight: '700', fontVariant: ['tabular-nums']},
  assetTicker: {...typography.caption, color: palette.textMuted},
  hiddenAssets: {...typography.caption, color: palette.textMuted, padding: spacing.lg},
  stateBox: {marginHorizontal: spacing.lg, paddingVertical: spacing.xl, alignItems: 'center', gap: spacing.sm},
  inactiveBox: {marginHorizontal: spacing.lg, marginTop: spacing.sm, padding: spacing.lg, borderRadius: radius.lg, backgroundColor: palette.tint, alignItems: 'center', gap: spacing.sm},
  stateTitle: {...typography.sectionTitle, color: palette.text, textAlign: 'center'},
  stateText: {...typography.body, color: palette.textMuted, textAlign: 'center'},
  stateAction: {marginTop: spacing.xs, borderRadius: radius.pill, backgroundColor: palette.accent, paddingHorizontal: spacing.lg, paddingVertical: 10},
  stateActionText: {...typography.label, color: palette.white},
  pressed: {opacity: 0.62},
});
