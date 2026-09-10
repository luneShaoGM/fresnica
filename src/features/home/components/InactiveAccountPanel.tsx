import React from 'react';
import {Pressable, Text, View} from 'react-native';

import {useThemedStyles} from '@ui/theme';

import {createStyles} from '../styles';

type Props = Readonly<{
  address: string;
  onRefresh: () => void;
}>;

export function InactiveAccountPanel({address, onRefresh}: Props) {
  const styles = useThemedStyles(createStyles);
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

      <Text selectable style={styles.inactiveAddress}>{address}</Text>

      <Pressable
        accessibilityRole="button"
        onPress={onRefresh}
        style={({pressed}) => [styles.retryButton, pressed ? styles.pressed : undefined]}>
        <Text style={styles.retryText}>Refresh account</Text>
      </Pressable>
    </View>
  );
}
