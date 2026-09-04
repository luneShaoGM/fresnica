import React, {createContext, type PropsWithChildren} from 'react';

import {defaultTheme} from './defaultTheme';
import type {AppTheme} from './types';

export const AppThemeContext = createContext<AppTheme>(defaultTheme);

type Props = PropsWithChildren<
  Readonly<{
    theme?: AppTheme;
  }>
>;

export function AppThemeProvider({children, theme = defaultTheme}: Props) {
  return <AppThemeContext.Provider value={theme}>{children}</AppThemeContext.Provider>;
}
