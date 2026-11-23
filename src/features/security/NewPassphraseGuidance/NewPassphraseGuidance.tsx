import React from 'react';
import { Pressable, Text, View } from 'react-native';
import type { NewProtectionPassphraseAssessment } from '../../../capabilities/application-security/newPassphrasePolicy';
import { useLocalization } from '../../../locale';
import { useThemedStyles } from '../../../ui/theme';
import { createStyles } from './styles';

export function NewPassphraseGuidance({
  assessment,
  accepted,
  disabled,
  onAccept,
}: Readonly<{
  assessment: NewProtectionPassphraseAssessment;
  accepted: boolean;
  disabled: boolean;
  onAccept(value: boolean): void;
}>) {
  const { t } = useLocalization();
  const styles = useThemedStyles(createStyles);
  return (
    <View style={styles.content}>
      <Text style={styles.body}>{t('passphrase.policy.recommendation')}</Text>
      {assessment.rejection && assessment.rejection !== 'empty' ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {t(`passphrase.policy.${assessment.rejection}`)}
        </Text>
      ) : null}
      {!assessment.meetsMinimum && !assessment.rejection ? (
        <>
          <Text style={styles.body}>{t('passphrase.policy.shortRisk')}</Text>
          <Pressable
            accessibilityRole="checkbox"
            accessibilityState={{ checked: accepted, disabled }}
            disabled={disabled}
            onPress={() => onAccept(!accepted)}
            style={styles.button}
          >
            <Text style={styles.body}>
              {accepted ? '☑ ' : '☐ '}
              {t('passphrase.policy.acceptRisk')}
            </Text>
          </Pressable>
        </>
      ) : null}
    </View>
  );
}
