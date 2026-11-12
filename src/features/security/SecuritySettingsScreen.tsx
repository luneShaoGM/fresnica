import React from 'react';
import { Text, View } from 'react-native';
import { Screen, Button } from '@ui/components';
import { useThemedStyles } from '@ui/theme';
import { useLocalization } from '../../locale';
import { createStyles } from './SessionUnlockScreen/styles';

type Props = Readonly<{
  onClose: () => void;
  onChangePassphrase?: () => void;
  accounts?: readonly { id: string; label: string; address: string }[];
  onOpenRecovery?: (accountId: string) => void;
}>;
export function SecuritySettingsScreen({ onClose, onChangePassphrase, accounts = [], onOpenRecovery }: Props) {
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
        {onChangePassphrase ? <Button label={t('recovery.change')} onPress={onChangePassphrase} /> : null}
        {onOpenRecovery
          ? accounts.map(account => (
              <Button
                key={account.id}
                label={`${t('recovery.title')}: ${account.label || account.address}`}
                onPress={() => onOpenRecovery(account.id)}
                variant="secondary"
              />
            ))
          : null}
        <Button label={t('common.back')} onPress={onClose} />
      </View>
    </Screen>
  );
}
