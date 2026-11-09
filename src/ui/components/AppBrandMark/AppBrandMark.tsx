import React from 'react';
import { Image } from 'react-native';
import { styles } from './styles';

// Local owner-approved rocket mark; native package selection handles device density.
export function AppBrandMark() {
  return (
    <Image
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      resizeMode="contain"
      source={require('../../assets/brand/fresnicaMark.png')}
      style={styles.mark}
    />
  );
}
