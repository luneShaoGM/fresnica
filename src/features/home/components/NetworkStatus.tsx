import React from 'react';
import {Pressable, Text} from 'react-native';

import {useThemedStyles} from '@ui/theme';

import {createStyles} from '../styles';

type Props = Readonly<{
  networkLabel: string;
  onPress?: () => void;
}>;

export function NetworkStatus({networkLabel, onPress}: Props) {
  const styles = useThemedStyles(createStyles);
  const enabled = typeof onPress === 'function';

  return (
    <Pressable
      accessibilityHint={
        enabled
          ? 'Change network'
          : 'Network switching is unavailable in the current product configuration'
      }
      accessibilityLabel={`Network ${networkLabel}`}
      accessibilityRole="button"
      accessibilityState={{disabled: !enabled}}
      disabled={!enabled}
      onPress={onPress}
      style={({pressed}) => [
        styles.networkButton,
        !enabled ? styles.networkButtonDisabled : undefined,
        pressed ? styles.pressed : undefined,
      ]}>
      <Text numberOfLines={1} style={styles.networkText}>Network: {networkLabel}</Text>
    </Pressable>
  );
}
