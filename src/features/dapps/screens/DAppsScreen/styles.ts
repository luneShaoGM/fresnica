import {StyleSheet} from 'react-native';

import type {AppTheme} from '../../../../ui/theme';

export function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    content: {
      paddingHorizontal: 18,
      paddingTop: 8,
      paddingBottom: 34,
    },
    header: {
      minHeight: 54,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    title: {
      fontSize: 28,
      lineHeight: 34,
      fontWeight: '800',
      color: theme.colors.textPrimary,
      letterSpacing: -0.6,
    },
    headerActions: {
      flexDirection: 'row',
      gap: 8,
    },
    headerIcon: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.surfaceMuted,
    },
    headerGlyph: {
      fontSize: 18,
      color: theme.colors.surfaceStrong,
      fontWeight: '700',
    },
    searchBox: {
      height: 42,
      borderRadius: 10,
      backgroundColor: theme.colors.surfaceMuted,
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 12,
      gap: 8,
      marginTop: 8,
      marginBottom: 12,
    },
    searchGlyph: {
      fontSize: 20,
      color: theme.colors.textSecondary,
    },
    searchInput: {
      flex: 1,
      color: theme.colors.textPrimary,
      fontSize: 14,
      paddingVertical: 0,
    },
    segment: {
      height: 42,
      borderRadius: 10,
      backgroundColor: theme.colors.surfaceMuted,
      padding: 3,
      flexDirection: 'row',
      marginBottom: 12,
    },
    segmentButton: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 8,
    },
    segmentButtonSelected: {
      backgroundColor: theme.colors.surface,
    },
    segmentText: {
      fontSize: 13,
      color: theme.colors.textSecondary,
      fontWeight: '600',
    },
    segmentTextSelected: {
      color: theme.colors.textPrimary,
      fontWeight: '800',
    },
    categories: {
      gap: 8,
      paddingBottom: 8,
    },
    chip: {
      height: 32,
      borderRadius: 16,
      paddingHorizontal: 14,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.surfaceMuted,
    },
    chipSelected: {
      backgroundColor: theme.colors.surfaceStrong,
    },
    chipText: {
      fontSize: 11,
      color: theme.colors.textSecondary,
      fontWeight: '700',
    },
    chipTextSelected: {
      color: theme.colors.onActionPrimary,
    },
    sectionTitle: {
      fontSize: 17,
      lineHeight: 21,
      fontWeight: '800',
      color: theme.colors.textPrimary,
      paddingTop: 17,
      paddingBottom: 8,
    },
    appRow: {
      minHeight: 76,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 11,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.colors.border,
    },
    appRowDisabled: {
      opacity: 0.62,
    },
    appIcon: {
      width: 46,
      height: 46,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.surfaceStrong,
    },
    appInitials: {
      fontSize: 11,
      color: theme.colors.onActionPrimary,
      fontWeight: '800',
    },
    appIdentity: {
      flex: 1,
      gap: 3,
    },
    appTitle: {
      fontSize: 14,
      lineHeight: 18,
      fontWeight: '800',
      color: theme.colors.textPrimary,
    },
    appSubtitle: {
      fontSize: 11,
      lineHeight: 15,
      color: theme.colors.textSecondary,
    },
    aboutButton: {
      minWidth: 56,
      height: 30,
      borderRadius: 15,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.surfaceMuted,
      paddingHorizontal: 10,
    },
    aboutText: {
      fontSize: 10,
      color: theme.colors.textSecondary,
      fontWeight: '700',
    },
    emptyCatalog: {
      minHeight: 104,
      borderRadius: 12,
      backgroundColor: theme.colors.surfaceMuted,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 20,
      paddingVertical: 14,
      gap: 7,
    },
    emptyIcon: {
      width: 34,
      height: 34,
      borderRadius: 17,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.surface,
    },
    emptyGlyph: {
      fontSize: 17,
      color: theme.colors.textTertiary,
    },
    emptyText: {
      fontSize: 11,
      lineHeight: 16,
      color: theme.colors.textSecondary,
      textAlign: 'center',
    },
  });
}
