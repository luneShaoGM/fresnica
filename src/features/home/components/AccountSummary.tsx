import React from 'react';
import {Pressable, Text, View} from 'react-native';

import {useThemedStyles} from '@ui/theme';

import {createStyles} from '../styles';

type Props = Readonly<{
  label: string;
  maskedAddress: string;
  accountKindLabel: string;
  accountCount: number;
  onSwitchAccount: () => void;
  onAddAccount: () => void;
}>;

export function AccountSummary({
  label,
  maskedAddress,
  accountKindLabel,
  accountCount,
  onSwitchAccount,
  onAddAccount,
}: Props) {
  const styles = useThemedStyles(createStyles);
  return (
    <>
      <Pressable
        accessibilityHint="Switch to another configured account"
        accessibilityLabel={`Current account ${label}`}
        accessibilityRole="button"
        onPress={onSwitchAccount}
        style={({pressed}) => [
          styles.accountSwitchContainer,
          pressed ? styles.pressed : undefined,
        ]}>
        <View style={styles.accountTextBlock}>
          <Text numberOfLines={1} style={styles.accountLabel}>{label}</Text>
          <Text numberOfLines={1} selectable style={styles.accountAddress}>{maskedAddress}</Text>
        </View>
      </Pressable>

      <View style={styles.accountMetaRow}>
        <Text style={styles.accountMeta}>{accountKindLabel}</Text>
        <Pressable
          accessibilityRole="button"
          onPress={onAddAccount}
          style={({pressed}) => [styles.addAccountButton, pressed ? styles.pressed : undefined]}>
          <Text style={styles.addAccountText}>
            {accountCount === 1 ? '+ Add account' : `${accountCount} accounts · Add`}
          </Text>
        </Pressable>
      </View>
    </>
  );
}
