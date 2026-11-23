import { StyleSheet } from 'react-native';
import type { AppTheme } from '@ui/theme';

export function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    header: {
      minHeight: 58,
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 12,
      paddingVertical: theme.spacing.xs,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.colors.border,
    },
    // Reserve the localized Back control's natural width before laying out the title.
    side: { flexShrink: 0, alignItems: 'flex-start' },
    title: {
      flex: 1,
      minWidth: 0,
      textAlign: 'center',
      fontSize: 18,
      lineHeight: 22,
      fontWeight: '800',
      color: theme.colors.textPrimary,
    },
  });
}
