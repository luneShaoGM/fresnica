import React from 'react';
import Svg, { Circle, Path } from 'react-native-svg';

export function SmallChevron({ color, up = false }: Readonly<{ color: string; up?: boolean }>): React.JSX.Element {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" accessible={false}>
      <Path
        d={up ? 'm6 15 6-6 6 6' : 'm6 9 6 6 6-6'}
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function SmallClock({ color }: Readonly<{ color: string }>): React.JSX.Element {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" accessible={false}>
      <Circle cx="12" cy="12" r="9" stroke={color} strokeWidth={2} />
      <Path d="M12 7v5l3 2" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function SmallLock({ color }: Readonly<{ color: string }>): React.JSX.Element {
  return (
    <Svg width={12} height={12} viewBox="0 0 24 24" fill="none" accessible={false}>
      <Path
        d="M7 10V7a5 5 0 0 1 10 0v3M5 10h14v11H5z"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
