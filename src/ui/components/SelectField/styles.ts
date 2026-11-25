import { StyleSheet } from 'react-native';

import type { AppTheme } from '@ui/theme';

export function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    field: { minWidth: 0, gap: theme.spacing.sm },
    label: { ...theme.typography.label, color: theme.colors.textPrimary },
    trigger: {
      minHeight: 50,
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.sm,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.radii.md,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
      backgroundColor: theme.colors.surface,
    },
    copy: { flex: 1, minWidth: 0, gap: theme.spacing.xs },
    value: { ...theme.typography.body, color: theme.colors.textPrimary },
    description: { ...theme.typography.caption, color: theme.colors.textSecondary },
    chevron: { ...theme.typography.sectionTitle, color: theme.colors.textSecondary },
    options: { gap: theme.spacing.xs },
    option: {
      minHeight: 48,
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.sm,
      borderRadius: theme.radii.md,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
      backgroundColor: theme.colors.surfaceMuted,
    },
    selected: { backgroundColor: theme.colors.surfaceStrong },
    selectedText: { color: theme.colors.onSurfaceStrong },
    disabled: { opacity: 0.45 },
    pressed: { opacity: 0.82 },
  });
}
