import { StyleSheet } from 'react-native';
import type { AppTheme } from '../../ui/theme';

export function createClaimableStyles(theme: AppTheme) {
  return StyleSheet.create({
    content: {
      paddingHorizontal: theme.spacing.lg,
      paddingTop: theme.spacing.lg,
      paddingBottom: theme.spacing.xxl,
      gap: theme.spacing.md,
    },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: theme.spacing.sm },
    title: { ...theme.typography.sectionTitle, color: theme.colors.textPrimary, flex: 1 },
    subtitle: { ...theme.typography.caption, color: theme.colors.textSecondary },
    button: {
      padding: theme.spacing.sm,
      backgroundColor: theme.colors.surfaceMuted,
      borderRadius: theme.radii.md,
      minHeight: 44,
      justifyContent: 'center',
    },
    buttonText: { ...theme.typography.label, color: theme.colors.textPrimary, fontWeight: '700' },
    card: {
      backgroundColor: theme.colors.surface,
      padding: theme.spacing.md,
      borderRadius: theme.radii.md,
      gap: theme.spacing.sm,
    },
    row: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm, minHeight: 60 },
    rowBody: { flex: 1, gap: theme.spacing.xs },
    assetCode: { ...theme.typography.label, fontWeight: '700', color: theme.colors.textPrimary },
    issuer: { ...theme.typography.caption, color: theme.colors.textSecondary },
    amount: { ...theme.typography.label, fontWeight: '700', color: theme.colors.textPrimary },
    state: { ...theme.typography.caption, color: theme.colors.textSecondary },
    safe: { color: theme.colors.positive },
    warning: { color: theme.colors.warning },
    error: { ...theme.typography.caption, color: theme.colors.negativeStrong },
    section: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: theme.spacing.sm,
    },
    sectionTitle: { ...theme.typography.label, fontWeight: '700', color: theme.colors.textPrimary },
    helper: { ...theme.typography.caption, color: theme.colors.textSecondary },
    divider: { backgroundColor: theme.colors.border, height: StyleSheet.hairlineWidth },
    detailCard: {
      backgroundColor: theme.colors.surface,
      padding: theme.spacing.md,
      borderRadius: theme.radii.md,
      gap: theme.spacing.md,
    },
    pair: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: theme.spacing.sm },
    label: { ...theme.typography.caption, color: theme.colors.textSecondary, flexShrink: 1 },
    value: { ...theme.typography.label, color: theme.colors.textPrimary, flex: 1, textAlign: 'right' },
    sheetContent: { gap: theme.spacing.md, padding: theme.spacing.md, minHeight: 180 },
    sheetActions: { gap: theme.spacing.sm, marginTop: theme.spacing.sm },
    passphrase: {
      borderColor: theme.colors.border,
      borderWidth: 1,
      borderRadius: theme.radii.md,
      color: theme.colors.textPrimary,
      padding: theme.spacing.md,
      minHeight: 48,
    },
    disabled: { opacity: 0.5 },
  });
}
