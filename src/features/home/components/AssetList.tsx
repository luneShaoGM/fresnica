import React from 'react';
import {Pressable, Text, View} from 'react-native';

import type {BalanceLine} from '../../../capabilities/balance/types';
import {useThemedStyles} from '@ui/theme';
import {maskAddress} from '../homeViewModel';
import {createStyles} from '../styles';

type Props = Readonly<{
  balances: readonly BalanceLine[];
  hiddenLiquidityPoolShareCount: number;
  onRefresh: () => void;
  onOpenAsset: (asset: BalanceLine['asset']) => void;
}>;

export function AssetList({
  balances,
  hiddenLiquidityPoolShareCount,
  onRefresh,
  onOpenAsset,
}: Props) {
  const styles = useThemedStyles(createStyles);
  if (balances.length === 0) {
    return (
      <View style={styles.stateBox}>
        <Text style={styles.stateText}>No displayable assets.</Text>
        <Pressable
          accessibilityRole="button"
          onPress={onRefresh}
          style={({pressed}) => [styles.retryButton, pressed ? styles.pressed : undefined]}>
          <Text style={styles.retryText}>Refresh balances</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.assetList}>
      {balances.map(line => {
        const assetKey =
          line.asset.kind === 'native'
            ? 'XLM'
            : `${line.asset.code}:${line.asset.issuer}`;
        const badge = line.asset.kind === 'native' ? 'XLM' : line.asset.code.slice(0, 3);

        return (
          <Pressable
            accessibilityLabel={`${line.asset.code} balance ${line.balance}`}
            accessibilityRole="button"
            key={assetKey}
            onPress={() => onOpenAsset(line.asset)}
            style={({pressed}) => [styles.assetRow, pressed ? styles.pressed : undefined]}>
            <View style={styles.assetBadge}>
              <Text numberOfLines={1} style={styles.assetBadgeText}>{badge}</Text>
            </View>

            <View style={styles.assetIdentity}>
              <Text style={styles.assetCode}>{line.asset.code}</Text>
              <Text numberOfLines={1} style={styles.assetIssuer}>
                {line.asset.kind === 'credit'
                  ? maskAddress(line.asset.issuer)
                  : 'Stellar native asset'}
              </Text>
            </View>

            <View style={styles.assetBalanceBlock}>
              <Text selectable style={styles.assetBalance}>{line.balance}</Text>
              <Text style={styles.assetSymbol}>{line.asset.code}</Text>
            </View>
          </Pressable>
        );
      })}

      {hiddenLiquidityPoolShareCount > 0 ? (
        <Text style={styles.hiddenAssetsText}>
          {hiddenLiquidityPoolShareCount} liquidity-pool position(s) are not shown by
          the current Home balance contract.
        </Text>
      ) : null}

      <Pressable
        accessibilityRole="button"
        onPress={onRefresh}
        style={({pressed}) => [styles.refreshLink, pressed ? styles.pressed : undefined]}>
        <Text style={styles.refreshText}>Refresh balances</Text>
      </Pressable>
    </View>
  );
}
