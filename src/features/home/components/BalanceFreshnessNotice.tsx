import React from 'react';
import { Text, View } from 'react-native';
import { NativeButton } from '@ui/components/NativeButton';
import { useThemedStyles } from '@ui/theme';
import { useLocalization } from '../../../locale';
import type { BalanceDisplayState } from '../balanceReadModel';
import { createStyles } from '../styles';

type Props = Readonly<{ state: BalanceDisplayState; onRefresh: () => void; showRefreshStatus?: boolean }>;
export function BalanceFreshnessNotice({ state, onRefresh, showRefreshStatus = true }: Props) {
  const { t, formatDate } = useLocalization();
  const styles = useThemedStyles(createStyles);
  if (state.kind !== 'ready' || !state.lastSuccessfulUpdateAt) return null;
  if (!showRefreshStatus && !state.stale && !state.refreshFailed) return null;
  const key = state.refreshFailed
    ? 'balance.cache.failed'
    : state.refreshing && showRefreshStatus
      ? 'balance.cache.refreshing'
      : state.stale
        ? 'balance.cache.stale'
        : 'balance.cache.current';
  return (
    <View style={styles.freshness}>
      <Text style={styles.stateText}>{t(key)}</Text>
      {showRefreshStatus ? (
        <Text style={styles.stateText}>
          {t('balance.cache.updated', { time: formatDate(state.lastSuccessfulUpdateAt) })}
        </Text>
      ) : null}
      {state.refreshFailed ? (
        <NativeButton label={t('balance.cache.retry')} onPress={onRefresh} size="sm" variant="secondary" />
      ) : null}
    </View>
  );
}
