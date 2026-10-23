import React from 'react';
import { Pressable, Text, View } from 'react-native';

import { useThemedStyles } from '@ui/theme';

import { createStyles } from '../styles';

type Props = Readonly<{
  accountKindLabel: string;
  accountCount: number;
  onAddAccount: () => void;
}>;

export function AccountSummary({ accountKindLabel, accountCount, onAddAccount }: Props) {
  const styles = useThemedStyles(createStyles);
  return (
    <View style={styles.accountMetaRow}>
      <Text style={styles.accountMeta}>{accountKindLabel}</Text>
      <Pressable
        accessibilityRole="button"
        onPress={onAddAccount}
        style={({ pressed }) => [styles.addAccountButton, pressed ? styles.pressed : undefined]}
      >
        <Text style={styles.addAccountText}>
          {accountCount === 1 ? '+ Add account' : `${accountCount} accounts · Add`}
        </Text>
      </Pressable>
    </View>
  );
}
