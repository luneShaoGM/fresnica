import React from 'react';
import { ScrollView, Text, View } from 'react-native';
import { Screen } from '@ui/components';
import { NativeButton } from '@ui/components/NativeButton';
import { useThemedStyles } from '@ui/theme';
import { useLocalization } from '../../locale';
import { createStyles } from './SettingsSubpage.styles';

export function SettingsSubpage({
  title,
  onBack,
  children,
}: Readonly<{ title: string; onBack: () => void; children: React.ReactNode }>) {
  const styles = useThemedStyles(createStyles);
  const { t } = useLocalization();
  return (
    <Screen scrollable={false} contentInset="none">
      <View style={styles.header}>
        <View style={styles.side}>
          <NativeButton label={t('common.back')} onPress={onBack} size="sm" variant="quiet" />
        </View>
        <Text accessibilityRole="header" style={styles.title}>
          {title}
        </Text>
        <View style={styles.side} />
      </View>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {children}
      </ScrollView>
    </Screen>
  );
}
