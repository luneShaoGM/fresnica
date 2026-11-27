import React from 'react';
import { AccountAvatar } from '../../contacts/AccountAvatar';
import { Pressable, Text, View } from 'react-native';

import { SmallChevron } from '@ui/components/SmallIcons';
import { useAppTheme, useThemedStyles } from '@ui/theme';

import { createStyles } from '../styles';

type Props = Readonly<{
  label: string;
  maskedAddress: string;
  address?: string;
  active?: boolean;
  accountKindLabel: string;
  isReadOnly: boolean;
  pickerVisible: boolean;
  onOpenAccountPicker: () => void;
}>;

export function AccountSummary({
  label,
  maskedAddress,
  address,
  active = true,
  accountKindLabel,
  isReadOnly,
  pickerVisible,
  onOpenAccountPicker,
}: Props) {
  const styles = useThemedStyles(createStyles);
  const theme = useAppTheme();
  return (
    <Pressable
      accessibilityHint="Switch to another configured account"
      accessibilityLabel={`Current account ${label}, ${accountKindLabel}`}
      accessibilityRole="button"
      accessibilityState={{ expanded: pickerVisible }}
      onPress={onOpenAccountPicker}
      style={({ pressed }) => [styles.accountSwitchContainer, pressed ? styles.pressed : undefined]}
    >
      {address ? <AccountAvatar address={address} active={active} /> : null}
      <View style={styles.accountTextBlock}>
        <Text numberOfLines={1} style={styles.accountLabel}>
          {label}
        </Text>
        <Text numberOfLines={1} selectable style={styles.accountAddress}>
          {maskedAddress}
        </Text>
      </View>
      {isReadOnly ? (
        <Text accessibilityLabel={accountKindLabel} style={styles.accountKindBadge}>
          {accountKindLabel === 'Contract account' ? 'Contract' : 'Read-only'}
        </Text>
      ) : null}
      <SmallChevron color={theme.colors.textSecondary} up={pickerVisible} />
    </Pressable>
  );
}
