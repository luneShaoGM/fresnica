/**
 * Source port: Stellar/src/components/General/Spacer/Spacer.tsx
 */
import React from 'react';
import {View} from 'react-native';

import styles from './styles';

type Props = Readonly<{
  size?: number;
}>;

export function StellarSpacer({size = 10}: Props) {
  return <View style={[styles.container, {marginTop: size}]} />;
}
