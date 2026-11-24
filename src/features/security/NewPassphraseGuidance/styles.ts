import type { AppTheme } from '../../../ui/theme';
export const createStyles = (theme: AppTheme) => ({
  content: { gap: theme.spacing.sm },
  body: { color: theme.colors.textPrimary, fontSize: 14, lineHeight: 20 },
  error: { color: theme.colors.negative, fontSize: 14, lineHeight: 20 },
  button: { paddingVertical: 12 },
});
