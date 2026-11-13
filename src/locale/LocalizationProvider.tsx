import type { GeneralPreferences } from '@capabilities/preferences/generalPreferences';
import React, {createContext, useContext, useMemo} from 'react';

import {createLocalization, type LocalizationRuntime} from './localization';
import {resolveLocale, type SupportedLocale} from './locales';

export type LocalizationContextValue = LocalizationRuntime &
  Readonly<{
    setLocale: (locale: string) => void;
    displayPreferences?: GeneralPreferences;
  }>;

const LocalizationContext = createContext<LocalizationContextValue | undefined>(undefined);

type Props = React.PropsWithChildren<
  Readonly<{
    locale: SupportedLocale;
    numberLocale?: string;
    displayPreferences?: GeneralPreferences;
    onChangeLocale: (locale: SupportedLocale) => void;
  }>
>;

export function LocalizationProvider({children, locale, onChangeLocale, numberLocale, displayPreferences}: Props) {
  const value = useMemo<LocalizationContextValue>(() => {
    const runtime = createLocalization(locale, numberLocale);
    return {
      ...runtime,
      displayPreferences,
      setLocale: requestedLocale => onChangeLocale(resolveLocale(requestedLocale)),
    };
  }, [locale, onChangeLocale, numberLocale, displayPreferences]);

  return <LocalizationContext.Provider value={value}>{children}</LocalizationContext.Provider>;
}

export function useLocalization(): LocalizationContextValue {
  const context = useContext(LocalizationContext);
  if (!context) {
    throw new Error('localization-provider-required');
  }
  return context;
}
