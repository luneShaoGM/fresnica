import { StyleSheet } from 'react-native';

import type { AppTheme } from '@ui/theme';

export function createStyles(theme: AppTheme) {
  const elevation = theme.elevation.high;

  return StyleSheet.create({
    overlay: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: theme.spacing.lg,
    },
    sheetOverlay: { justifyContent: 'flex-end', padding: 0 },
    sheet: {
      height: '88%',
      maxWidth: '100%',
      borderBottomLeftRadius: 0,
      borderBottomRightRadius: 0,
      padding: 0,
      gap: 0,
    },
    sheetContent: { flex: 1 },
    dialogContent: { gap: theme.spacing.md, flexShrink: 1 },
    dragTarget: { alignItems: 'center', justifyContent: 'center', height: 28 },
    dragHandle: {
      width: 40,
      height: 4,
      borderRadius: 2,
      backgroundColor: theme.colors.border,
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
      maxHeight: '88%',
      borderRadius: theme.radii.lg,
      backgroundColor: theme.colors.surface,
      padding: theme.spacing.lg,
      gap: theme.spacing.md,
      shadowColor: theme.colors.secondary,
      shadowOffset: { width: 0, height: elevation.offsetY },
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
