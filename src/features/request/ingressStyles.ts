import { StyleSheet } from 'react-native';

import type { AppTheme } from '../../ui/theme';

export function createRequestIngressStyles(theme: AppTheme) {
  return StyleSheet.create({
    header: {
      minHeight: 58,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.colors.border,
    },
    closeButton: { minWidth: 54, minHeight: 42, alignItems: 'center', justifyContent: 'center' },
    closeText: { color: theme.colors.actionPrimary, fontSize: 12, lineHeight: 16, fontWeight: '700' },
    title: { fontSize: 18, lineHeight: 22, fontWeight: '800', color: theme.colors.textPrimary },
    spacer: { width: 54 },
    content: { flexGrow: 1, padding: 18, gap: 12 },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
    body: { fontSize: 13, lineHeight: 19, color: theme.colors.textSecondary, textAlign: 'center' },
    purpose: { fontSize: 12, lineHeight: 18, color: theme.colors.textSecondary, textAlign: 'center' },
    scannerFrame: {
      height: 380,
      borderRadius: 16,
      overflow: 'hidden',
      backgroundColor: theme.colors.surfaceMuted,
    },
    scannerControls: { flexDirection: 'row', gap: 10 },
    action: {
      minHeight: 44,
      borderRadius: 10,
      paddingHorizontal: 16,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.actionPrimary,
    },
    secondaryAction: { backgroundColor: theme.colors.secondary },
    actionText: { color: theme.colors.onActionPrimary, fontSize: 12, lineHeight: 16, fontWeight: '800' },
    resultCard: { borderRadius: 12, padding: 14, gap: 8, backgroundColor: theme.colors.surfaceMuted },
    resultTitle: { fontSize: 16, lineHeight: 21, fontWeight: '800', color: theme.colors.textPrimary },
    resultBody: { fontSize: 12, lineHeight: 18, color: theme.colors.textSecondary },
    detailRow: { gap: 2 },
    detailLabel: { fontSize: 9, lineHeight: 12, color: theme.colors.textTertiary, fontWeight: '800' },
    detailValue: { fontSize: 11, lineHeight: 16, color: theme.colors.textPrimary },
    errorCard: { borderRadius: 12, padding: 14, gap: 8, backgroundColor: theme.colors.negativeMuted },
    errorTitle: { fontSize: 15, lineHeight: 20, fontWeight: '800', color: theme.colors.negative },
    errorBody: { fontSize: 12, lineHeight: 18, color: theme.colors.textSecondary },
    statusCard: { borderRadius: 12, padding: 14, gap: 8, backgroundColor: theme.colors.surfaceMuted },
    statusTitle: { fontSize: 15, lineHeight: 20, fontWeight: '800', color: theme.colors.textPrimary },
    actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    pressed: { opacity: 0.72 },
  });
}
