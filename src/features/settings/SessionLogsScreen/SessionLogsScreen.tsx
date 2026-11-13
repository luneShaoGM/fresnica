import React, { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Text } from 'react-native';
import type { NetworkSettings } from '@capabilities/network/createNetworkSettings';
import { Button } from '@ui/components';
import { useThemedStyles } from '@ui/theme';
import { useLocalization } from '../../../locale';
import { SettingsSubpage } from '../SettingsSubpage';
import { createStyles } from '../SettingsSubpage.styles';
export type SessionLogSource = Readonly<{ exportSession(): string; clear(): void }>;
export function SessionLogsScreen({
  source,
  settings,
  share,
  active,
  onBack,
}: Readonly<{
  source: SessionLogSource;
  settings: NetworkSettings;
  share(text: string): Promise<void>;
  active: boolean;
  onBack(): void;
}>) {
  const { t } = useLocalization();
  const styles = useThemedStyles(createStyles);
  const network = useSyncExternalStore(settings.subscribe, settings.getSnapshot);
  const enabled = active && network.preferences.developerMode;
  const [text, setText] = useState('');
  const [error, setError] = useState(false);
  const [sharing, setSharing] = useState(false);
  const generation = useRef(0);
  const shareFlight = useRef(false);
  const refresh = () => {
    try {
      setText(source.exportSession());
      setError(false);
    } catch {
      setError(true);
    }
  };
  useEffect(() => {
    generation.current += 1;
    if (enabled) {
      try {
        setText(source.exportSession());
      } catch {
        setError(true);
      }
    } else setText('');
    return () => {
      generation.current += 1;
    };
  }, [enabled, source]);
  const exportLogs = async () => {
    if (!enabled || shareFlight.current) return;
    shareFlight.current = true;
    const epoch = generation.current;
    setSharing(true);
    setError(false);
    try {
      const data = source.exportSession();
      if (!settings.getSnapshot().preferences.developerMode) return;
      await share(data);
    } catch {
      if (generation.current === epoch) setError(true);
    } finally {
      shareFlight.current = false;
      if (generation.current === epoch) setSharing(false);
    }
  };
  return (
    <SettingsSubpage title={t('settings.sessionLogs')} onBack={onBack}>
      <Text style={styles.helper}>{t('preferences.logsNote')}</Text>
      {enabled ? (
        <>
          <Button label={t('preferences.refresh')} onPress={refresh} />
          <Button label={t('preferences.export')} disabled={sharing} onPress={exportLogs} variant="secondary" />
          <Button
            label={t('preferences.clear')}
            onPress={() => {
              try {
                source.clear();
                refresh();
              } catch {
                setError(true);
              }
            }}
            variant="secondary"
          />
          <Text selectable style={styles.helper}>
            {text}
          </Text>
        </>
      ) : (
        <Text style={styles.helper}>{t('preferences.logsDisabled')}</Text>
      )}
      {error ? (
        <Text accessibilityRole="alert" style={styles.helper}>
          {t('preferences.logsError')}
        </Text>
      ) : null}
    </SettingsSubpage>
  );
}
