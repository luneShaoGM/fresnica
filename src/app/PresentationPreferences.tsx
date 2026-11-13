import React, { useMemo, useSyncExternalStore } from 'react';
import { useColorScheme } from 'react-native';
import {
  DEFAULT_GENERAL_PREFERENCES,
  type GeneralPreferenceController,
} from '@capabilities/preferences/generalPreferences';
import { GeneralPreferencesProvider } from '@features/settings/generalPreferences';
import { AppThemeProvider } from '@ui/theme';
import { createAppearanceTheme } from '@ui/theme/appearanceTheme';
import { FeedbackContext } from '@ui/feedback';
import { presentationFeedback } from '@platform/system/presentationPreferences';
const subscribeNothing = () => () => {};
const defaults = () => DEFAULT_GENERAL_PREFERENCES;
export function PresentationPreferences({
  controller,
  children,
}: React.PropsWithChildren<{ controller?: GeneralPreferenceController }>) {
  const preferences = useSyncExternalStore(
    controller?.subscribe ?? subscribeNothing,
    controller?.getSnapshot ?? defaults,
  );
  const systemDark = useColorScheme() === 'dark';
  const dark =
    preferences.theme === 'dark' || ((preferences.theme === 'system' || preferences.theme === 'image') && systemDark);
  const theme = useMemo(
    () => createAppearanceTheme(dark, preferences.theme === 'image' ? preferences.imagePalette : undefined),
    [dark, preferences.theme, preferences.imagePalette],
  );
  return (
    <GeneralPreferencesProvider controller={controller}>
      <AppThemeProvider theme={theme}>
        <FeedbackContext.Provider value={preferences.haptics ? presentationFeedback : undefined}>
          {children}
        </FeedbackContext.Provider>
      </AppThemeProvider>
    </GeneralPreferencesProvider>
  );
}
