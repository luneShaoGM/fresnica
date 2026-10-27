import React, { useSyncExternalStore } from 'react';
import { Text, View } from 'react-native';

import type { NodeHealthMonitor, NodeHealthSnapshot } from '@capabilities/network/NodeHealthMonitor';
import { NativeButton } from '@ui/components/NativeButton';
import { useThemedStyles } from '@ui/theme';

import { useLocalization } from '../../locale';
import { createStyles } from './NetworkSettingsScreen.styles';

export function NetworkNodeHealth({ monitor }: Readonly<{ monitor: NodeHealthMonitor }>) {
  const snapshot = useSyncExternalStore(monitor.subscribe, monitor.getSnapshot);
  return <NetworkNodeHealthContent snapshot={snapshot} onRetry={monitor.retry} />;
}

export function NetworkNodeHealthContent({
  snapshot,
  onRetry,
}: Readonly<{ snapshot: NodeHealthSnapshot; onRetry: () => void }>) {
  const { t } = useLocalization();
  const styles = useThemedStyles(createStyles);
  const retryable = snapshot.phase === 'cooldown' || snapshot.phase === 'wrong-network';
  const failure = snapshot.failure;
  const failureKey =
    failure === 'timeout' || failure === 'rate-limited' || failure === 'unavailable' || failure === 'protocol'
      ? `networkHealth.failure.${failure}`
      : undefined;

  return (
    <View style={styles.nodeSection} testID="network-node-health">
      <Text style={styles.nodeTitle}>{t('networkHealth.currentNode')}</Text>
      <Text selectable style={styles.nodeEndpoint}>
        {snapshot.endpoint}
      </Text>
      <Text
        accessibilityLiveRegion="polite"
        style={[
          styles.nodeStatus,
          snapshot.phase === 'healthy' ? styles.nodeHealthy : undefined,
          retryable ? styles.nodeWarning : undefined,
        ]}
      >
        {t(`networkHealth.phase.${snapshot.phase}`)}
      </Text>
      {snapshot.phase === 'cooldown' && failureKey ? <Text style={styles.noticeText}>{t(failureKey)}</Text> : null}
      <Text style={styles.noticeText}>{t('networkHealth.readScope')}</Text>
      {retryable ? (
        <>
          <Text style={styles.noticeText}>{t('networkHealth.retryPolicy')}</Text>
          <NativeButton label={t('networkHealth.retry')} onPress={onRetry} size="sm" variant="quiet" />
        </>
      ) : null}
    </View>
  );
}
