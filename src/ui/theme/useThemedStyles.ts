import {useMemo} from 'react';

import type {AppTheme} from './types';
import {useAppTheme} from './useAppTheme';

export function useThemedStyles<T>(createStyles: (theme: AppTheme) => T): T {
  const theme = useAppTheme();
  return useMemo(() => createStyles(theme), [createStyles, theme]);
}
