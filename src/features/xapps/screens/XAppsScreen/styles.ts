import {StyleSheet} from 'react-native';

import type {AppTheme} from '../../../../ui/theme';

export function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    content: {
      paddingBottom: 34,
    },
    header: {
      minHeight: 60,
      paddingHorizontal: 18,
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
      alignItems: 'center',
      gap: 16,
    },
    headerAction: {
      minWidth: 30,
      minHeight: 36,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerActionDisabled: {
      opacity: 0.35,
    },
    headerGlyph: {
      fontSize: 20,
      lineHeight: 24,
      color: theme.colors.surfaceStrong,
      fontWeight: '700',
    },
    globeGlyph: {
      fontSize: 21,
      lineHeight: 24,
      color: theme.colors.surfaceStrong,
      fontWeight: '700',
    },
    cancelButton: {
      minHeight: 32,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 16,
      paddingHorizontal: 11,
      gap: 5,
      backgroundColor: theme.colors.surfaceMuted,
    },
    cancelText: {
      fontSize: 11,
      lineHeight: 14,
      color: theme.colors.textSecondary,
      fontWeight: '700',
    },
    cancelGlyph: {
      fontSize: 16,
      lineHeight: 18,
      color: theme.colors.textSecondary,
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
      marginHorizontal: 18,
      marginVertical: 8,
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
      marginHorizontal: 18,
      marginBottom: 8,
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
      paddingHorizontal: 18,
      paddingBottom: 10,
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
    emptyCatalog: {
      minHeight: 230,
      marginHorizontal: 18,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 28,
      gap: 9,
    },
    emptyIcon: {
      width: 58,
      height: 58,
      borderRadius: 29,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.surfaceMuted,
    },
    emptyGlyph: {
      fontSize: 28,
      color: theme.colors.textTertiary,
    },
    emptyText: {
      fontSize: 12,
      lineHeight: 17,
      color: theme.colors.textSecondary,
      textAlign: 'center',
    },
    pressed: {
      opacity: 0.68,
    },
  });
}
