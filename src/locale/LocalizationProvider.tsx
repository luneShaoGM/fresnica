import React, {createContext, useContext, useMemo} from 'react';

import {createLocalization, type LocalizationRuntime} from './localization';
import {resolveLocale, type SupportedLocale} from './locales';

export type LocalizationContextValue = LocalizationRuntime &
  Readonly<{
    setLocale: (locale: string) => void;
  }>;

const LocalizationContext = createContext<LocalizationContextValue | undefined>(undefined);

type Props = React.PropsWithChildren<
  Readonly<{
    locale: SupportedLocale;
    onChangeLocale: (locale: SupportedLocale) => void;
  }>
>;

export function LocalizationProvider({children, locale, onChangeLocale}: Props) {
  const value = useMemo<LocalizationContextValue>(() => {
    const runtime = createLocalization(locale);
    return {
      ...runtime,
      setLocale: requestedLocale => onChangeLocale(resolveLocale(requestedLocale)),
    };
  }, [locale, onChangeLocale]);

  return <LocalizationContext.Provider value={value}>{children}</LocalizationContext.Provider>;
}

export function useLocalization(): LocalizationContextValue {
  const context = useContext(LocalizationContext);
  if (!context) {
    throw new Error('localization-provider-required');
  }
  return context;
}
