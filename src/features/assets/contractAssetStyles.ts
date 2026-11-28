import { StyleSheet } from 'react-native';
import type { AppTheme } from '@ui/theme';

export function createContractAssetStyles(theme: AppTheme) {
  return StyleSheet.create({
    panel: { gap: theme.spacing.sm, paddingVertical: theme.spacing.sm },
    card: {
      gap: theme.spacing.sm,
      padding: theme.spacing.md,
      borderRadius: theme.radii.md,
      backgroundColor: theme.colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.colors.separatorSubtle,
      minWidth: 0,
    },
    note: { ...theme.typography.caption, color: theme.colors.textSecondary },
    title: { ...theme.typography.label, color: theme.colors.textPrimary, fontWeight: '700', flexShrink: 1 },
    balance: { ...theme.typography.sectionTitle, color: theme.colors.textPrimary, flexShrink: 1 },
    contractId: { ...theme.typography.caption, color: theme.colors.textSecondary, flexShrink: 1 },
    input: {
      ...theme.typography.label,
      color: theme.colors.textPrimary,
      backgroundColor: theme.colors.surface,
      padding: theme.spacing.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.radii.md,
      minHeight: 48,
    },
    error: { ...theme.typography.caption, color: theme.colors.negativeStrong },
  });
}
