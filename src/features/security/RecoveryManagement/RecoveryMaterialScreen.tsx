import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Text, TextInput, View } from 'react-native';
import {
  recoverySigners,
  revealRecoveryMaterial,
  type RecoveryManagementDependencies,
} from '@capabilities/application-security/recoveryManagement';
import type { RevealedSigningMaterial } from '@capabilities/ports/fresnicaTypes';
import { Button, Screen } from '@ui/components';
import { PassphraseInput, type PassphraseInputHandle } from '@ui/components/PassphraseInput';
import { useThemedStyles } from '@ui/theme';
import { useLocalization } from '../../../locale';
import { createStyles } from './styles';

type Clipboard = Readonly<{ copy(text: string): Promise<void>; clear(): void }>;
export function recoveryExportText(material: RevealedSigningMaterial): string {
  if (material.kind === 'secret') return material.secret;
  return [
    material.mnemonic,
    material.mnemonicPassphrase ? `Mnemonic passphrase: ${material.mnemonicPassphrase}` : '',
    material.index !== undefined ? `Derivation index: ${material.index}` : '',
    material.language ? `Language: ${material.language}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}
export function RecoveryMaterialScreen({
  dependencies,
  accountId,
  clipboard,
  active,
  onBack,
}: Readonly<{
  dependencies: RecoveryManagementDependencies;
  accountId: string;
  clipboard: Clipboard;
  active: boolean;
  onBack: () => void;
}>) {
  const { t } = useLocalization();
  const styles = useThemedStyles(createStyles);
  const input = useRef<PassphraseInputHandle>(null);
  const output = useRef<React.ElementRef<typeof TextInput>>(null);
  const plaintext = useRef('');
  const request = useRef<AbortController | undefined>(undefined);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const live = useRef(active);
  live.current = active;
  const [present, setPresent] = useState(false);
  const [status, setStatus] = useState<'idle' | 'busy' | 'visible' | 'copied' | 'error'>('idle');
  const [signerId, setSignerId] = useState<string>();
  const signers = active ? recoverySigners(dependencies.repository, accountId) : [];
  const clear = useCallback(() => {
    request.current?.abort();
    request.current = undefined;
    if (timer.current) clearTimeout(timer.current);
    plaintext.current = '';
    output.current?.clear();
    input.current?.clear();
    clipboard.clear();
  }, [clipboard]);
  useEffect(() => {
    live.current = active;
    if (!active) {
      clear();
      setStatus('idle');
    }
    const subscription = AppState.addEventListener('change', next => {
      if (next !== 'active') {
        clear();
        setStatus('idle');
      }
    });
    return () => {
      live.current = false;
      clear();
      subscription.remove();
    };
  }, [active, accountId, dependencies, clear]);
  const reveal = async () => {
    if (!live.current || request.current) return;
    const passphrase = input.current?.consume();
    const target = signers.find(s => s.id === signerId) ?? signers[0];
    if (!target || !passphrase) return;
    clear();
    const owner = new AbortController();
    request.current = owner;
    setStatus('busy');
    try {
      const material = await revealRecoveryMaterial(dependencies, {
        accountId,
        signerId: target.id,
        passphrase,
        signal: owner.signal,
      });
      if (!live.current || owner.signal.aborted || request.current !== owner) return;
      plaintext.current = recoveryExportText(material);
      output.current?.setNativeProps({ text: plaintext.current });
      setStatus('visible');
      timer.current = setTimeout(() => {
        clear();
        if (live.current) setStatus('idle');
      }, 60_000);
    } catch {
      if (live.current && !owner.signal.aborted) setStatus('error');
    } finally {
      if (request.current === owner) request.current = undefined;
    }
  };
  const copy = async () => {
    if (!live.current || !plaintext.current) return;
    try {
      await clipboard.copy(plaintext.current);
      if (live.current && plaintext.current) setStatus('copied');
      else clipboard.clear();
    } catch {
      if (live.current) setStatus('error');
    }
  };
  return (
    <Screen>
      <View style={styles.content}>
        <Text accessibilityRole="header" style={styles.title}>
          {t('recovery.title')}
        </Text>
        <Text style={styles.body}>{t('recovery.warning')}</Text>
        {signers.length === 0 ? (
          <Text style={styles.body}>{t('recovery.unavailable')}</Text>
        ) : (
          <>
            {signers.length > 1
              ? signers.map(s => (
                  <Button
                    key={s.id}
                    label={`${s.id === signerId ? '✓ ' : ''}${s.publicKey}`}
                    onPress={() => {
                      clear();
                      setStatus('idle');
                      setSignerId(s.id);
                    }}
                    variant="secondary"
                  />
                ))
              : null}
            <PassphraseInput
              ref={input}
              label={t('recovery.current')}
              hint={t('recovery.fresh')}
              disabled={status === 'busy'}
              style={styles.input}
              onPresenceChange={setPresent}
            />
            <Button label={t('recovery.reveal')} disabled={!present || status === 'busy'} onPress={reveal} />
          </>
        )}
        <TextInput
          ref={output}
          accessibilityLabel={t('recovery.title')}
          defaultValue=""
          editable={false}
          multiline
          contextMenuHidden
          autoComplete="off"
          importantForAutofill="no"
          textContentType="none"
          style={styles.material}
        />
        {status === 'visible' || status === 'copied' ? (
          <Button label={t('recovery.copy')} onPress={copy} variant="secondary" />
        ) : null}
        {status === 'copied' ? (
          <Text accessibilityLiveRegion="polite" style={styles.body}>
            {t('recovery.copied')}
          </Text>
        ) : null}
        {status === 'error' ? (
          <Text accessibilityRole="alert" style={styles.error}>
            {t('recovery.error')}
          </Text>
        ) : null}
        <Button
          label={t('recovery.hide')}
          onPress={() => {
            clear();
            setStatus('idle');
          }}
          variant="secondary"
        />
        <Button
          label={t('common.back')}
          onPress={() => {
            clear();
            onBack();
          }}
          variant="ghost"
        />
      </View>
    </Screen>
  );
}
