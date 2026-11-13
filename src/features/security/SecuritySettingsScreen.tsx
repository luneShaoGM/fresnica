import React, { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { AppState, Platform, Text, View } from 'react-native';
import { AppModal, Button, ListRow } from '@ui/components';
import { PassphraseInput, type PassphraseInputHandle } from '@ui/components/PassphraseInput';
import { useThemedStyles } from '@ui/theme';
import {
  DEFAULT_SECURITY_PREFERENCES,
  type SecurityPreferences,
  type SecuritySettings,
} from '@capabilities/application-security/securitySettings';
import { useLocalization } from '../../locale';
import { SettingsSubpage } from '../settings/SettingsSubpage';
import { createStyles } from './SessionUnlockScreen/styles';

const subscribeNothing = () => () => {};
const defaults = () => DEFAULT_SECURITY_PREFERENCES;
type Props = Readonly<{
  onClose(): void;
  onChangePassphrase?: () => void;
  accounts?: readonly { id: string; label: string; address: string }[];
  onOpenRecovery?: (accountId: string) => void;
  settings?: SecuritySettings;
  developerMode?: boolean;
  active?: boolean;
}>;
export function SecuritySettingsScreen({
  onClose,
  onChangePassphrase,
  accounts = [],
  onOpenRecovery,
  settings,
  developerMode = false,
  active = true,
}: Props) {
  const { t } = useLocalization();
  const styles = useThemedStyles(createStyles);
  const saved = useSyncExternalStore(settings?.subscribe ?? subscribeNothing, settings?.getSnapshot ?? defaults);
  const [patch, setPatch] = useState<Partial<SecurityPreferences>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [captureWarning, setCaptureWarning] = useState(false);
  const [present, setPresent] = useState(false);
  const input = useRef<PassphraseInputHandle>(null);
  const request = useRef<AbortController | undefined>(undefined);
  const value = { ...saved, ...patch };
  const requiresPassphrase = settings?.requiresPassphrase() === true;
  const clear = (reset: boolean) => {
    request.current?.abort();
    request.current = undefined;
    input.current?.clear();
    if (reset) {
      setBusy(false);
      setPresent(false);
      setPatch({});
      setCaptureWarning(false);
    }
  };
  useEffect(() => {
    if (!active) clear(true);
    const sub = AppState.addEventListener('change', state => {
      if (state !== 'active') clear(true);
    });
    return () => {
      clear(false);
      sub.remove();
    };
  }, [active, settings]);
  const save = async () => {
    if (!active || !settings || request.current) return;
    const owner = new AbortController();
    request.current = owner;
    const passphrase = input.current?.consume() ?? '';
    setBusy(true);
    setError(false);
    try {
      await settings.update(patch, passphrase, owner.signal);
      if (!owner.signal.aborted) setPatch({});
    } catch {
      if (!owner.signal.aborted) setError(true);
    } finally {
      if (request.current === owner) {
        request.current = undefined;
        setBusy(false);
        setPresent(false);
      }
    }
  };
  return (
    <SettingsSubpage title={t('security.policy.title')} onBack={onClose}>
      <Text style={styles.body}>{t('session.explanation')}</Text>
      <Text style={styles.body}>{t('security.policy.keys')}</Text>
      <ListRow
        title={t('security.settings.biometric')}
        subtitle={t('security.settings.biometricNote')}
        selected={value.biometricUnlock}
        disabled={busy || !settings}
        onPress={() => setPatch(p => ({ ...p, biometricUnlock: !value.biometricUnlock }))}
      />
      <Text style={styles.body}>{t('security.settings.timeout')}</Text>
      {([0, 30000, 60000, 300000] as const).map(timeout => (
        <ListRow
          key={timeout}
          title={t(`security.settings.timeout${timeout}`)}
          selected={value.backgroundTimeoutMs === timeout}
          disabled={busy || !settings}
          onPress={() => setPatch(p => ({ ...p, backgroundTimeoutMs: timeout }))}
        />
      ))}
      {Platform.OS === 'android' ? (
        <ListRow
          title={t('security.settings.capture')}
          subtitle={t('security.settings.captureNote')}
          selected={!developerMode || value.screenCaptureProtection}
          disabled={busy || !settings || !developerMode}
          onPress={() => {
            if (value.screenCaptureProtection) setCaptureWarning(true);
            else setPatch(p => ({ ...p, screenCaptureProtection: true }));
          }}
        />
      ) : null}
      {requiresPassphrase ? (
        <PassphraseInput
          ref={input}
          label={t('recovery.current')}
          hint={t('recovery.fresh')}
          style={styles.input}
          disabled={busy}
          onPresenceChange={setPresent}
        />
      ) : null}
      <Button
        label={t('security.settings.save')}
        disabled={busy || !settings || !Object.keys(patch).length || (requiresPassphrase && !present)}
        onPress={save}
      />
      {error ? (
        <Text accessibilityRole="alert" style={styles.body}>
          {t('security.settings.error')}
        </Text>
      ) : null}
      {onChangePassphrase ? <Button label={t('recovery.change')} onPress={onChangePassphrase} /> : null}
      {onOpenRecovery
        ? accounts.map(account => (
            <Button
              key={account.id}
              label={`${t('recovery.title')}: ${account.label || account.address}`}
              onPress={() => onOpenRecovery(account.id)}
              variant="secondary"
            />
          ))
        : null}
      <AppModal visible={captureWarning} onRequestClose={() => setCaptureWarning(false)}>
        <View>
          <Text style={styles.body}>{t('security.settings.captureWarning')}</Text>
          <Button
            label={t('security.settings.allowCapture')}
            onPress={() => {
              setPatch(p => ({ ...p, screenCaptureProtection: false }));
              setCaptureWarning(false);
            }}
          />
          <Button label={t('common.cancel')} onPress={() => setCaptureWarning(false)} variant="secondary" />
        </View>
      </AppModal>
    </SettingsSubpage>
  );
}
