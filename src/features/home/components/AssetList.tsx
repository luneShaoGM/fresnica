import React, { useState } from 'react';
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
  currency,
  availableFiat,
  reserveFiat,
  quoteExpiresAt,
  formatFiat = value => value,
}: Readonly<{
  line: BalanceLine;
  breakdown?: NativeBalanceBreakdown;
  showReserve?: boolean;
  formatAmount?: (value: string) => string;
  onOpenAsset: (asset: BalanceLine['asset']) => void;
  t: (key: string) => string;
  currency?: string;
  availableFiat?: string;
  reserveFiat?: string;
  quoteExpiresAt?: number;
  formatFiat?: (value: string) => string;
}>) {
  const styles = useThemedStyles(createStyles);
  const theme = useAppTheme();
  const largeText = useWindowDimensions().fontScale > 1.5;
  const [showFiat, setShowFiat] = useState(false);
  const quoteFresh = quoteExpiresAt === undefined || Date.now() < quoteExpiresAt;
  const canToggle = availableFiat !== undefined && currency !== undefined && quoteFresh;
  const fiatVisible = showFiat && canToggle;
  const toggleBalance = () => {
    if (quoteExpiresAt !== undefined && Date.now() >= quoteExpiresAt) {
      setShowFiat(false);
      return;
    }
    if (canToggle) setShowFiat(value => !value);
  };
  if (line.asset.kind !== 'native') return null;
  return (
    <View testID="home-xlm-fixed" style={styles.pinnedNative}>
      <View style={[styles.assetRow, styles.nativeAssetRow, largeText ? styles.assetRowLargeText : undefined]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('home.asset.openNativeDetails')}
          onPress={() => onOpenAsset(line.asset)}
          style={styles.nativeIdentityButton}
        >
          <View style={styles.assetBadge}>
            <TokenAssetIcon asset={line.asset} size={35} resizeMode="cover" />
          </View>
          <View style={styles.assetIdentity}>
            <Text numberOfLines={1} style={styles.nativeAssetCode}>
              XLM
            </Text>
            <Text numberOfLines={largeText ? undefined : 1} style={styles.assetIssuer}>
              {t(breakdown ? 'home.asset.available' : 'home.asset.accountBalance')}
            </Text>
          </View>
        </Pressable>
        <Pressable
          testID="home-xlm-amount-toggle"
          accessibilityRole="button"
          accessibilityLabel={
            fiatVisible
              ? `${t('preferences.estimate')}: ≈ ${formatFiat(availableFiat!)} ${currency}`
              : `${breakdown?.available ?? line.balance} XLM`
          }
          accessibilityHint={t(canToggle ? 'home.asset.toggleFiat' : 'home.asset.fiatUnavailable')}
          accessibilityState={{ disabled: !canToggle }}
          disabled={!canToggle}
          onPress={toggleBalance}
          style={[
            styles.assetBalanceBlock,
            styles.nativeAmountButton,
            largeText ? styles.assetBalanceLargeText : undefined,
          ]}
        >
          <View style={styles.assetAmountRow}>
            {fiatVisible ? null : (
              <Image accessible={false} source={xlmSymbol} resizeMode="contain" style={styles.nativeAmountSymbol} />
            )}
            <Text numberOfLines={largeText ? undefined : 1} ellipsizeMode="tail" style={styles.nativeAssetBalance}>
              {fiatVisible
                ? `≈ ${formatFiat(availableFiat!)} ${currency}`
                : formatAmount(breakdown?.available ?? line.balance)}
            </Text>
          </View>
        </Pressable>
      </View>
      {showReserve ? (
        <View style={styles.nativeBreakdownRow}>
          <View
            accessible
            accessibilityLabel={`${t('home.asset.reserved')} ${breakdown?.reserved ?? '—'} XLM`}
            style={styles.nativeReserveGroup}
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
          {quoteFresh && reserveFiat !== undefined && currency ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${t('home.asset.reserved')}, ${t('preferences.estimate')}: ≈ ${formatFiat(reserveFiat)} ${currency}`}
              onPress={toggleBalance}
              disabled={!canToggle}
            >
              <Text style={styles.nativeReserveFiat}>
                ≈ {formatFiat(reserveFiat)} {currency}
              </Text>
            </Pressable>
          ) : null}
        </View>
      ) : quoteFresh && availableFiat !== undefined && currency ? (
        <Text style={styles.nativeReserveFiat}>
          ≈ {formatFiat(availableFiat)} {currency}
        </Text>
      ) : null}
    </View>
  );
}
