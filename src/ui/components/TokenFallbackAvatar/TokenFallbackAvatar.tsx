import React from 'react';
import { Image, View } from 'react-native';
import { styles } from './styles';

// Missing, rejected and unavailable external Token images all use the same
// approved ImageUnknownTrustLineLight artwork, independent of app theme.
export function TokenFallbackAvatar({ small = false, size }: Readonly<{ small?: boolean; size?: number }>) {
  return (
    <View
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.avatar, small ? styles.small : undefined, size === undefined ? undefined : { width: size, height: size }]}
    >
      <Image resizeMode="contain" source={require('./assets/unknownTokenLight.png')} style={styles.image} />
    </View>
  );
}
