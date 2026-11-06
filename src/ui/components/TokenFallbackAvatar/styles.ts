import { StyleSheet } from 'react-native';
import type { AppTheme } from '@ui/theme';

export function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    avatar: {
      width: 40,
      height: 40,
      flexShrink: 0,
      borderRadius: theme.radii.pill,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.surfaceMuted,
      overflow: 'hidden',
    },
    small: { width: 16, height: 16 },
    image: { width: '80%', height: '80%' },
  });
}
