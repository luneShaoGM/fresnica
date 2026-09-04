import React from 'react';
import {
  ActivityIndicator,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import {stellarColors} from '../../../theme/stellar';

type LoadingIndicatorColor = 'dark' | 'light' | 'default';

type Props = Readonly<{
  color?: LoadingIndicatorColor;
  size?: number | 'small' | 'large';
  style?: StyleProp<ViewStyle>;
  animating?: boolean;
}>;

/**
 * Source port: Stellar/src/components/General/LoadingIndicator/LoadingIndicator.tsx
 *
 * The donor resolves `default` through the active StyleService contrast color.
 * Fresnica currently exposes one canonical light presentation theme, so its
 * source-equivalent contrast value is black until theme selection is a product
 * requirement.
 */
export function StellarLoadingIndicator({
  color = 'default',
  size = 'small',
  style,
  animating = true,
}: Props) {
  const indicatorColor =
    color === 'light' ? stellarColors.white : stellarColors.black;

  return (
    <ActivityIndicator
      animating={animating}
      color={indicatorColor}
      size={size}
      style={style}
    />
  );
}
