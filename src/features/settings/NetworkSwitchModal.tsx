import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { ScrollView, Text } from 'react-native';

import type { NetworkSettings } from '@capabilities/network/createNetworkSettings';
import { isNodeAvailable, NETWORKS, type NetworkId } from '@capabilities/network/networkPreferences';
import { AppModal } from '@ui/components';
import { NativeButton } from '@ui/components/NativeButton';
import { useThemedStyles } from '@ui/theme';
import { useLocalization } from '../../locale';
import { networkSettingsError } from './NetworkManagement';
import { createStyles } from './NetworkSettingsScreen.styles';

export function NetworkSwitchModal({
  settings,
  onClose,
}: Readonly<{ settings: NetworkSettings; onClose: () => void }>) {
  const { preferences, busy, interruption } = useSyncExternalStore(settings.subscribe, settings.getSnapshot);
  const [target, setTarget] = useState<NetworkId>();
  const [error, setError] = useState<string>();
  const epoch = useRef(0);
  const { t } = useLocalization();
  const styles = useThemedStyles(createStyles);
  const cancel = () => {
    epoch.current += 1;
    settings.cancel();
    onClose();
  };
  useFocusEffect(
    useCallback(
      () => () => {
        epoch.current += 1;
        settings.cancel();
        onClose();
      },
      [settings, onClose],
    ),
  );
  const originalInterruption = useRef(interruption);
  useEffect(() => {
    if (interruption !== originalInterruption.current) onClose();
  }, [interruption, onClose]);
  const confirm = async () => {
    if (!target || busy) return;
    const owner = ++epoch.current;
    setError(undefined);
    try {
      await settings.selectNode(target, preferences.endpoints[target]);
      if (owner === epoch.current) onClose();
    } catch (failure) {
      if (owner === epoch.current) setError(networkSettingsError(failure));
    }
  };
  return (
    <AppModal visible onRequestClose={cancel} title={t(target ? 'networkManage.prompt.select' : 'settings.network')}>
      <ScrollView style={styles.dialogScroll} contentContainerStyle={styles.dialogContent}>
        {target ? (
          <>
            <Text style={styles.nodeTitle}>{t(`networkManage.name.${target}`)}</Text>
            <Text style={styles.nodeEndpoint}>{preferences.endpoints[target]}</Text>
            <NativeButton
              label={t(busy ? 'networkManage.working' : 'networkManage.confirm')}
              disabled={busy}
              onPress={confirm}
            />
          </>
        ) : (
          (Object.keys(NETWORKS) as NetworkId[])
            .filter(id => isNodeAvailable(preferences, id, preferences.endpoints[id]))
            .map(id => (
              <NativeButton
                key={id}
                label={`${t(`networkManage.name.${id}`)}${id === preferences.networkId ? ' ✓' : ''}`}
                disabled={busy}
                variant="secondary"
                onPress={() => (id === preferences.networkId ? cancel() : setTarget(id))}
              />
            ))
        )}
        {error ? (
          <Text accessibilityRole="alert" style={styles.noticeText}>
            {t(error)}
          </Text>
        ) : null}
        <NativeButton label={t('networkManage.cancel')} onPress={cancel} variant="quiet" />
      </ScrollView>
    </AppModal>
  );
}
