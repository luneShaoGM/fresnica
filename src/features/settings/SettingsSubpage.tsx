import React from 'react';
import { ScrollView, View } from 'react-native';
import { Screen } from '@ui/components';
import { CenteredPageHeader } from '@ui/components/CenteredPageHeader/CenteredPageHeader';
import { useThemedStyles } from '@ui/theme';
import { useLocalization } from '../../locale';
import { createStyles } from './SettingsSubpage.styles';

export function SettingsSubpage({
  title,
  onBack,
  children,
  scrollable = true,
}: Readonly<{ title: string; onBack: () => void; children: React.ReactNode; scrollable?: boolean }>) {
  const styles = useThemedStyles(createStyles);
  const { t } = useLocalization();
  return (
    <Screen scrollable={false} contentInset="none">
      <CenteredPageHeader title={title} backLabel={t('common.back')} onBack={onBack} />
      {scrollable ? (
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.content, styles.fill]}>{children}</View>
      )}
    </Screen>
  );
}
