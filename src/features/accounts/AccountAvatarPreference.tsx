import React, { useRef, useState, useSyncExternalStore } from 'react';
import { Text, View } from 'react-native';
import type { NetworkSettings } from '@capabilities/network/createNetworkSettings';
import { SelectableChip } from '@ui/components/SelectableChip';
import { useThemedStyles } from '@ui/theme';
import { useLocalization } from '../../locale';
import { createStyles } from './AccountAvatarPreference.styles';

export function AccountAvatarPreference({
  accountId,
  settings,
  active,
}: Readonly<{
  accountId: string;
  settings: NetworkSettings;
  active: boolean;
}>) {
  const { t } = useLocalization();
  const styles = useThemedStyles(createStyles);
  const { preferences, busy } = useSyncExternalStore(settings.subscribe, settings.getSnapshot);
  const online = preferences.onlineAccountAvatarIds?.includes(accountId) === true;
  const allowed = preferences.externalAccountAvatarsEnabled === true;
  const flight = useRef(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);
  const select = async (value: boolean) => {
    if (!active || busy || flight.current || value === online || (value && !allowed)) return;
    flight.current = true;
    setSaving(true);
    setError(false);
    try {
      await settings.setAccountAvatarOnline(accountId, value);
    } catch {
      setError(true);
    } finally {
      flight.current = false;
      setSaving(false);
    }
  };
  return (
    <View style={styles.content}>
      <Text style={styles.label}>{t('accounts.avatar.title')}</Text>
      <SelectableChip
        label={t('accounts.avatar.local')}
        accessibilityRole="radio"
        selected={!online}
        disabled={!active || busy || saving}
        onPress={() => select(false)}
      />
      <SelectableChip
        label={t('accounts.avatar.online')}
        accessibilityRole="radio"
        selected={online}
        disabled={!active || busy || saving || !allowed}
        onPress={() => select(true)}
      />
      {!allowed ? <Text style={styles.label}>{t('accounts.avatar.privacyRequired')}</Text> : null}
      {error ? (
        <Text accessibilityLiveRegion="polite" style={styles.error}>
          {t('settings.privacy.saveFailed')}
        </Text>
      ) : null}
    </View>
  );
}
