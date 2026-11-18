import React from 'react';
import { Text, View } from 'react-native';
import { useThemedStyles } from '@ui/theme';
import { NativeButton } from '../NativeButton';
import { createStyles } from './styles';

type Props = Readonly<{ title: string; backLabel: string; onBack: () => void }>;

export function CenteredPageHeader({ title, backLabel, onBack }: Props) {
  const styles = useThemedStyles(createStyles);

  return (
    <View style={styles.header}>
      <View style={styles.side}>
        <NativeButton label={backLabel} onPress={onBack} size="sm" variant="quiet" />
      </View>
      <Text accessibilityRole="header" style={styles.title}>
        {title}
      </Text>
      <View style={styles.side} />
    </View>
  );
}
