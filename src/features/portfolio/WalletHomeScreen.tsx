import React, {useCallback, useEffect, useRef, useState} from 'react';
import {ActivityIndicator, StyleSheet, Text, View} from 'react-native';

import type {AccountRecord} from '../../capabilities/account/types';
import {
  loadBalanceSnapshot,
  type BalanceDependencies,
} from '../../capabilities/balance/loadBalanceSnapshot';
import type {BalanceSnapshot} from '../../capabilities/balance/types';
import {Button} from '../../ui/Button';
import {Card} from '../../ui/Card';
import {Screen} from '../../ui/Screen';
import {palette, spacing, typography} from '../../ui/theme';

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
    <Screen eyebrow="Stellar Testnet" title="Wallet">
      <Card title={account.label || 'Stellar account'}>
        <Text selectable style={styles.address}>
          {account.address}
        </Text>
        <View style={styles.metaRow}>
          <Text style={styles.meta}>{account.identityKind}</Text>
          <Text style={styles.meta}>
            {accountCount === 1 ? '1 account' : `${accountCount} accounts`}
          </Text>
        </View>
        <View style={styles.row}>
          <View style={styles.flex}>
            <Button label="Switch" variant="secondary" onPress={onSwitchAccount} />
          </View>
          <View style={styles.flex}>
            <Button label="Account" variant="secondary" onPress={onOpenAccount} />
          </View>
        </View>
      </Card>

      <Text style={styles.sectionTitle}>Portfolio</Text>
      {renderPortfolio(balanceState, refreshBalances)}

      <Text style={styles.sectionTitle}>Actions</Text>
      <View style={styles.row}>
        <View style={styles.flex}>
          <Button label="Send" onPress={onSend} />
        </View>
        <View style={styles.flex}>
          <Button label="Manage assets" variant="secondary" onPress={onManageAssets} />
        </View>
      </View>
      <Button label="Add account" variant="ghost" onPress={onAddAccount} />
    </Screen>
  );
}

function renderPortfolio(
  state: BalanceState,
  onRefresh: () => void,
): React.ReactNode {
  if (state.kind === 'loading') {
    return (
      <Card title="Balances">
        <View style={styles.loadingRow}>
          <ActivityIndicator />
          <Text style={styles.meta}>Loading current ledger balances...</Text>
        </View>
      </Card>
    );
  }

  if (state.kind === 'error') {
    return (
      <Card title="Balances" description={state.message}>
        <Button label="Retry" variant="secondary" onPress={onRefresh} />
      </Card>
    );
  }

  const {snapshot} = state;
  if (snapshot.status === 'inactive') {
    return (
      <Card
        title="Account not activated"
        description="This account does not exist on the selected Stellar network yet. Fund it before balances can appear.">
        <Button label="Refresh" variant="secondary" onPress={onRefresh} />
      </Card>
    );
  }

  if (snapshot.status === 'unsupported-account') {
    return (
      <Card
        title="Balance view unavailable"
        description="Classic Horizon balances are not applied to contract accounts."
      />
    );
  }

  return (
    <Card title="Balances">
      {snapshot.balances.length === 0 ? (
        <Text style={styles.meta}>No displayable balances.</Text>
      ) : (
        snapshot.balances.map(line => {
          const assetKey =
            line.asset.kind === 'native'
              ? 'XLM'
              : `${line.asset.code}:${line.asset.issuer}`;
          return (
            <View key={assetKey} style={styles.balanceRow}>
              <View style={styles.balanceIdentity}>
                <Text style={styles.assetCode}>{line.asset.code}</Text>
                {line.asset.kind === 'credit' ? (
                  <Text selectable numberOfLines={1} style={styles.issuer}>
                    {line.asset.issuer}
                  </Text>
                ) : null}
              </View>
              <Text selectable style={styles.balanceAmount}>
                {line.balance}
              </Text>
            </View>
          );
        })
      )}
      {snapshot.hiddenLiquidityPoolShareCount > 0 ? (
        <Text style={styles.meta}>
          {snapshot.hiddenLiquidityPoolShareCount} liquidity-pool position(s) are not shown in this first Portfolio slice.
        </Text>
      ) : null}
      <Button label="Refresh" variant="ghost" onPress={onRefresh} />
    </Card>
  );
}

const styles = StyleSheet.create({
  address: {
    ...typography.caption,
    color: palette.text,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  meta: {
    ...typography.caption,
    color: palette.textMuted,
  },
  sectionTitle: {
    ...typography.sectionTitle,
    color: palette.text,
    marginTop: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  flex: {
    flex: 1,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  balanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.md,
  },
  balanceIdentity: {
    flex: 1,
  },
  assetCode: {
    ...typography.body,
    color: palette.text,
    fontWeight: '700',
  },
  issuer: {
    ...typography.caption,
    color: palette.textMuted,
  },
  balanceAmount: {
    ...typography.body,
    color: palette.text,
    fontVariant: ['tabular-nums'],
  },
});
