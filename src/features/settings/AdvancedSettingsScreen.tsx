import React, { useSyncExternalStore } from 'react';
import { Text, View } from 'react-native';
import type { NetworkSettings } from '@capabilities/network/createNetworkSettings';
import { ListRow } from '@ui/components';
import { useThemedStyles } from '@ui/theme';
import { useLocalization } from '../../locale';
import { NetworkManagement } from './NetworkManagement';
import { SettingsSubpage } from './SettingsSubpage';
import { createStyles } from './SettingsSubpage.styles';

export function AdvancedSettingsScreen({
  settings,
  onBack,
  onOpenNetwork,
  onOpenAbout,
}: Readonly<{ settings?: NetworkSettings; onBack: () => void; onOpenNetwork: () => void; onOpenAbout: () => void }>) {
  const { t } = useLocalization();
  const styles = useThemedStyles(createStyles);
  return (
    <SettingsSubpage title={t('settings.advanced')} onBack={onBack}>
      <View style={styles.section}>
        <Text style={styles.label}>{t('settings.network')}</Text>
      </View>
      <ListRow title={t('settings.network')} subtitle={t('settings.networkDetail')} onPress={onOpenNetwork} />
      <View style={styles.section}>
        <Text style={styles.label}>{t('settings.releaseInformation')}</Text>
      </View>
      <ListRow title={t('settings.about')} onPress={onOpenAbout} />
      {['version', 'changeLog'].map(key => (
        <ListRow key={key} title={t('settings.' + key)} subtitle={t('settings.unavailable')} />
      ))}
      <View style={styles.section}>
        <Text style={styles.label}>{t('settings.debug')}</Text>
      </View>
      <ListRow title={t('settings.deviceId')} subtitle={t('settings.unavailable')} />
      {settings ? (
        <DeveloperSection settings={settings} />
      ) : (
        <ListRow title={t('settings.developerMode')} subtitle={t('settings.controlsUnavailable')} />
      )}
      <ListRow title={t('settings.sessionLogs')} subtitle={t('settings.unavailable')} />
    </SettingsSubpage>
  );
}
function DeveloperSection({ settings }: Readonly<{ settings: NetworkSettings }>) {
  const { t } = useLocalization();
  const snapshot = useSyncExternalStore(settings.subscribe, settings.getSnapshot);
  return (
    <>
      <NetworkManagement settings={settings} section="developer-mode" />
      {snapshot.preferences.developerMode ? (
        <ListRow title={t('settings.developerTools')} subtitle={t('settings.unavailable')} />
      ) : null}
    </>
  );
}
