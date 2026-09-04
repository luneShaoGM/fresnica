import React, {useEffect, useRef} from 'react';
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
 * preserves the same leading call plus resettable 500ms quiet window without
 * adding lodash only for this presentation helper.
 */
export function StellarTouchableDebounce({onPress, ...props}: Props) {
  const isCoolingDown = useRef(false);
  const releaseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (releaseTimer.current !== null) {
        clearTimeout(releaseTimer.current);
      }
    },
    [],
  );

  const handlePress = (event: GestureResponderEvent) => {
    const shouldInvoke = !isCoolingDown.current;
    isCoolingDown.current = true;

    if (releaseTimer.current !== null) {
      clearTimeout(releaseTimer.current);
    }
    releaseTimer.current = setTimeout(() => {
      isCoolingDown.current = false;
      releaseTimer.current = null;
    }, PRESS_WINDOW_MS);

    if (shouldInvoke) {
      onPress?.(event);
    }
  };

  return <TouchableOpacity {...props} onPress={handlePress} />;
}
