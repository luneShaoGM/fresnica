import {StyleSheet} from 'react-native';

import type {AppTheme} from '@ui/theme';

export function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    header: {
      minHeight: 64,
      paddingHorizontal: theme.spacing.md,
      paddingTop: theme.spacing.xs,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    headerIdentity: {
      flex: 1,
      paddingRight: theme.spacing.md,
    },
    title: {
      ...theme.typography.title,
      color: theme.colors.textPrimary,
    },
    accountCaption: {
      ...theme.typography.caption,
      color: theme.colors.textTertiary,
      marginTop: theme.spacing.xs,
    },
    headerButton: {
      width: 40,
      height: 40,
      borderRadius: theme.radii.pill,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.surfaceMuted,
    },
    headerButtonText: {
      fontSize: 20,
      lineHeight: 24,
      fontWeight: '700',
      color: theme.colors.surfaceStrong,
    },
    controls: {
      paddingHorizontal: theme.spacing.md,
      paddingBottom: theme.spacing.sm,
    },
    searchBox: {
      height: 42,
      borderRadius: theme.radii.md,
      backgroundColor: theme.colors.surfaceMuted,
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: theme.spacing.sm,
      gap: theme.spacing.sm,
    },
    searchGlyph: {
      fontSize: 20,
      color: theme.colors.textSecondary,
    },
    searchInput: {
      flex: 1,
      ...theme.typography.label,
      color: theme.colors.textPrimary,
      paddingVertical: 0,
    },
    filters: {
      gap: theme.spacing.sm,
      paddingTop: theme.spacing.sm,
      paddingRight: theme.spacing.md,
    },
    filterChip: {
      minHeight: 32,
      borderRadius: theme.radii.pill,
      paddingHorizontal: theme.spacing.md,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.surfaceMuted,
    },
    filterChipSelected: {
      backgroundColor: theme.colors.surfaceStrong,
    },
    filterText: {
      ...theme.typography.caption,
      fontWeight: '700',
      color: theme.colors.textSecondary,
    },
    filterTextSelected: {
      color: theme.colors.onActionPrimary,
    },
    listContent: {
      paddingHorizontal: theme.spacing.md,
      paddingBottom: theme.spacing.xl,
    },
    dateHeader: {
      ...theme.typography.caption,
      fontWeight: '700',
      color: theme.colors.textSecondary,
      paddingTop: theme.spacing.md,
      paddingBottom: theme.spacing.xs,
    },
    activityRow: {
      minHeight: 72,
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.sm,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.colors.border,
    },
    operationIcon: {
      width: 40,
      height: 40,
      borderRadius: theme.radii.pill,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.surfaceMuted,
    },
    operationGlyph: {
      fontSize: 19,
      lineHeight: 22,
      fontWeight: '700',
      color: theme.colors.textSecondary,
    },
    operationGlyphPositive: {
      color: theme.colors.positive,
    },
    operationGlyphNegative: {
      color: theme.colors.negative,
    },
    activityIdentity: {
      flex: 1,
      gap: 2,
    },
    activityTitle: {
      ...theme.typography.label,
      fontWeight: '700',
      color: theme.colors.textPrimary,
    },
    activitySecondary: {
      ...theme.typography.caption,
      color: theme.colors.textSecondary,
    },
    activityTime: {
      fontSize: 10,
      lineHeight: 13,
      fontWeight: '400',
      color: theme.colors.textTertiary,
    },
    activityAmount: {
      maxWidth: '40%',
      ...theme.typography.caption,
      fontWeight: '700',
      color: theme.colors.surfaceStrong,
      textAlign: 'right',
    },
    amountPositive: {
      color: theme.colors.positive,
    },
    amountNegative: {
      color: theme.colors.negative,
    },
    statePanel: {
      minHeight: 280,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: theme.spacing.xl,
      gap: theme.spacing.sm,
    },
    emptyIcon: {
      width: 56,
      height: 56,
      borderRadius: theme.radii.pill,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.surfaceMuted,
    },
    emptyGlyph: {
      fontSize: 26,
      color: theme.colors.textTertiary,
    },
    stateTitle: {
      ...theme.typography.sectionTitle,
      color: theme.colors.textPrimary,
      textAlign: 'center',
    },
    stateMessage: {
      ...theme.typography.caption,
      color: theme.colors.textSecondary,
      textAlign: 'center',
    },
    stateAction: {
      minHeight: 36,
      borderRadius: theme.radii.pill,
      paddingHorizontal: theme.spacing.md,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.surfaceMuted,
    },
    stateActionText: {
      ...theme.typography.caption,
      fontWeight: '700',
      color: theme.colors.actionPrimaryPressed,
    },
    loadMoreButton: {
      minHeight: 52,
      alignItems: 'center',
      justifyContent: 'center',
    },
    loadMoreText: {
      ...theme.typography.caption,
      fontWeight: '700',
      color: theme.colors.actionPrimaryPressed,
    },
    loadMoreError: {
      ...theme.typography.caption,
      color: theme.colors.negative,
      textAlign: 'center',
      paddingVertical: theme.spacing.sm,
    },
    pressed: {
      opacity: 0.68,
    },
    disabled: {
      opacity: 0.56,
    },
  });
}
