import { StyleSheet } from 'react-native';
import type { AppTheme } from '@ui/theme';

export function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    header: {
      minHeight: 58,
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.colors.border,
    },
    side: { flex: 1, alignItems: 'flex-start' },
    title: {
      maxWidth: '58%',
      textAlign: 'center',
      fontSize: 18,
      lineHeight: 22,
      fontWeight: '800',
      color: theme.colors.textPrimary,
    },
  });
}
