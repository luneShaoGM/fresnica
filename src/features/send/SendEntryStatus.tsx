import React from 'react';
import { ActivityIndicator, ScrollView, Text } from 'react-native';

import { NativeStateView } from '@ui/components/NativeStateView';

import { useLocalization } from '../../locale';
import { useAppTheme, useThemedStyles } from '../../ui/theme';
import { createSendStatusStyles } from './styles';

export function SendEntryStatus({
  state,
}: Readonly<{ state: { kind: 'loading' } | { kind: 'blocked'; title: string; description: string } }>) {
  const theme = useAppTheme();
  const { t } = useLocalization();
  const styles = useThemedStyles(createSendStatusStyles);

  return (
    <ScrollView contentContainerStyle={styles.messageBody}>
      {state.kind === 'loading' ? (
        <>
          <ActivityIndicator color={theme.colors.actionPrimary} />
          <Text accessibilityLiveRegion="polite" style={styles.messageText}>
            {t('send.loading.balances')}
          </Text>
        </>
      ) : (
        <NativeStateView title={state.title} description={state.description} tone="error" />
      )}
    </ScrollView>
  );
}
