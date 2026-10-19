import { StyleSheet } from 'react-native';

import type { AppTheme } from '@ui/theme';

export function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: theme.colors.background },
    header: {
      minHeight: 58,
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.colors.border,
    },
    title: { fontSize: 18, lineHeight: 22, fontWeight: '800', color: theme.colors.textPrimary },
    headerSide: { flex: 1, alignItems: 'flex-start' },
    content: { paddingBottom: 38 },
    hero: { alignItems: 'center', paddingHorizontal: 30, paddingTop: 34, paddingBottom: 30, gap: 10 },
    logo: {
      width: 74,
      height: 74,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.surfaceStrong,
    },
    logoDot: { width: 26, height: 26, borderRadius: 13, backgroundColor: theme.colors.actionPrimary },
    appName: { fontSize: 22, lineHeight: 27, fontWeight: '800', color: theme.colors.textPrimary },
    tagline: { fontSize: 12, lineHeight: 17, color: theme.colors.textSecondary, textAlign: 'center' },
    rows: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.colors.border },
    infoRow: {
      minHeight: 56,
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 18,
      gap: 18,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.colors.border,
    },
    infoLabel: { fontSize: 13, lineHeight: 17, color: theme.colors.textPrimary, fontWeight: '600' },
    infoValue: { flex: 1, fontSize: 12, lineHeight: 16, color: theme.colors.textSecondary, textAlign: 'right' },
    note: {
      marginHorizontal: 18,
      marginTop: 24,
      padding: 15,
      borderRadius: 12,
      backgroundColor: theme.colors.surfaceMuted,
      gap: 6,
    },
    noteTitle: { fontSize: 13, lineHeight: 17, fontWeight: '800', color: theme.colors.secondary },
    noteText: { fontSize: 11, lineHeight: 16, color: theme.colors.textSecondary },
  });
}
