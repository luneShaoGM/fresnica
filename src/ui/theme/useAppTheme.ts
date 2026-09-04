import {useContext} from 'react';

import {AppThemeContext} from './AppThemeProvider';
import type {AppTheme} from './types';

export function useAppTheme(): AppTheme {
  return useContext(AppThemeContext);
}
