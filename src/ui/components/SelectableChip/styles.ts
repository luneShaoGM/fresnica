import { StyleSheet } from 'react-native';

import type { AppTheme } from '@ui/theme';

export function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    chip: {
      borderRadius: theme.radii.pill,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.surfaceMuted,
    },
    compact: {
      height: 32,
      paddingHorizontal: 14,
    },
    regular: {
      minHeight: 44,
      maxWidth: '100%',
      paddingHorizontal: theme.spacing.md,
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
