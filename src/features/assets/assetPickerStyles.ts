import { StyleSheet } from 'react-native';
import type { AppTheme } from '../../ui/theme';

export function createAssetPickerStyles(theme: AppTheme) {
  return StyleSheet.create({
    sheet: { flex: 1, paddingHorizontal: theme.spacing.lg, gap: theme.spacing.sm },
    header: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm },
    title: { ...theme.typography.sectionTitle, flex: 1, color: theme.colors.textPrimary },
    search: {
      minHeight: 48,
      borderRadius: theme.radii.md,
      paddingHorizontal: theme.spacing.md,
      color: theme.colors.textPrimary,
      backgroundColor: theme.colors.surfaceMuted,
    },
    list: { paddingBottom: theme.spacing.lg, gap: theme.spacing.sm },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.md,
      padding: theme.spacing.md,
      minHeight: 72,
      borderRadius: theme.radii.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
    },
    selected: { borderColor: theme.colors.actionPrimary, backgroundColor: theme.colors.actionPrimarySubtle },
    body: { flex: 1, gap: theme.spacing.xs },
    code: { ...theme.typography.label, color: theme.colors.textPrimary },
    detail: { ...theme.typography.caption, color: theme.colors.textSecondary },
    indicator: { ...theme.typography.label, color: theme.colors.actionPrimary },
  });
}
