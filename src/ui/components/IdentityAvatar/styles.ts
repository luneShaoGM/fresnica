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
      backgroundColor: theme.colors.actionPrimaryMuted,
      overflow: 'hidden',
    },
    small: { width: 16, height: 16 },
    native: { fontSize: 26, color: theme.colors.actionPrimaryPressed },
    nativeSmall: { fontSize: 12 },
  });
}
