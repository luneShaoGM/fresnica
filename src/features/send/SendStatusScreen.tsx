import React from 'react';
import { ActivityIndicator, Text, View } from 'react-native';

import { Screen } from '@ui/components';
import { NativeButton } from '@ui/components/NativeButton';
import { NativeStateView } from '@ui/components/NativeStateView';

import { useLocalization } from '../../locale';
import { useAppTheme, useThemedStyles } from '../../ui/theme';
import { createSendStatusStyles } from './styles';

export function SendStatusScreen({
  title,
  message,
  onBack,
  loading = false,
}: Readonly<{ title: string; message: string; onBack: () => void; loading?: boolean }>) {
  const theme = useAppTheme();
  const { t } = useLocalization();
  const styles = useThemedStyles(createSendStatusStyles);

  return (
    <Screen scrollable={false} contentInset="none">
      <View style={styles.header}>
        <View style={styles.headerSide}>
          <NativeButton label={t('common.back')} onPress={onBack} size="sm" variant="quiet" />
        </View>
        <Text style={styles.headerTitle}>Send</Text>
        <View style={styles.headerSide} />
      </View>
      <View style={styles.messageBody}>
        {loading ? (
          <>
            <ActivityIndicator color={theme.colors.actionPrimary} />
            <Text style={styles.messageTitle}>{title}</Text>
            <Text style={styles.messageText}>{message}</Text>
          </>
        ) : (
          <NativeStateView title={title} description={message} tone="error" />
        )}
      </View>
    </Screen>
  );
}
