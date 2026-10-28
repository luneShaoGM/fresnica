import React, { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Text, TextInput, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import type { NetworkSettings } from '@capabilities/network/createNetworkSettings';
import { isNodeAvailable, NETWORKS, type NetworkId } from '@capabilities/network/networkPreferences';
import { Field } from '@ui/components';
import { NativeButton } from '@ui/components/NativeButton';
import { useThemedStyles } from '@ui/theme';
import { useLocalization } from '../../locale';
import { createStyles } from './NetworkSettingsScreen.styles';

type Prompt =
  | { kind: 'enable' | 'disable' }
  | { kind: 'add'; id: NetworkId }
  | { kind: 'select' | 'remove'; id: NetworkId; endpoint: string };
const safeErrors = new Set([
  'protected-signer-required',
  'authorization-context-changed',
  'operation-cancelled',
  'developer-mode-required',
  'duplicate-node',
  'node-limit',
  'wrong-network',
  'node-unavailable',
  'built-in-node',
  'network-session-busy',
  'pending-backup',
  'pending-submission',
  'invalid-endpoint',
]);
export function networkSettingsError(error: unknown): string {
  return error instanceof Error && safeErrors.has(error.message)
    ? `networkManage.error.${error.message}`
    : 'networkManage.error.failed';
}

export function NetworkManagement({ settings }: Readonly<{ settings: NetworkSettings }>) {
  const snapshot = useSyncExternalStore(settings.subscribe, settings.getSnapshot);
  const { preferences, busy } = snapshot;
  const { t } = useLocalization();
  const styles = useThemedStyles(createStyles);
  const [prompt, setPrompt] = useState<Prompt>();
  const [endpoint, setEndpoint] = useState('');
  const [error, setError] = useState<string>();
  const credential = useRef('');
  const input = useRef<React.ComponentRef<typeof TextInput>>(null);
  const mounted = useRef(true);
  const epoch = useRef(0);
  const clear = useCallback(() => {
    credential.current = '';
    input.current?.clear();
  }, []);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      epoch.current += 1;
      clear();
    };
  }, [clear]);
  useEffect(() => {
    epoch.current += 1;
    clear();
    setPrompt(undefined);
    setEndpoint('');
  }, [snapshot.interruption, clear]);
  useFocusEffect(
    useCallback(
      () => () => {
        epoch.current += 1;
        clear();
        settings.cancel();
      },
      [clear, settings],
    ),
  );
  const cancel = () => {
    epoch.current += 1;
    clear();
    settings.cancel();
    setPrompt(undefined);
    setEndpoint('');
    setError(undefined);
  };
  const open = (next: Prompt) => {
    epoch.current += 1;
    clear();
    setError(undefined);
    setEndpoint('');
    setPrompt(next);
  };
  const run = async (action: () => Promise<unknown>) => {
    const owner = ++epoch.current;
    setError(undefined);
    try {
      await action();
      if (mounted.current && owner === epoch.current) {
        setPrompt(undefined);
        setEndpoint('');
      }
    } catch (failure) {
      if (mounted.current && owner === epoch.current) setError(networkSettingsError(failure));
    } finally {
      if (owner === epoch.current) clear();
    }
  };
  const confirm = async () => {
    if (!prompt || busy) return;
    const passphrase = credential.current;
    clear();
    await run(() => {
      switch (prompt.kind) {
        case 'enable':
          return settings.enableDeveloperMode(passphrase);
        case 'disable':
          return settings.disableDeveloperMode();
        case 'add':
          return settings.addNode(prompt.id, endpoint);
        case 'select':
          return settings.selectNode(prompt.id, prompt.endpoint);
        case 'remove':
          return settings.removeNode(prompt.id, prompt.endpoint);
      }
    });
  };
  return (
    <View style={styles.nodeSection} testID="network-management">
      <Text style={styles.nodeTitle}>{t('networkManage.title')}</Text>
      <Text style={styles.noticeText}>
        {t(preferences.selectionConfirmed ? 'networkManage.partitionNotice' : 'networkManage.initialChoice')}
      </Text>
      {preferences.retainedTestnet ? <Text style={styles.noticeText}>{t('networkManage.retainedTestnet')}</Text> : null}
      <Text style={styles.nodeStatus}>
        {t(preferences.developerMode ? 'networkManage.developerOn' : 'networkManage.developerOff')}
      </Text>
      <NativeButton
        label={t(preferences.developerMode ? 'networkManage.disable' : 'networkManage.enable')}
        disabled={busy}
        onPress={() => open({ kind: preferences.developerMode ? 'disable' : 'enable' })}
        size="sm"
        variant="quiet"
      />
      {(Object.keys(NETWORKS) as NetworkId[])
        .filter(id => isNodeAvailable(preferences, id, NETWORKS[id].horizonUrl))
        .map(id => (
          <View key={id} style={styles.nodeGroup}>
            <Text style={styles.nodeTitle}>
              {t(`networkManage.name.${id}`)}
              {preferences.networkId === id ? ` · ${t('networkManage.currentNetwork')}` : ''}
            </Text>
            {[NETWORKS[id].horizonUrl, ...(preferences.developerMode ? preferences.customNodes[id] : [])].map(node => {
              const selected = preferences.endpoints[id] === node;
              const health = snapshot.tests[JSON.stringify([id, node])];
              return (
                <View key={node} style={styles.nodeGroup}>
                  <Text selectable style={styles.nodeEndpoint}>
                    {node}
                  </Text>
                  {selected ? <Text style={styles.noticeText}>{t('networkManage.defaultNode')}</Text> : null}
                  {health ? (
                    <Text accessibilityLiveRegion="polite" style={styles.noticeText}>
                      {t(`networkManage.test.${health.status}`)} · {new Date(health.checkedAt).toLocaleTimeString()}
                    </Text>
                  ) : null}
                  <View style={styles.nodeActions}>
                    <NativeButton
                      label={t('networkManage.test')}
                      disabled={busy}
                      onPress={() => run(() => settings.testNode(id, node))}
                      size="sm"
                      variant="quiet"
                    />
                    {!preferences.selectionConfirmed || !selected || preferences.networkId !== id ? (
                      <NativeButton
                        label={t('networkManage.select')}
                        disabled={busy}
                        onPress={() => open({ kind: 'select', id, endpoint: node })}
                        size="sm"
                        variant="quiet"
                      />
                    ) : null}
                    {node !== NETWORKS[id].horizonUrl ? (
                      <NativeButton
                        label={t('networkManage.remove')}
                        disabled={busy}
                        onPress={() => open({ kind: 'remove', id, endpoint: node })}
                        size="sm"
                        variant="quiet"
                      />
                    ) : null}
                  </View>
                </View>
              );
            })}
            {preferences.developerMode ? (
              <NativeButton
                label={t('networkManage.add')}
                disabled={busy}
                onPress={() => open({ kind: 'add', id })}
                size="sm"
                variant="quiet"
              />
            ) : null}
          </View>
        ))}
      {prompt ? (
        <View style={styles.nodeGroup}>
          <Text style={styles.nodeTitle}>{t(`networkManage.prompt.${prompt.kind}`)}</Text>
          {prompt.kind === 'enable' ? (
            <Field
              ref={input}
              label={t('networkManage.passphrase')}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              editable={!busy}
              onChangeText={text => {
                credential.current = text;
              }}
            />
          ) : null}
          {prompt.kind === 'add' ? (
            <Field
              label={t('networkManage.endpoint')}
              value={endpoint}
              onChangeText={setEndpoint}
              keyboardType="url"
              autoCapitalize="none"
              autoCorrect={false}
              editable={!busy}
            />
          ) : null}
          {'endpoint' in prompt ? (
            <Text selectable style={styles.nodeEndpoint}>
              {prompt.endpoint}
            </Text>
          ) : null}
          <NativeButton
            label={t(busy ? 'networkManage.working' : 'networkManage.confirm')}
            disabled={busy}
            onPress={confirm}
            size="sm"
          />
          <NativeButton label={t('networkManage.cancel')} onPress={cancel} size="sm" variant="quiet" />
        </View>
      ) : null}
      {error ? (
        <Text accessibilityRole="alert" style={styles.noticeText}>
          {t(error)}
        </Text>
      ) : null}
    </View>
  );
}
