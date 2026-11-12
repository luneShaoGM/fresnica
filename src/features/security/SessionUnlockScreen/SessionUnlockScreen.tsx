import React, { useEffect, useRef, useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import { Screen, Button } from '@ui/components';
import { useThemedStyles } from '@ui/theme';
import { useLocalization } from '../../../locale';
import { createStyles } from './styles';

type Props = Readonly<{
  unlock: (passphrase: string) => Promise<void>;
  cancel: () => void;
  canUseBiometrics: () => Promise<boolean>;
  unlockWithBiometrics: (reason: string, cancelLabel: string) => Promise<void>;
}>;
export function SessionUnlockScreen({ unlock, cancel, canUseBiometrics, unlockWithBiometrics }: Props) {
  const { t } = useLocalization();
  const styles = useThemedStyles(createStyles);
  const credential = useRef('');
  const field = useRef<React.ComponentRef<typeof TextInput>>(null);
  const live = useRef(true);
  const flight = useRef(false);
  const [biometrics, setBiometrics] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    live.current = true;
    const mountedField = field.current;
    return () => {
      live.current = false;
      credential.current = '';
      mountedField?.clear();
      cancel();
    };
  }, [cancel]);
  useEffect(() => {
    let current = true;
    void canUseBiometrics()
      .then(available => {
        if (!current) return;
        setBiometrics(available);
      })
      .catch(() => undefined);
    return () => {
      current = false;
    };
  }, [canUseBiometrics]);
  async function submitBiometrics() {
    if (flight.current) return;
    flight.current = true;
    setBusy(true);
    setFailed(false);
    credential.current = '';
    field.current?.clear();
    try {
      await unlockWithBiometrics(t('session.biometricReason'), t('session.usePassphrase'));
    } catch {
      if (live.current) setFailed(true);
    } finally {
      flight.current = false;
      if (live.current) setBusy(false);
    }
  }
  async function submit() {
    if (flight.current) return;
    flight.current = true;
    setBusy(true);
    setFailed(false);
    const value = credential.current;
    credential.current = '';
    field.current?.clear();
    try {
      await unlock(value);
    } catch {
      if (live.current) setFailed(true);
    } finally {
      flight.current = false;
      if (live.current) setBusy(false);
    }
  }
  return (
    <Screen>
      <View style={styles.content}>
        <Text accessibilityRole="header" style={styles.title}>
          {t('session.locked')}
        </Text>
        <Text style={styles.body}>{t('session.explanation')}</Text>
        {biometrics ? (
          <Button label={t('session.biometricUnlock')} disabled={busy} onPress={() => void submitBiometrics()} />
        ) : null}
        <View>
          <Text style={styles.body}>{t('session.passphrase')}</Text>
          <TextInput
            ref={field}
            style={styles.input}
            accessibilityLabel={t('session.passphrase')}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            editable={!busy}
            onChangeText={value => {
              credential.current = value;
            }}
            onSubmitEditing={() => void submit()}
          />
        </View>
        {failed ? (
          <Text accessibilityRole="alert" style={styles.body}>
            {t('session.failed')}
          </Text>
        ) : null}
        <Button
          label={t(busy ? 'session.unlocking' : 'session.unlock')}
          disabled={busy}
          onPress={() => void submit()}
        />
      </View>
    </Screen>
  );
}
