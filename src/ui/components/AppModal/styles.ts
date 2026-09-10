import {StyleSheet} from 'react-native';

import type {AppTheme} from '@ui/theme';

export function createStyles(theme: AppTheme) {
  const elevation = theme.elevation.high;

  return StyleSheet.create({
    overlay: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: theme.spacing.lg,
    },
    backdrop: {
      position: 'absolute',
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
      backgroundColor: theme.colors.overlayBackdrop,
    },
    dialog: {
      width: '100%',
      maxWidth: 480,
      borderRadius: theme.radii.lg,
      backgroundColor: theme.colors.surface,
      padding: theme.spacing.lg,
      gap: theme.spacing.md,
      shadowColor: theme.colors.secondary,
      shadowOffset: {width: 0, height: elevation.offsetY},
      shadowOpacity: elevation.opacity,
      shadowRadius: elevation.radius,
      elevation: elevation.androidElevation,
    },
    title: {
      ...theme.typography.sectionTitle,
      color: theme.colors.textPrimary,
    },
    description: {
      ...theme.typography.body,
      color: theme.colors.textSecondary,
    },
  });
}
