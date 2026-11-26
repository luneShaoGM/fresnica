import { StyleSheet } from 'react-native';

import type { AppTheme } from '@ui/theme';

export function createReceiveSheetStyles(theme: AppTheme) {
  return StyleSheet.create({
    layout: { flex: 1, gap: theme.spacing.md, paddingHorizontal: theme.spacing.lg },
    header: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: theme.spacing.sm,
    },
    title: { ...theme.typography.sectionTitle, color: theme.colors.textPrimary },
    network: { ...theme.typography.caption, color: theme.colors.textSecondary },
    content: { gap: theme.spacing.lg, paddingBottom: theme.spacing.md },
    addressCard: {
      backgroundColor: theme.colors.surfaceMuted,
      borderRadius: theme.radii.md,
      padding: theme.spacing.md,
    },
    addressLabel: { ...theme.typography.caption, color: theme.colors.textSecondary },
    address: { ...theme.typography.body, color: theme.colors.textPrimary },
    qr: { alignSelf: 'center', borderRadius: theme.radii.md, overflow: 'hidden' },
  });
}
