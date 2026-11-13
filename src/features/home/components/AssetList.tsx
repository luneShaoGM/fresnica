import React from 'react';
import { TokenAssetIcon } from '../../assets/TokenAssetIcon';
import { useTokenIconContext } from '../../assets/tokenIconContext';
import { Image, Pressable, Text, useWindowDimensions, View } from 'react-native';

import type { BalanceLine } from '../../../capabilities/balance/types';
import type { NativeBalanceBreakdown } from '../../../capabilities/balance/nativeBalanceBreakdown';
import { useAppTheme, useThemedStyles } from '@ui/theme';
import { SmallLock } from '@ui/components/SmallIcons';
import { maskAddress } from '../homeViewModel';
import { createStyles } from '../styles';
import { formatHomeAmount } from '../formatHomeAmount';

const xlmSymbol = require('../../../ui/assets/token/xlmSymbol.png');

type Props = Readonly<{
  balances: readonly BalanceLine[];
  formatAmount?: (value: string) => string;
  hiddenLiquidityPoolShareCount: number;
  onOpenAsset: (asset: BalanceLine['asset']) => void;
}>;

export function AssetList({
  balances,
  hiddenLiquidityPoolShareCount,
  onOpenAsset,
  formatAmount = formatHomeAmount,
}: Props) {
  const styles = useThemedStyles(createStyles);
  const largeText = useWindowDimensions().fontScale > 1.5;
  const { service, snapshot } = useTokenIconContext();
  const issued = balances.filter(line => line.asset.kind === 'credit');
  const hiddenPoolNotice =
    hiddenLiquidityPoolShareCount > 0 ? (
      <Text style={styles.hiddenAssetsText}>
        {hiddenLiquidityPoolShareCount} liquidity-pool position(s) are not shown by the current Home balance contract.
      </Text>
    ) : null;

  if (issued.length === 0) {
    return (
      <View style={styles.stateBox}>
        <Text style={styles.stateText}>No other assets.</Text>
        {hiddenPoolNotice}
      </View>
    );
  }

  return (
    <View>
      {issued.map(line => {
        const assetKey = line.asset.kind === 'native' ? 'XLM' : `${line.asset.code}:${line.asset.issuer}`;

        return (
          <Pressable
            accessibilityLabel={`${line.asset.code} ${line.asset.kind === 'credit' ? line.asset.issuer : ''} balance ${line.balance}`}
            accessibilityRole="button"
            key={assetKey}
            onPress={() => onOpenAsset(line.asset)}
            style={({ pressed }) => [
              styles.assetRow,
              largeText ? styles.assetRowLargeText : undefined,
              pressed ? styles.pressed : undefined,
            ]}
          >
            <View style={styles.assetBadge}>
              <TokenAssetIcon asset={line.asset} size={35} resizeMode="cover" />
            </View>

            <View style={[styles.assetIdentity, largeText ? styles.assetIdentityLargeText : undefined]}>
              <Text numberOfLines={largeText ? undefined : 1} ellipsizeMode="middle" style={styles.assetCode}>
                {line.asset.code}
              </Text>
              <Text numberOfLines={1} style={styles.assetIssuer}>
                {line.asset.kind === 'credit'
                  ? (snapshot.enabled ? service?.readDomain(line.asset) : undefined) || maskAddress(line.asset.issuer)
                  : 'Stellar native asset'}
              </Text>
            </View>

            <View style={[styles.assetBalanceBlock, largeText ? styles.assetBalanceLargeText : undefined]}>
              <View style={styles.assetAmountRow}>
                <View style={styles.assetSmallIcon}>
                  <TokenAssetIcon asset={line.asset} small size={12} />
                </View>
                <Text
                  numberOfLines={largeText ? undefined : 1}
                  ellipsizeMode="tail"
                  selectable
                  style={styles.assetBalance}
                >
                  {formatAmount(line.balance)}
                </Text>
              </View>
            </View>
          </Pressable>
        );
      })}

      {hiddenPoolNotice}
    </View>
  );
}

// Separate from the independently scrolling issued-asset list. Native XLM is
// never reorderable or filtered out and can show trustworthy reserve metadata.
export function PinnedNativeAssetRow({
  line,
  breakdown,
  showReserve = true,
  formatAmount = formatHomeAmount,
  onOpenAsset,
  t,
}: Readonly<{
  line: BalanceLine;
  breakdown?: NativeBalanceBreakdown;
  showReserve?: boolean;
  formatAmount?: (value: string) => string;
  onOpenAsset: (asset: BalanceLine['asset']) => void;
  t: (key: string) => string;
}>) {
  const styles = useThemedStyles(createStyles);
  const theme = useAppTheme();
  const largeText = useWindowDimensions().fontScale > 1.5;
  if (line.asset.kind !== 'native') return null;
  return (
    <View testID="home-xlm-fixed" style={styles.pinnedNative}>
      <Pressable
        accessibilityLabel={
          'XLM ' +
          t(breakdown ? 'home.asset.available' : 'home.asset.accountBalance') +
          ' ' +
          (breakdown?.available ?? line.balance)
        }
        accessibilityRole="button"
        onPress={() => onOpenAsset(line.asset)}
        style={[styles.assetRow, styles.nativeAssetRow, largeText ? styles.assetRowLargeText : undefined]}
      >
        <View style={styles.assetBadge}>
          <TokenAssetIcon asset={line.asset} size={35} resizeMode="cover" />
        </View>
        <View style={[styles.assetIdentity, largeText ? styles.assetIdentityLargeText : undefined]}>
          <Text numberOfLines={1} style={styles.nativeAssetCode}>
            XLM
          </Text>
          <Text numberOfLines={largeText ? undefined : 1} style={styles.assetIssuer}>
            {t(breakdown ? 'home.asset.available' : 'home.asset.accountBalance')}
          </Text>
        </View>
        <View style={[styles.assetBalanceBlock, largeText ? styles.assetBalanceLargeText : undefined]}>
          <View style={styles.assetAmountRow}>
            <Image accessible={false} source={xlmSymbol} resizeMode="contain" style={styles.nativeAmountSymbol} />
            <Text
              numberOfLines={largeText ? undefined : 1}
              ellipsizeMode="tail"
              selectable
              style={styles.nativeAssetBalance}
            >
              {formatAmount(breakdown?.available ?? line.balance)}
            </Text>
          </View>
        </View>
      </Pressable>
      {showReserve ? (
        <View
          accessible
          accessibilityLabel={`${t('home.asset.reserved')} ${breakdown?.reserved ?? '—'} XLM`}
          style={styles.nativeBreakdownRow}
        >
          <View style={styles.nativeReserveLock}>
            <SmallLock color={theme.colors.textSecondary} />
          </View>
          <Text style={styles.nativeBreakdownText}>{t('home.asset.reserved')}</Text>
          <View style={styles.nativeReserveAmount}>
            <Image accessible={false} source={xlmSymbol} resizeMode="contain" style={styles.nativeReserveSymbol} />
            <Text numberOfLines={largeText ? undefined : 1} ellipsizeMode="tail" style={styles.nativeBreakdownValue}>
              {breakdown ? formatAmount(breakdown.reserved) : '—'}
            </Text>
          </View>
        </View>
      ) : null}
    </View>
  );
}
