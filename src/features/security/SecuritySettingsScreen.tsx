import React from 'react';
import { Text, View } from 'react-native';
import { Screen, Button } from '@ui/components';
import { useThemedStyles } from '@ui/theme';
import { useLocalization } from '../../locale';
import { createStyles } from './SessionUnlockScreen/styles';

type Props = Readonly<{ onClose: () => void }>;
export function SecuritySettingsScreen({ onClose }: Props) {
  const { t } = useLocalization();
  const styles = useThemedStyles(createStyles);
  return (
    <Screen>
      <View style={styles.content}>
        <Text accessibilityRole="header" style={styles.title}>
          {t('security.policy.title')}
        </Text>
        <Text style={styles.body}>{t('session.explanation')}</Text>
        <Text style={styles.body}>{t('security.policy.keys')}</Text>
        <Button label={t('common.back')} onPress={onClose} />
      </View>
    </Screen>
  );
}
