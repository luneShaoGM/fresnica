import React from 'react';
import {Screen, type ScreenProps} from '@fresnica/ui-native';

// The App still owns safe area and system bars. This facade is only the
// library scroll/content surface.
export function NativeScreen(props: ScreenProps) {
  return <Screen {...props} />;
}
