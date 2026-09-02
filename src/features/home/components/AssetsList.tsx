import React from 'react';
import {Image, Text, View} from 'react-native';

import type {BalanceLine} from '../../../capabilities/balance/types';
import {StellarTouchableDebounce} from '../../../ui/components/stellar';
import {maskAddress} from '../homeViewModel';
import {styles} from '../styles';

const xlmIcon = require('../../../ui/assets/stellar/icon_xlm.png');

type Props = Readonly<{
  balances: readonly BalanceLine[];
  hiddenLiquidityPoolShareCount: number;
  onRefresh: () => void;
}>;

/**
 * M2 token-list adaptation of Stellar AssetsList.
 *
 * The current Balance capability exposes native and credit balances. Donor LP,
 * claimable-balance, filtering and category repository state stays out of this
 * component until those read contracts exist in Fresnica.
 */
export function AssetsList({
  balances,
  hiddenLiquidityPoolShareCount,
  onRefresh,
}: Props) {
  if (balances.length === 0) {
    return (
      <View style={styles.stateBox}>
        <Text style={styles.stateText}>No displayable assets.</Text>
        <StellarTouchableDebounce
          accessibilityRole="button"
          activeOpacity={0.7}
          onPress={onRefresh}
          style={styles.retryButton}>
          <Text style={styles.retryText}>Refresh balances</Text>
        </StellarTouchableDebounce>
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

        return (
          <View key={assetKey} style={styles.assetRow}>
            {line.asset.kind === 'native' ? (
              <Image resizeMode="contain" source={xlmIcon} style={styles.assetIcon} />
            ) : (
              <View style={styles.assetFallbackIcon}>
                <Text style={styles.assetFallbackText}>
                  {line.asset.code.slice(0, 1)}
                </Text>
              </View>
            )}

            <View style={styles.assetIdentity}>
              <Text style={styles.assetCode}>{line.asset.code}</Text>
              <Text numberOfLines={1} style={styles.assetIssuer}>
                {line.asset.kind === 'credit'
                  ? maskAddress(line.asset.issuer)
                  : 'Stellar native asset'}
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
      })}

      {hiddenLiquidityPoolShareCount > 0 ? (
        <Text style={styles.hiddenAssetsText}>
          {hiddenLiquidityPoolShareCount} liquidity-pool position(s) are not shown by
          the current Home balance contract.
        </Text>
      ) : null}

      <StellarTouchableDebounce
        accessibilityRole="button"
        activeOpacity={0.7}
        onPress={onRefresh}
        style={styles.refreshLink}>
        <Text style={styles.refreshText}>Refresh balances</Text>
      </StellarTouchableDebounce>
    </View>
  );
}
