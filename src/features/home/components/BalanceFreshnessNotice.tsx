import React from 'react';
import { Text, View } from 'react-native';
import { NativeButton } from '@ui/components/NativeButton';
import { useThemedStyles } from '@ui/theme';
import { useLocalization } from '../../../locale';
import type { BalanceDisplayState } from '../balanceReadModel';
import { createStyles } from '../styles';

type Props = Readonly<{ state: BalanceDisplayState; onRefresh: () => void }>;
export function BalanceFreshnessNotice({ state, onRefresh }: Props) {
  const { t, formatDate } = useLocalization();
  const styles = useThemedStyles(createStyles);
  if (state.kind !== 'ready' || !state.lastSuccessfulUpdateAt) return null;
  const key = state.refreshFailed
    ? 'balance.cache.failed'
    : state.refreshing
      ? 'balance.cache.refreshing'
      : state.stale
        ? 'balance.cache.stale'
        : 'balance.cache.current';
  return (
    <View style={styles.freshness}>
      <Text style={styles.stateText}>{t(key)}</Text>
      <Text style={styles.stateText}>
        {t('balance.cache.updated', { time: formatDate(state.lastSuccessfulUpdateAt) })}
      </Text>
      {state.refreshFailed ? (
        <NativeButton label={t('balance.cache.retry')} onPress={onRefresh} size="sm" variant="secondary" />
      ) : null}
    </View>
  );
}
