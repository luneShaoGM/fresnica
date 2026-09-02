import React from 'react';
import {Text, View} from 'react-native';

import {StellarTouchableDebounce} from '../../../ui/components/stellar';
import {styles} from '../styles';

type Props = Readonly<{
  address: string;
  onRefresh: () => void;
}>;

/**
 * Presentation adaptation of
 * Stellar/src/components/Modules/InactiveAccount/InactiveAccount.tsx.
 *
 * The donor also exposes QR sharing and Friendbot funding. Those actions depend
 * on product contracts not owned by M2, so M2 keeps the activation explanation
 * and refresh path without copying donor services.
 */
export function InactiveAccount({address, onRefresh}: Props) {
  return (
    <View style={styles.inactiveContainer} testID="not-activated-account-container">
      <Text style={styles.inactiveTitle}>Your account is not activated</Text>

      <View style={styles.inactiveStep}>
        <Text style={styles.inactiveStepTitle}>1. Fund this Stellar account</Text>
        <Text style={styles.inactiveStepText}>
          Send XLM to the public address below on the configured network. Fresnica
          will not create a local balance until Horizon reports the account.
        </Text>
      </View>

      <View style={styles.inactiveStep}>
        <Text style={styles.inactiveStepTitle}>2. Refresh after funding</Text>
        <Text style={styles.inactiveStepText}>
          Once the account exists on-ledger, refresh Home to load its current assets.
        </Text>
      </View>

      <Text selectable style={styles.inactiveAddress}>
        {address}
      </Text>

      <StellarTouchableDebounce
        accessibilityRole="button"
        activeOpacity={0.7}
        onPress={onRefresh}
        style={styles.retryButton}>
        <Text style={styles.retryText}>Refresh account</Text>
      </StellarTouchableDebounce>
    </View>
  );
}
