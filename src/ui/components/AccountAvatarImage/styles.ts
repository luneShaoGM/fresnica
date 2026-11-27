import { StyleSheet } from 'react-native';
import type { AppTheme } from '@ui/theme';

export const accountAvatarFrameBorderWidth = 1;

export function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    frame: {
      flexShrink: 0,
      overflow: 'hidden',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.surfaceMuted,
      borderWidth: accountAvatarFrameBorderWidth,
      borderColor: theme.colors.border,
    },
  });
}
