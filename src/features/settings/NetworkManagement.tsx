import React, { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Pressable, ScrollView, Switch, Text, TextInput, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import type { NetworkSettings } from '@capabilities/network/createNetworkSettings';
import { isNodeAvailable, NETWORKS, type NetworkId } from '@capabilities/network/networkPreferences';
import { AppModal, Field } from '@ui/components';
import { NativeButton } from '@ui/components/NativeButton';
import { useThemedStyles } from '@ui/theme';
import { useLocalization } from '../../locale';
import { createStyles } from './NetworkSettingsScreen.styles';
import type { NodeHealthMonitor } from '@capabilities/network/NodeHealthMonitor';
import { NetworkNodeHealth } from './NetworkNodeHealth';

type Prompt =
  | { kind: 'enable-warning' }
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

export function NetworkManagement({
  settings,
  section = 'all',
  monitor,
}: Readonly<{ settings: NetworkSettings; section?: 'all' | 'developer-mode' | 'nodes'; monitor?: NodeHealthMonitor }>) {
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
        setPrompt(undefined);
        setError(undefined);
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
    if (prompt.kind === 'enable-warning') {
      open({ kind: 'enable' });
      return;
    }
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
    <View
      style={section === 'developer-mode' ? [styles.nodeSection, styles.developerSection] : styles.nodeList}
      testID="network-management"
    >
      {section === 'developer-mode' ? <Text style={styles.nodeTitle}>{t('settings.developerMode')}</Text> : null}
      {section !== 'developer-mode' ? (
        <View style={styles.listNotice}>
          <Text style={styles.noticeText}>
            {t(preferences.selectionConfirmed ? 'networkManage.partitionNotice' : 'networkManage.initialChoice')}
          </Text>
          {preferences.retainedTestnet ? (
            <Text style={styles.noticeText}>{t('networkManage.retainedTestnet')}</Text>
          ) : null}
        </View>
      ) : null}
      {section !== 'nodes' ? (
        <Text style={styles.nodeStatus}>
          {t(preferences.developerMode ? 'networkManage.developerOn' : 'networkManage.developerOff')}
        </Text>
      ) : null}
      {section !== 'nodes' ? (
        <Switch
          accessibilityLabel={t('settings.developerMode')}
          disabled={busy}
          value={preferences.developerMode}
          onValueChange={() => open({ kind: preferences.developerMode ? 'disable' : 'enable-warning' })}
        />
      ) : null}
      {section !== 'developer-mode'
        ? (Object.keys(NETWORKS) as NetworkId[])
            .filter(id => isNodeAvailable(preferences, id, NETWORKS[id].horizonUrl))
            .map(id => (
              <View key={id}>
                <View style={styles.listSectionHeader}>
                  <View
                    style={[styles.listNetworkDot, id === 'stellar-mainnet' ? styles.mainnetDot : styles.testnetDot]}
                  />
                  <Text style={[styles.nodeTitle, styles.flex]}>
                    {t(`networkManage.name.${id}`)}
                    {preferences.networkId === id ? ` · ${t('networkManage.currentNetwork')}` : ''}
                  </Text>
                  {preferences.developerMode ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={t('networkManage.add')}
                      accessibilityState={{ disabled: busy }}
                      disabled={busy}
                      onPress={() => open({ kind: 'add', id })}
                      style={styles.nodeIconButton}
                    >
                      <Text style={styles.nodeIcon}>+</Text>
                    </Pressable>
                  ) : null}
                </View>
                {[NETWORKS[id].horizonUrl, ...(preferences.developerMode ? preferences.customNodes[id] : [])].map(
                  node => {
                    const selected = preferences.endpoints[id] === node;
                    const current = preferences.networkId === id && selected && preferences.selectionConfirmed;
                    const health = snapshot.tests[JSON.stringify([id, node])];
                    return (
                      <View key={node} style={[styles.listNode, selected && styles.listSelected]}>
                        <View style={styles.listNodeRow}>
                          <Pressable
                            accessibilityRole="button"
                            accessibilityLabel={node}
                            disabled={busy}
                            accessibilityState={{ disabled: busy }}
                            onPress={() => {
                              if (!current) open({ kind: 'select', id, endpoint: node });
                            }}
                            style={[styles.listNodeIdentity, styles.flex]}
                          >
                            <Text style={styles.nodeEndpoint}>{node}</Text>
                            {selected ? <Text style={styles.noticeText}>{t('networkManage.defaultNode')}</Text> : null}
                            {current ? <Text style={styles.noticeText}>{t('networkHealth.currentNode')}</Text> : null}
                          </Pressable>
                          <Pressable
                            accessibilityRole="button"
                            accessibilityLabel={`${t('networkManage.test')}: ${node}`}
                            accessibilityState={{ disabled: busy }}
                            disabled={busy}
                            onPress={() => run(() => settings.testNode(id, node))}
                            style={styles.nodeIconButton}
                          >
                            <Text style={styles.nodeIcon}>↻</Text>
                          </Pressable>
                          {node !== NETWORKS[id].horizonUrl ? (
                            <Pressable
                              accessibilityRole="button"
                              accessibilityLabel={`${t('networkManage.remove')}: ${node}`}
                              accessibilityState={{ disabled: busy }}
                              disabled={busy}
                              onPress={() => open({ kind: 'remove', id, endpoint: node })}
                              style={styles.nodeIconButton}
                            >
                              <Text style={styles.nodeIcon}>×</Text>
                            </Pressable>
                          ) : null}
                          <Pressable
                            accessibilityRole="radio"
                            accessibilityLabel={`${t('networkManage.select')}: ${node}`}
                            accessibilityState={{ checked: selected, disabled: busy }}
                            disabled={busy}
                            onPress={() => {
                              if (!current) open({ kind: 'select', id, endpoint: node });
                            }}
                            style={styles.nodeIconButton}
                          >
                            <Text style={styles.nodeIcon}>{selected ? '●' : '○'}</Text>
                          </Pressable>
                        </View>
                        {current && monitor ? <NetworkNodeHealth monitor={monitor} compact /> : null}
                        {health ? (
                          <Text accessibilityLiveRegion="polite" style={styles.noticeText}>
                            {t(`networkManage.test.${health.status}`)} ·{' '}
                            {new Date(health.checkedAt).toLocaleTimeString()}
                          </Text>
                        ) : null}
                      </View>
                    );
                  },
                )}
              </View>
            ))
        : null}
      {prompt ? (
        <AppModal visible onRequestClose={cancel} title={t(`networkManage.prompt.${prompt.kind}`)}>
          <ScrollView
            style={styles.dialogScroll}
            contentContainerStyle={styles.dialogContent}
            keyboardShouldPersistTaps="handled"
          >
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
              label={t(
                busy
                  ? 'networkManage.working'
                  : prompt.kind === 'enable-warning'
                    ? 'settings.continue'
                    : 'networkManage.confirm',
              )}
              disabled={busy}
              onPress={confirm}
              size="sm"
            />
            <NativeButton label={t('networkManage.cancel')} onPress={cancel} size="sm" variant="quiet" />
            {error ? (
              <Text accessibilityRole="alert" style={styles.noticeText}>
                {t(error)}
              </Text>
            ) : null}
          </ScrollView>
        </AppModal>
      ) : null}
      {error && !prompt ? (
        <Text accessibilityRole="alert" style={styles.noticeText}>
          {t(error)}
        </Text>
      ) : null}
    </View>
  );
}
