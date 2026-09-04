import React from 'react';
import {Text, View} from 'react-native';

import {StellarTouchableDebounce} from '../../../ui/components/stellar';
import {styles} from '../styles';

type Props = Readonly<{
  label: string;
  maskedAddress: string;
  accountKindLabel: string;
  accountCount: number;
  onSwitchAccount: () => void;
  onAddAccount: () => void;
}>;

/**
 * Presentation adaptation of
 * Stellar/src/components/Modules/AccountSwitchElement/AccountSwitchElement.tsx.
 *
 * The donor opens a repository-backed switcher overlay. Fresnica keeps the
 * selected account in `app/navigation` and only passes public UI intents here.
 */
export function AccountSwitchElement({
  label,
  maskedAddress,
  accountKindLabel,
  accountCount,
  onSwitchAccount,
  onAddAccount,
}: Props) {
  return (
    <>
      <StellarTouchableDebounce
        accessibilityHint="Switch to another configured account"
        accessibilityLabel={`Current account ${label}`}
        accessibilityRole="button"
        activeOpacity={0.7}
        onPress={onSwitchAccount}
        style={styles.accountSwitchContainer}>
        <View style={styles.accountTextBlock}>
          <Text numberOfLines={1} style={styles.accountLabel}>
            {label}
          </Text>
          <Text numberOfLines={1} selectable style={styles.accountAddress}>
            {maskedAddress}
          </Text>
        </View>
        <Text accessibilityElementsHidden style={styles.switchChevron}>
          ⌄
        </Text>
      </StellarTouchableDebounce>

      <View style={styles.accountMetaRow}>
        <Text style={styles.accountMeta}>{accountKindLabel}</Text>
        <StellarTouchableDebounce
          accessibilityRole="button"
          activeOpacity={0.7}
          onPress={onAddAccount}
          style={styles.addAccountButton}>
          <Text style={styles.addAccountText}>
            {accountCount === 1 ? '+ Add account' : `${accountCount} accounts · Add`}
          </Text>
        </StellarTouchableDebounce>
      </View>
    </>
  );
}
