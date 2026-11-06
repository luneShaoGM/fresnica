import React from 'react';
import { TokenAssetIcon } from '../../assets/TokenAssetIcon';
import { Pressable, Text, View } from 'react-native';

import type { BalanceLine } from '../../../capabilities/balance/types';
import type { NativeBalanceBreakdown } from '../../../capabilities/balance/nativeBalanceBreakdown';
import { useThemedStyles } from '@ui/theme';
import { maskAddress } from '../homeViewModel';
import { createStyles } from '../styles';

type Props = Readonly<{
  balances: readonly BalanceLine[];
  hiddenLiquidityPoolShareCount: number;
  onRefresh: () => void;
  onOpenAsset: (asset: BalanceLine['asset']) => void;
}>;

export function AssetList({ balances, hiddenLiquidityPoolShareCount, onRefresh, onOpenAsset }: Props) {
  const styles = useThemedStyles(createStyles);
  const issued = balances.filter(line => line.asset.kind === 'credit');
  if (issued.length === 0) {
    return (
      <View style={styles.stateBox}>
        <Text style={styles.stateText}>No other assets.</Text>
        <Pressable
          accessibilityRole="button"
          onPress={onRefresh}
          style={({ pressed }) => [styles.retryButton, pressed ? styles.pressed : undefined]}
        >
          <Text style={styles.retryText}>Refresh balances</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.assetList}>
      {issued.map(line => {
        const assetKey = line.asset.kind === 'native' ? 'XLM' : `${line.asset.code}:${line.asset.issuer}`;

        return (
          <Pressable
            accessibilityLabel={`${line.asset.code} balance ${line.balance}`}
            accessibilityRole="button"
            key={assetKey}
            onPress={() => onOpenAsset(line.asset)}
            style={({ pressed }) => [styles.assetRow, pressed ? styles.pressed : undefined]}
          >
            <View style={styles.assetBadge}>
              <TokenAssetIcon asset={line.asset} />
            </View>

            <View style={styles.assetIdentity}>
              <Text style={styles.assetCode}>{line.asset.code}</Text>
              <Text numberOfLines={1} style={styles.assetIssuer}>
                {line.asset.kind === 'credit' ? maskAddress(line.asset.issuer) : 'Stellar native asset'}
              </Text>
            </View>

            <View style={styles.assetBalanceBlock}>
              <Text selectable style={styles.assetBalance}>
                {line.balance}
              </Text>
              <Text style={styles.assetSymbol}>{line.asset.code}</Text>
            </View>
          </Pressable>
        );
      })}

      {hiddenLiquidityPoolShareCount > 0 ? (
        <Text style={styles.hiddenAssetsText}>
          {hiddenLiquidityPoolShareCount} liquidity-pool position(s) are not shown by the current Home balance contract.
        </Text>
      ) : null}

      <Pressable
        accessibilityRole="button"
        onPress={onRefresh}
        style={({ pressed }) => [styles.refreshLink, pressed ? styles.pressed : undefined]}
      >
        <Text style={styles.refreshText}>Refresh balances</Text>
      </Pressable>
    </View>
  );
}

// Separate from the independently scrolling issued-asset list. Native XLM is
// never reorderable or filtered out and can show trustworthy reserve metadata.
export function PinnedNativeAssetRow({
  line,
  breakdown,
  onOpenAsset,
  t,
}: Readonly<{
  line: BalanceLine;
  breakdown?: NativeBalanceBreakdown;
  onOpenAsset: (asset: BalanceLine['asset']) => void;
  t: (key: string) => string;
}>) {
  const styles = useThemedStyles(createStyles);
  if (line.asset.kind !== 'native') return null;
  return (
    <View testID="home-xlm-fixed" style={styles.pinnedNative}>
      <Pressable
        accessibilityLabel={'XLM balance ' + line.balance}
        accessibilityRole="button"
        onPress={() => onOpenAsset(line.asset)}
        style={styles.assetRow}
      >
        <View style={styles.assetBadge}>
          <TokenAssetIcon asset={line.asset} />
        </View>
        <View style={styles.assetIdentity}>
          <Text style={styles.assetCode}>XLM</Text>
          <Text style={styles.assetIssuer}>{t('home.asset.nativeExplanation')}</Text>
        </View>
        <View style={styles.assetBalanceBlock}>
          <Text selectable style={styles.assetBalance}>
            {line.balance}
          </Text>
          <Text style={styles.assetSymbol}>XLM</Text>
        </View>
      </Pressable>
      <View style={styles.nativeBreakdownRow}>
        <Text style={styles.nativeBreakdownText}>
          {t('home.asset.available')}: {breakdown?.available ?? '—'}
        </Text>
        <Text style={styles.nativeBreakdownText}>
          {t('home.asset.reserved')}: {breakdown?.reserved ?? '—'}
        </Text>
      </View>
    </View>
  );
}
