import React, { useEffect, useState, useSyncExternalStore } from 'react';
import { Text } from 'react-native';
import type { ThemeMode } from '@capabilities/preferences/generalPreferences';
import { Button, ListRow } from '@ui/components';
import { useThemedStyles } from '@ui/theme';
import { useLocalization } from '../../../locale';
import { SettingsSubpage } from '../SettingsSubpage';
import { createStyles } from '../SettingsSubpage.styles';
import { useGeneralPreferences } from '../generalPreferences';
import type { ThemeImageSelection } from '@capabilities/preferences/createThemeImageSelection';
const subscribeNothing = () => () => {};
const idle = Object.freeze({ busy: false, error: false });
const readIdle = () => idle;
export function ThemeSettingsScreen({
  active,
  selection,
  onBack,
}: Readonly<{
  active: boolean;
  selection?: ThemeImageSelection;
  onBack(): void;
}>) {
  const { t } = useLocalization();
  const styles = useThemedStyles(createStyles);
  const { controller, preferences } = useGeneralPreferences();
  const state = useSyncExternalStore(selection?.subscribe ?? subscribeNothing, selection?.getSnapshot ?? readIdle);
  const [saveError, setSaveError] = useState(false);
  useEffect(() => {
    if (!active) selection?.cancel();
  }, [active, selection]);
  const select = (theme: ThemeMode) => {
    try {
      if (!active || state.busy || !controller) return;
      selection?.cancel();
      controller.update({ theme });
      setSaveError(false);
    } catch {
      setSaveError(true);
    }
  };
  const busy = state.busy;
  const error = state.error || saveError;
  const pick = () => {
    if (active && controller) {
      setSaveError(false);
      return selection?.start();
    }
  };
  return (
    <SettingsSubpage
      title={t('settings.theme')}
      onBack={() => {
        selection?.cancel();
        onBack();
      }}
    >
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
      <Button label={t('preferences.pickImage')} disabled={busy || !controller || !selection} onPress={pick} />
      {error ? (
        <Text accessibilityRole="alert" style={styles.helper}>
          {t('preferences.imageError')}
        </Text>
      ) : null}
    </SettingsSubpage>
  );
}
