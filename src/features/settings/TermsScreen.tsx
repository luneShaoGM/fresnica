import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useLocalization } from '../../locale';
import { useThemedStyles } from '../../ui/theme';
import type { AppTheme } from '../../ui/theme';

import { SettingsSubpage } from './SettingsSubpage';
import agreement from './serviceAgreementContent.json';

export function TermsScreen({
  onBack,
  supportError = false,
}: Readonly<{ onBack: () => void; supportError?: boolean }>) {
  const { t } = useLocalization();
  const styles = useThemedStyles(createStyles);
  return (
    <SettingsSubpage title={t(supportError ? 'settings.support' : 'settings.terms')} onBack={onBack}>
      {supportError ? (
        <Text style={styles.paragraph}>
          Unable to open the official support website. Please try again when a browser is available.
        </Text>
      ) : (
        <View style={styles.document}>
          <Text style={styles.version}>Agreement version: {agreement.version}</Text>
          {agreement.sections.map((section, index) => (
            <Text
              key={index}
              accessibilityRole={section.kind === 'heading' ? 'header' : 'text'}
              style={section.kind === 'heading' ? styles.heading : styles.paragraph}
            >
              {section.text}
            </Text>
          ))}
        </View>
      )}
    </SettingsSubpage>
  );
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    document: { paddingTop: theme.spacing.md, gap: theme.spacing.md },
    version: { ...theme.typography.caption, color: theme.colors.textSecondary },
    heading: { ...theme.typography.title, color: theme.colors.textPrimary },
    paragraph: { ...theme.typography.body, color: theme.colors.textPrimary, lineHeight: 24 },
  });
}
