import React from 'react';
import { View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { useAppTheme, useThemedStyles } from '@ui/theme';
import { createStyles } from './styles';

// A local, neutral unknown-asset mark. No remote request or identity-derived logo.
export function TokenFallbackAvatar({ small = false }: Readonly<{ small?: boolean }>) {
  const styles = useThemedStyles(createStyles);
  const theme = useAppTheme();
  return (
    <View
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.avatar, small ? styles.small : undefined]}
    >
      <Svg width="75%" height="75%" viewBox="0 0 40 40">
        <Circle cx="20" cy="20" r="15" fill="none" stroke={theme.colors.textTertiary} strokeWidth="2.4" />
        <Path
          d="M16 15c0-2.4 1.8-4 4.2-4 2.5 0 4.2 1.5 4.2 3.8 0 2.3-3.7 3.4-3.7 5.5v1"
          fill="none"
          stroke={theme.colors.textTertiary}
          strokeWidth="2.4"
          strokeLinecap="round"
        />
        <Circle cx="20.7" cy="27" r="1.4" fill={theme.colors.textTertiary} />
      </Svg>
    </View>
  );
}
