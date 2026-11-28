import { StyleSheet } from 'react-native';
import type { AppTheme } from '../../../../ui/theme';

export function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: theme.colors.background },
    header: {
      paddingHorizontal: 10,
      paddingVertical: 8,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: theme.colors.surface,
    },
    identity: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 6 },
    identityText: { flex: 1, minWidth: 0 },
    title: { fontSize: 14, fontWeight: '700', color: theme.colors.textPrimary },
    tools: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    tool: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.surfaceMuted,
    },
    networkTool: { width: 46, flexDirection: 'row', gap: 4 },
    networkDot: { width: 7, height: 7, borderRadius: 4 },
    mainnetDot: { backgroundColor: theme.colors.positive },
    testnetDot: { backgroundColor: theme.colors.warning },
    toolDisabled: { opacity: 0.35 },
    toolGlyph: { color: theme.colors.textPrimary, fontSize: 20, lineHeight: 24 },
    browser: { flex: 1 },
    origin: { fontSize: 11, color: theme.colors.textPrimary },
    heading: { fontSize: 17, fontWeight: '700', color: theme.colors.textPrimary },
    notice: { fontSize: 12, lineHeight: 18, color: theme.colors.textSecondary, padding: 8 },
    permission: {
      padding: 16,
      gap: 12,
      backgroundColor: theme.colors.surface,
      borderTopWidth: 1,
      borderTopColor: theme.colors.border,
    },
    recovery: { flexGrow: 0, maxHeight: '40%' },
    recoveryValue: { color: theme.colors.textPrimary, fontSize: 13 },
    error: { color: theme.colors.textSecondary, padding: 18 },
  });
}
