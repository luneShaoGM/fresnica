import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useLocalization } from '../../locale';
import { useThemedStyles } from '../../ui/theme';
import type { AppTheme } from '../../ui/theme';

import { SettingsSubpage } from './SettingsSubpage';
import { resolveTermsDocument } from './termsDocument';

// Historical reference only; an approved replacement must set its own version.
export const REFERENCE_AGREEMENT_VERSION = '20260713';

export function TermsScreen({
  onBack,
  supportError = false,
  approvedDocument,
}: Readonly<{ onBack: () => void; supportError?: boolean; approvedDocument?: unknown }>) {
  const { t } = useLocalization();
  const styles = useThemedStyles(createStyles);
  const documentState = resolveTermsDocument(approvedDocument);

  return (
    <SettingsSubpage title={t(supportError ? 'settings.support' : 'settings.terms')} onBack={onBack}>
      {supportError ? (
        <Text style={styles.paragraph}>{t('settings.supportOpenFailed')}</Text>
      ) : documentState.status === 'ready' ? (
        <View style={styles.document}>
          <Text accessibilityRole="header" style={styles.title}>
            {documentState.document.title}
          </Text>
          <Text style={styles.version}>
            {t('settings.termsDocumentVersion')}: {documentState.document.version}
          </Text>
          {documentState.document.sections.map((section, index) => (
            <Text
              key={index}
              accessibilityRole={section.kind === 'heading' ? 'header' : 'text'}
              style={section.kind === 'heading' ? styles.heading : styles.paragraph}
            >
              {section.text}
            </Text>
          ))}
          <Text style={styles.version}>{t('settings.termsNotAccepted')}</Text>
        </View>
      ) : (
        <View style={styles.document}>
          <Text style={styles.version}>
            {t('settings.termsReferenceVersion')}: {REFERENCE_AGREEMENT_VERSION}
          </Text>
          <Text style={styles.paragraph}>
            {t(documentState.status === 'invalid' ? 'settings.termsInvalidDocument' : 'settings.termsPendingApproval')}
          </Text>
          <Text style={styles.paragraph}>{t('settings.termsNotAccepted')}</Text>
        </View>
      )}
    </SettingsSubpage>
  );
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    document: { paddingTop: theme.spacing.md, gap: theme.spacing.md },
    title: { ...theme.typography.title, color: theme.colors.textPrimary },
    version: { ...theme.typography.caption, color: theme.colors.textSecondary },
    heading: { ...theme.typography.title, color: theme.colors.textPrimary, marginTop: theme.spacing.md },
    paragraph: { ...theme.typography.body, color: theme.colors.textPrimary, lineHeight: 24 },
  });
}
