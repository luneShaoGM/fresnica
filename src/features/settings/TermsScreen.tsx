import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useLocalization } from '../../locale';
import { useThemedStyles } from '../../ui/theme';
import type { AppTheme } from '../../ui/theme';

import { SettingsSubpage } from './SettingsSubpage';

// The reference agreement cannot be distributed until its rights and product claims are approved.
export const REFERENCE_AGREEMENT_VERSION = '20260713';

export function TermsScreen({
  onBack,
  supportError = false,
}: Readonly<{ onBack: () => void; supportError?: boolean }>) {
  const { t } = useLocalization();
  const styles = useThemedStyles(createStyles);
  return (
    <SettingsSubpage title={t(supportError ? 'settings.support' : 'settings.terms')} onBack={onBack}>
      {supportError ? (
        <Text style={styles.paragraph}>{t('settings.supportOpenFailed')}</Text>
      ) : (
        <View style={styles.document}>
          <Text style={styles.version}>
            {t('settings.termsReferenceVersion')}: {REFERENCE_AGREEMENT_VERSION}
          </Text>
          <Text style={styles.paragraph}>{t('settings.termsPendingApproval')}</Text>
          <Text style={styles.paragraph}>{t('settings.termsNotAccepted')}</Text>
        </View>
      )}
    </SettingsSubpage>
  );
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    document: { paddingTop: theme.spacing.md, gap: theme.spacing.md },
    version: { ...theme.typography.caption, color: theme.colors.textSecondary },
    paragraph: { ...theme.typography.body, color: theme.colors.textPrimary, lineHeight: 24 },
  });
}
