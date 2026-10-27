import { StyleSheet } from 'react-native';

import type { AppTheme } from '@ui/theme';

export function createStyles(theme: AppTheme) {
  const elevation = theme.elevation.high;
  return StyleSheet.create({
    root: {
      flex: 1,
      justifyContent: 'flex-end',
    },
    backdrop: {
      position: 'absolute',
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
      backgroundColor: theme.colors.overlayBackdrop,
    },
    panel: {
      height: '88%',
      borderTopLeftRadius: theme.radii.lg,
      borderTopRightRadius: theme.radii.lg,
      backgroundColor: theme.colors.background,
      paddingTop: theme.spacing.md,
      paddingBottom: theme.spacing.lg,
      shadowColor: theme.colors.secondary,
      shadowOffset: { width: 0, height: elevation.offsetY },
      shadowOpacity: elevation.opacity,
      shadowRadius: elevation.radius,
      elevation: elevation.androidElevation,
    },
  });
}
