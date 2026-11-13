import React, { useEffect, useRef, useState } from 'react';
import { AppState, Text, View } from 'react-native';
import {
  changeWalletPassphrase,
  type RecoveryManagementDependencies,
} from '@capabilities/application-security/recoveryManagement';
import { Button, Screen } from '@ui/components';
import { PassphraseInput, type PassphraseInputHandle } from '@ui/components/PassphraseInput';
import { useThemedStyles } from '@ui/theme';
import { useLocalization } from '../../../locale';
import { createStyles } from './styles';

export function ChangePassphraseScreen({
  dependencies,
  active,
  onBack,
  onChanged,
}: Readonly<{
  dependencies: RecoveryManagementDependencies;
  active: boolean;
  onBack(): void;
  onChanged(): void;
}>) {
  const { t } = useLocalization();
  const styles = useThemedStyles(createStyles);
  const current = useRef<PassphraseInputHandle>(null);
  const next = useRef<PassphraseInputHandle>(null);
  const confirmation = useRef<PassphraseInputHandle>(null);
  const request = useRef<AbortController | undefined>(undefined);
  const foreground = useRef(true);
  const [presence, setPresence] = useState([false, false, false]);
  const [status, setStatus] = useState<'idle' | 'busy' | 'error'>('idle');
  const clear = (resetState = true) => {
    request.current?.abort();
    request.current = undefined;
    current.current?.clear();
    next.current?.clear();
    confirmation.current?.clear();
    if (resetState) {
      setPresence([false, false, false]);
      setStatus('idle');
    }
  };
  useEffect(() => {
    if (!active) clear();
    const subscription = AppState.addEventListener('change', state => {
      foreground.current = state === 'active';
      if (!foreground.current) clear();
    });
    return () => {
      clear(false);
      subscription.remove();
    };
  }, [active, dependencies]);
  const change = async () => {
    if (!active || !foreground.current || request.current) return;
    const currentPassphrase = current.current?.consume() ?? '';
    const newPassphrase = next.current?.consume() ?? '';
    const confirm = confirmation.current?.consume() ?? '';
    const owner = new AbortController();
    request.current = owner;
    setStatus('busy');
    try {
      await changeWalletPassphrase(dependencies, {
        currentPassphrase,
        newPassphrase,
        confirmation: confirm,
        signal: owner.signal,
      });
      if (!owner.signal.aborted) onChanged();
    } catch {
      if (!owner.signal.aborted) setStatus('error');
    } finally {
      if (request.current === owner) {
        request.current = undefined;
        if (!owner.signal.aborted) setStatus(s => (s === 'busy' ? 'idle' : s));
      }
    }
  };
  return (
    <Screen>
      <View style={styles.content}>
        <Text accessibilityRole="header" style={styles.title}>
          {t('recovery.change')}
        </Text>
        <Text style={styles.body}>{t('recovery.changeNote')}</Text>
        {[
          { ref: current, label: 'recovery.current' },
          { ref: next, label: 'recovery.new' },
          { ref: confirmation, label: 'recovery.confirm' },
        ].map((field, index) => (
          <PassphraseInput
            key={field.label}
            ref={field.ref}
            label={t(field.label)}
            hint={t('recovery.fresh')}
            disabled={status === 'busy'}
            style={styles.input}
            onPresenceChange={value => setPresence(previous => previous.map((p, i) => (i === index ? value : p)))}
          />
        ))}
        {status === 'error' ? (
          <Text accessibilityRole="alert" style={styles.error}>
            {t('recovery.changeError')}
          </Text>
        ) : null}
        <Button label={t('recovery.change')} disabled={status === 'busy' || presence.some(p => !p)} onPress={change} />
        <Button
          label={t('common.cancel')}
          onPress={() => {
            clear();
            onBack();
          }}
          variant="secondary"
        />
      </View>
    </Screen>
  );
}
