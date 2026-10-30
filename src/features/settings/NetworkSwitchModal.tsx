import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Keyboard, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';

import type { NetworkSettings } from '@capabilities/network/createNetworkSettings';
import type { NodeHealthMonitor } from '@capabilities/network/NodeHealthMonitor';
import {
  isNodeAvailable,
  NETWORKS,
  normalizeHorizonEndpoint,
  type NetworkId,
} from '@capabilities/network/networkPreferences';
import { AppModal, Field } from '@ui/components';
import { NativeButton } from '@ui/components/NativeButton';
import { useThemedStyles } from '@ui/theme';
import { useLocalization } from '../../locale';
import { networkSettingsError } from './NetworkManagement';
import { createStyles } from './NetworkSwitchModal.styles';

type Prompt = { kind: 'select' | 'remove' | 'added'; id: NetworkId; endpoint: string };

export function NetworkSwitchModal({
  settings,
  monitor,
  onClose,
}: Readonly<{
  settings: NetworkSettings;
  monitor?: NodeHealthMonitor;
  onClose: () => void;
}>) {
  const { preferences, busy, interruption, tests } = useSyncExternalStore(settings.subscribe, settings.getSnapshot);
  const [expanded, setExpanded] = useState<NetworkId>(preferences.networkId);
  const [prompt, setPrompt] = useState<Prompt>();
  const [endpointInput, setEndpointInput] = useState('');
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
  const open = (next: Prompt) => {
    Keyboard.dismiss();
    setError(undefined);
    setPrompt(next);
  };
  const run = async (action: () => Promise<unknown>, complete?: () => void) => {
    if (settings.getSnapshot().busy) return;
    const owner = ++epoch.current;
    setError(undefined);
    try {
      await action();
      if (owner === epoch.current) complete?.();
    } catch (failure) {
      if (owner === epoch.current) setError(networkSettingsError(failure));
    }
  };
  const dismissPrompt = () => {
    if (busy) cancel();
    else {
      setPrompt(undefined);
      setError(undefined);
    }
  };
  const confirm = async () => {
    if (!prompt || busy) return;
    const { id, endpoint, kind } = prompt;
    if (kind === 'remove') {
      await run(
        () => settings.removeNode(id, endpoint),
        () => setPrompt(undefined),
      );
    } else {
      await run(() => settings.selectNode(id, endpoint), onClose);
    }
  };
  const add = async (id: NetworkId) => {
    if (busy) return;
    await run(
      () => settings.addNode(id, endpointInput),
      () => {
        const endpoint = normalizeHorizonEndpoint(endpointInput);
        setEndpointInput('');
        open({ kind: 'added', id, endpoint });
      },
    );
  };
  const networks = (Object.keys(NETWORKS) as NetworkId[])
    .map(id => {
      const saved = preferences.endpoints[id];
      // A hidden custom default must not hide the policy-allowed built-in network.
      const endpoint = isNodeAvailable(preferences, id, saved) ? saved : NETWORKS[id].horizonUrl;
      return { id, endpoint };
    })
    .filter(item => isNodeAvailable(preferences, item.id, item.endpoint));

  return (
    <AppModal
      visible
      onRequestClose={prompt ? dismissPrompt : cancel}
      presentation={prompt ? 'dialog' : 'sheet'}
      title={
        prompt ? t(prompt.kind === 'added' ? 'networkSwitch.added' : `networkManage.prompt.${prompt.kind}`) : undefined
      }
    >
      {prompt ? (
        <ScrollView
          style={styles.dialog}
          contentContainerStyle={styles.dialogContent}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.name}>{t(`networkManage.name.${prompt.id}`)}</Text>
          <Text selectable style={styles.endpoint}>
            {prompt.endpoint}
          </Text>
          <NativeButton
            disabled={busy}
            onPress={confirm}
            label={t(
              busy
                ? 'networkManage.working'
                : prompt.kind === 'added'
                  ? 'networkSwitch.useNow'
                  : 'networkManage.confirm',
            )}
          />
          <NativeButton
            onPress={dismissPrompt}
            variant="quiet"
            label={t(prompt.kind === 'added' ? 'networkSwitch.notNow' : 'networkManage.cancel')}
          />
          {error ? (
            <Text accessibilityRole="alert" style={[styles.status, styles.failed]}>
              {t(error)}
            </Text>
          ) : null}
        </ScrollView>
      ) : (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.sheet}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <Text accessibilityRole="header" style={styles.title}>
              {t('networkSwitch.title')}
            </Text>
            <NativeButton label={t('networkSwitch.close')} onPress={cancel} size="sm" variant="quiet" />
          </View>
          <ScrollView
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            automaticallyAdjustKeyboardInsets
            showsVerticalScrollIndicator={false}
          >
            {networks.map(({ id, endpoint }) => {
              const current = preferences.networkId === id;
              const expandedHere = expanded === id || networks.length === 1;
              const choose = () => {
                setExpanded(id);
                setEndpointInput('');
                setError(undefined);
                if (!current) open({ kind: 'select', id, endpoint });
              };
              const nodes = [
                NETWORKS[id].horizonUrl,
                ...(preferences.developerMode ? preferences.customNodes[id] : []),
              ];
              return (
                <View key={id}>
                  {id === 'stellar-testnet' ? (
                    <Text style={styles.group}>{t('networkSwitch.testNetworks')}</Text>
                  ) : null}
                  <View style={[styles.network, expandedHere ? styles.expanded : undefined]}>
                    <View style={[styles.dot, id === 'stellar-mainnet' ? styles.mainnet : styles.testnet]} />
                    <Pressable
                      disabled={busy}
                      onPress={choose}
                      accessibilityRole="button"
                      accessibilityLabel={t(`networkManage.name.${id}`)}
                      accessibilityState={{ disabled: busy, expanded: expandedHere }}
                      style={styles.identity}
                    >
                      <Text style={styles.name}>{t(`networkManage.name.${id}`)}</Text>
                      <Text style={styles.endpoint}>{endpoint.replace(/^https:\/\//, '')}</Text>
                    </Pressable>
                    <Pressable
                      disabled={busy}
                      onPress={choose}
                      accessibilityRole="radio"
                      style={styles.action}
                      accessibilityLabel={`${t('networkSwitch.useNetwork')}: ${t(`networkManage.name.${id}`)}`}
                      accessibilityState={{ checked: current, disabled: busy }}
                    >
                      <Radio checked={current} />
                    </Pressable>
                  </View>
                  {expandedHere ? (
                    <View style={styles.endpoints}>
                      <Text style={styles.section}>
                        {t('networkSwitch.endpoints', { network: t(`networkManage.name.${id}`) })}
                      </Text>
                      {nodes.map(node => {
                        const selected = node === endpoint;
                        const active = current && selected;
                        const result = tests[JSON.stringify([id, node])];
                        const select = () => {
                          if (!active) open({ kind: 'select', id, endpoint: node });
                        };
                        return (
                          <View key={node} style={styles.node}>
                            <View style={styles.nodeTop}>
                              <Pressable
                                disabled={busy}
                                onPress={select}
                                accessibilityRole="button"
                                accessibilityLabel={node}
                                accessibilityState={{ disabled: busy }}
                                style={styles.nodeLabel}
                              >
                                <Text style={styles.endpoint}>{node}</Text>
                                {selected ? <Text style={styles.status}>{t('networkManage.defaultNode')}</Text> : null}
                              </Pressable>
                              <View style={styles.actions}>
                                <Pressable
                                  disabled={busy}
                                  onPress={() => run(() => settings.testNode(id, node))}
                                  accessibilityRole="button"
                                  accessibilityLabel={`${t('networkManage.test')}: ${node}`}
                                  accessibilityState={{ disabled: busy }}
                                  style={styles.action}
                                >
                                  <Text style={styles.glyph}>↻</Text>
                                </Pressable>
                                {node !== NETWORKS[id].horizonUrl ? (
                                  <Pressable
                                    disabled={busy}
                                    onPress={() => open({ kind: 'remove', id, endpoint: node })}
                                    accessibilityRole="button"
                                    accessibilityLabel={`${t('networkManage.remove')}: ${node}`}
                                    accessibilityState={{ disabled: busy }}
                                    style={styles.action}
                                  >
                                    <Text style={styles.glyph}>×</Text>
                                  </Pressable>
                                ) : null}
                                <Pressable
                                  disabled={busy}
                                  onPress={select}
                                  accessibilityRole="radio"
                                  accessibilityLabel={`${t('networkManage.select')}: ${node}`}
                                  accessibilityState={{ checked: selected, disabled: busy }}
                                  style={styles.action}
                                >
                                  <Radio checked={selected} />
                                </Pressable>
                              </View>
                            </View>
                            {active && monitor ? <CurrentNodeStatus monitor={monitor} /> : null}
                            {result ? (
                              <Text
                                accessibilityLiveRegion="polite"
                                style={[styles.status, result.status === 'reachable' ? styles.healthy : styles.failed]}
                              >
                                {t(`networkManage.test.${result.status}`)} ·{' '}
                                {new Date(result.checkedAt).toLocaleTimeString()}
                              </Text>
                            ) : !active || !monitor ? (
                              <Text style={styles.status}>{t('networkSwitch.notTested')}</Text>
                            ) : null}
                          </View>
                        );
                      })}
                      {preferences.developerMode ? (
                        <>
                          <Field
                            label={t('networkSwitch.addEndpoint')}
                            placeholder="https://"
                            value={endpointInput}
                            onChangeText={setEndpointInput}
                            keyboardType="url"
                            autoCapitalize="none"
                            autoCorrect={false}
                            maxLength={2048}
                            editable={!busy}
                          />
                          <NativeButton
                            label={`${t('networkManage.add')} (${t(`networkManage.name.${id}`)})`}
                            disabled={busy || !endpointInput.trim()}
                            onPress={() => add(id)}
                            size="sm"
                          />
                        </>
                      ) : (
                        <Text style={styles.status}>{t('networkManage.error.developer-mode-required')}</Text>
                      )}
                    </View>
                  ) : null}
                </View>
              );
            })}
            {error ? (
              <Text accessibilityRole="alert" style={[styles.status, styles.failed]}>
                {t(error)}
              </Text>
            ) : null}
          </ScrollView>
        </KeyboardAvoidingView>
      )}
    </AppModal>
  );
}

function Radio({ checked }: Readonly<{ checked: boolean }>) {
  const styles = useThemedStyles(createStyles);
  return (
    <View style={[styles.radio, checked ? styles.checked : undefined]}>
      {checked ? <View style={styles.radioDot} /> : null}
    </View>
  );
}
function CurrentNodeStatus({ monitor }: Readonly<{ monitor: NodeHealthMonitor }>) {
  const snapshot = useSyncExternalStore(monitor.subscribe, monitor.getSnapshot);
  const { t } = useLocalization();
  const styles = useThemedStyles(createStyles);
  return (
    <View>
      <Text
        accessibilityLiveRegion="polite"
        style={[
          styles.status,
          snapshot.phase === 'healthy'
            ? styles.healthy
            : snapshot.phase === 'cooldown' || snapshot.phase === 'wrong-network'
              ? styles.failed
              : undefined,
        ]}
      >
        {t('networkHealth.currentNode')} · {t(`networkHealth.phase.${snapshot.phase}`)}
      </Text>
      {snapshot.phase === 'cooldown' || snapshot.phase === 'wrong-network' ? (
        <NativeButton label={t('networkHealth.retry')} onPress={monitor.retry} size="sm" variant="quiet" />
      ) : null}
    </View>
  );
}
