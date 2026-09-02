import React from 'react';
import {Text, View} from 'react-native';

import {StellarTouchableDebounce} from '../../../ui/components/stellar';
import {styles} from '../styles';

type Props = Readonly<{
  networkLabel: string;
  onPress?: () => void;
}>;

/**
 * Presentation adaptation of the donor NetworkSwitchButton.
 *
 * Fresnica currently ships with a single configured Stellar Testnet. The donor
 * switcher entry stays visible, but it is intentionally disabled until network
 * selection is a supported product capability.
 */
export function NetworkSwitchButton({networkLabel, onPress}: Props) {
  const enabled = typeof onPress === 'function';

  return (
    <StellarTouchableDebounce
      accessibilityHint={
        enabled
          ? 'Change network'
          : 'Network switching is unavailable in the current product configuration'
      }
      accessibilityRole="button"
      accessibilityState={{disabled: !enabled}}
      activeOpacity={0.8}
      disabled={!enabled}
      onPress={onPress}
      style={[
        styles.networkButton,
        !enabled ? styles.networkButtonDisabled : undefined,
      ]}>
      <View style={styles.networkDot} />
      <Text numberOfLines={1} style={styles.networkText}>
        {networkLabel}
      </Text>
    </StellarTouchableDebounce>
  );
}
