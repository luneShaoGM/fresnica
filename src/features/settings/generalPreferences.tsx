import React, { createContext, useContext, useSyncExternalStore } from 'react';
import {
  DEFAULT_GENERAL_PREFERENCES,
  type GeneralPreferenceController,
} from '@capabilities/preferences/generalPreferences';
export const GeneralPreferencesContext = createContext<GeneralPreferenceController | undefined>(undefined);
const subscribeNothing = () => () => {};
const defaults = () => DEFAULT_GENERAL_PREFERENCES;
export function useGeneralPreferences() {
  const controller = useContext(GeneralPreferencesContext);
  const preferences = useSyncExternalStore(
    controller?.subscribe ?? subscribeNothing,
    controller?.getSnapshot ?? defaults,
  );
  return { controller, preferences };
}
export function GeneralPreferencesProvider({
  controller,
  children,
}: React.PropsWithChildren<{ controller?: GeneralPreferenceController }>) {
  return <GeneralPreferencesContext.Provider value={controller}>{children}</GeneralPreferencesContext.Provider>;
}
