import React, { useEffect, useRef, useState } from 'react';
import { Text } from 'react-native';
import type { ImagePalette, ThemeMode } from '@capabilities/preferences/generalPreferences';
import { Button, ListRow } from '@ui/components';
import { useThemedStyles } from '@ui/theme';
import { useLocalization } from '../../../locale';
import { SettingsSubpage } from '../SettingsSubpage';
import { createStyles } from '../SettingsSubpage.styles';
import { useGeneralPreferences } from '../generalPreferences';
export function ThemeSettingsScreen({
  active,
  pickPalette,
  cancelPalette,
  onBack,
}: Readonly<{
  active: boolean;
  pickPalette(): Promise<ImagePalette | undefined>;
  cancelPalette(): void;
  onBack(): void;
}>) {
  const { t } = useLocalization();
  const styles = useThemedStyles(createStyles);
  const { controller, preferences } = useGeneralPreferences();
  const generation = useRef(0);
  const busyRef = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  useEffect(() => {
    if (!active) {
      generation.current += 1;
      cancelPalette();
      busyRef.current = false;
      setBusy(false);
    }
    return () => {
      generation.current += 1;
      cancelPalette();
    };
  }, [active, cancelPalette, controller]);
  const select = (theme: ThemeMode) => {
    try {
      if (!active || busyRef.current || !controller) return;
      controller.update({ theme });
      setError(false);
    } catch {
      setError(true);
    }
  };
  const pick = async () => {
    if (!active || busyRef.current || !controller) return;
    busyRef.current = true;
    setBusy(true);
    setError(false);
    const epoch = ++generation.current;
    try {
      const imagePalette = await pickPalette();
      if (generation.current === epoch && imagePalette) controller.update({ theme: 'image', imagePalette });
    } catch {
      if (generation.current === epoch) setError(true);
    } finally {
      if (generation.current === epoch) {
        busyRef.current = false;
        setBusy(false);
      }
    }
  };
  return (
    <SettingsSubpage title={t('settings.theme')} onBack={onBack}>
      {(['light', 'dark', 'system'] as const).map(mode => (
        <ListRow
          key={mode}
          title={t(`preferences.theme.${mode}`)}
          selected={preferences.theme === mode}
          disabled={busy || !controller}
          onPress={() => select(mode)}
        />
      ))}
      {preferences.imagePalette ? (
        <ListRow
          title={t('preferences.theme.image')}
          subtitle={t('preferences.savedPalette')}
          selected={preferences.theme === 'image'}
          disabled={busy || !controller}
          onPress={() => select('image')}
        />
      ) : null}
      <Text style={styles.helper}>{t('preferences.imageNote')}</Text>
      <Button label={t('preferences.pickImage')} disabled={busy || !controller} onPress={pick} />
      {error ? (
        <Text accessibilityRole="alert" style={styles.helper}>
          {t('preferences.imageError')}
        </Text>
      ) : null}
    </SettingsSubpage>
  );
}
