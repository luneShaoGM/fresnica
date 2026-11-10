import React, { useState, useSyncExternalStore } from 'react';
import { Switch, Text, View } from 'react-native';
import type { NetworkSettings } from '@capabilities/network/createNetworkSettings';
import { DEFAULT_NETWORK_PREFERENCES } from '@capabilities/network/networkPreferences';
import { useThemedStyles } from '@ui/theme';
import { useLocalization } from '../../locale';
import { SettingsSubpage } from './SettingsSubpage';
import { createStyles } from './SettingsSubpage.styles';

const FALLBACK = Object.freeze({
  preferences: DEFAULT_NETWORK_PREFERENCES,
  busy: false,
  interruption: 0,
  tests: Object.freeze({}),
});
const noopSubscribe = () => () => {};

export function PrivacySettingsScreen({
  settings,
  onBack,
}: Readonly<{
  settings?: NetworkSettings;
  onBack: () => void;
}>) {
  const { t } = useLocalization();
  const styles = useThemedStyles(createStyles);
  const snapshot = useSyncExternalStore(
    settings?.subscribe ?? noopSubscribe,
    settings?.getSnapshot ?? (() => FALLBACK),
  );
  const [saving, setSaving] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);

  const setExternalTokenImages = (value: boolean) => {
    if (!settings || saving || snapshot.busy) return;
    setSaving(true);
    setSaveFailed(false);
    settings
      .setExternalTokenImagesEnabled(value)
      .catch(() => setSaveFailed(true))
      .finally(() => setSaving(false));
  };

  return (
    <SettingsSubpage title={t('settings.privacy')} onBack={onBack}>
      <View style={styles.section}>
        <View style={styles.toggleRow}>
          <Text style={styles.toggleTitle}>{t('settings.privacy.tokenImages')}</Text>
          <Switch
            accessibilityLabel={t('settings.privacy.tokenImages')}
            disabled={!settings || saving || snapshot.busy}
            onValueChange={setExternalTokenImages}
            value={snapshot.preferences.externalTokenImagesEnabled !== false}
          />
        </View>
        <Text style={styles.label}>{t('settings.privacy.tokenImagesInfo')}</Text>
        <Text style={styles.label}>{t('settings.privacy.tokenImagesNetworkInfo')}</Text>
        {!settings ? <Text style={styles.label}>{t('settings.controlsUnavailable')}</Text> : null}
        {saveFailed ? <Text style={styles.label}>{t('settings.privacy.saveFailed')}</Text> : null}
      </View>
    </SettingsSubpage>
  );
}
