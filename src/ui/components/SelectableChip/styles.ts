import { StyleSheet } from 'react-native';

import type { AppTheme } from '@ui/theme';

export function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    chip: {
      maxWidth: '100%',
      borderRadius: theme.radii.pill,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.surfaceMuted,
    },
    compact: {
      minHeight: 32,
      paddingHorizontal: 14,
      paddingVertical: theme.spacing.xs,
    },
    regular: {
      minHeight: 44,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
    },
    selected: {
      backgroundColor: theme.colors.surfaceStrong,
    },
    pressed: {
      opacity: 0.82,
    },
    disabled: {
      opacity: 0.45,
    },
    text: {
      fontWeight: '700',
      textAlign: 'center',
      color: theme.colors.textSecondary,
    },
    compactText: {
      fontSize: 11,
    },
    regularText: {
      ...theme.typography.caption,
      fontWeight: '700',
    },
    selectedText: {
      color: theme.colors.onSurfaceStrong,
    },
  });
}
