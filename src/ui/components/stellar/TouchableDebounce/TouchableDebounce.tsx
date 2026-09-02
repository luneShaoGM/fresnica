import React, {useRef} from 'react';
import {
  type GestureResponderEvent,
  TouchableOpacity,
  type TouchableOpacityProps,
} from 'react-native';

type Props = Readonly<TouchableOpacityProps>;

const PRESS_WINDOW_MS = 500;

/**
 * Source port: Stellar/src/components/General/TouchableDebounce/TouchableDebounce.tsx
 *
 * The donor uses lodash debounce with `{leading: true, trailing: false}`. Fresnica
 * preserves that 500ms interaction contract with a timestamp gate so the
 * presentation primitive does not add lodash as a runtime dependency.
 */
export function StellarTouchableDebounce({onPress, ...props}: Props) {
  const lastPressAt = useRef(0);

  const handlePress = (event: GestureResponderEvent) => {
    const now = Date.now();
    if (now - lastPressAt.current < PRESS_WINDOW_MS) {
      return;
    }

    lastPressAt.current = now;
    onPress?.(event);
  };

  return <TouchableOpacity {...props} onPress={handlePress} />;
}
