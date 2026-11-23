import { StyleSheet } from 'react-native';
import type { AppTheme } from '../../theme';
export const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
    content: { gap: theme.spacing.md },
    input: {
      color: theme.colors.textPrimary,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.radii.md,
      padding: theme.spacing.md,
      minHeight: 52,
    },
    error: { color: theme.colors.negativeStrong, fontSize: 14, lineHeight: 20 },
  });
