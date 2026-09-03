import {StyleSheet} from 'react-native';

import type {AppTheme} from '../../ui/theme';

export function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    header: {
      minHeight: 58,
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: theme.spacing.lg,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.colors.border,
    },
    backButton: {
      paddingVertical: theme.spacing.sm,
      paddingRight: theme.spacing.md,
    },
    backText: {
      ...theme.typography.label,
      color: theme.colors.actionPrimary,
    },
    title: {
      ...theme.typography.sectionTitle,
      color: theme.colors.textPrimary,
    },
    content: {
      paddingHorizontal: theme.spacing.lg,
      paddingTop: theme.spacing.md,
      paddingBottom: theme.spacing.xxl,
    },
    note: {
      ...theme.typography.caption,
      color: theme.colors.textSecondary,
      marginBottom: theme.spacing.md,
    },
    row: {
      minHeight: 66,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: theme.spacing.sm,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.colors.border,
    },
    labelColumn: {
      flex: 1,
    },
    localName: {
      ...theme.typography.label,
      color: theme.colors.textPrimary,
    },
    englishName: {
      ...theme.typography.caption,
      color: theme.colors.textTertiary,
      marginTop: theme.spacing.xs,
    },
    statusColumn: {
      alignItems: 'flex-end',
      maxWidth: 150,
    },
    current: {
      ...theme.typography.caption,
      color: theme.colors.positive,
      fontWeight: '700',
    },
    translated: {
      ...theme.typography.caption,
      color: theme.colors.actionPrimary,
      textAlign: 'right',
    },
    fallback: {
      ...theme.typography.caption,
      color: theme.colors.textSecondary,
      textAlign: 'right',
    },
    pressed: {
      opacity: 0.62,
    },
  });
}
