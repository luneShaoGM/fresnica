import { StyleSheet } from 'react-native';

import type { AppTheme } from '@ui/theme';

export function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.sm,
      paddingVertical: theme.spacing.sm,
    },
    compact: {
      paddingVertical: theme.spacing.xs,
    },
    selectable: {
      paddingHorizontal: theme.spacing.sm,
      borderRadius: theme.radii.md,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.colors.border,
    },
    selected: {
      borderColor: theme.colors.actionPrimaryOutline,
      backgroundColor: theme.colors.actionPrimarySubtle,
    },
    pressed: {
      opacity: 0.68,
    },
    avatar: {
      width: 40,
      height: 40,
      borderRadius: theme.radii.pill,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.actionPrimaryMuted,
    },
    avatarCompact: {
      width: 32,
      height: 32,
    },
    avatarText: {
      ...theme.typography.label,
      color: theme.colors.secondary,
    },
    identity: {
      flex: 1,
      gap: theme.spacing.xs,
    },
    nameRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.xs,
    },
    name: {
      ...theme.typography.label,
      flexShrink: 1,
      color: theme.colors.textPrimary,
    },
    source: {
      ...theme.typography.caption,
      color: theme.colors.secondary,
      backgroundColor: theme.colors.surfaceMuted,
      borderRadius: theme.radii.pill,
      overflow: 'hidden',
      paddingHorizontal: theme.spacing.xs,
    },
    address: {
      ...theme.typography.caption,
      color: theme.colors.textSecondary,
    },
    memo: {
      ...theme.typography.caption,
      color: theme.colors.textSecondary,
    },
    menu: {
      minWidth: 36,
      minHeight: 36,
      alignItems: 'center',
      justifyContent: 'center',
    },
    menuText: {
      ...theme.typography.sectionTitle,
      color: theme.colors.textSecondary,
    },
  });
}
