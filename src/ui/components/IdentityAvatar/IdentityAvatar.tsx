import React from 'react';
import { View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { useAppTheme, useThemedStyles } from '@ui/theme';
import { createStyles } from './styles';

export function identityAvatarPattern(identity: string): readonly boolean[] {
  let hash = 0;
  for (let index = 0; index < identity.length; index += 1) {
    hash = (hash * 31 + identity.charCodeAt(index)) % 2147483647;
  }
  return Array.from({ length: 25 }, (_, index) => {
    const column = index % 5;
    const bit = Math.floor(index / 5) * 3 + Math.min(column, 4 - column);
    return Math.floor(hash / 2 ** bit) % 2 === 1;
  });
}

export function IdentityAvatar({
  identity,
  native = false,
  small = false,
}: Readonly<{
  identity: string;
  native?: boolean;
  small?: boolean;
}>) {
  const styles = useThemedStyles(createStyles);
  const theme = useAppTheme();
  return (
    <View
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.avatar, small ? styles.small : undefined]}
    >
      {native ? (
        <Svg width="75%" height="75%" viewBox="0 0 40 40">
          <Circle cx="20" cy="20" r="11" fill="none" stroke={theme.colors.actionPrimaryPressed} strokeWidth="3" />
          <Path
            d="M6 19L33 10M7 30L34 21"
            fill="none"
            stroke={theme.colors.actionPrimaryPressed}
            strokeWidth="3.5"
            strokeLinecap="round"
          />
        </Svg>
      ) : (
        <Svg width="70%" height="70%" viewBox="0 0 5 5">
          <Path
            fill={theme.colors.actionPrimaryPressed}
            d={identityAvatarPattern(identity)
              .map((filled, index) => (filled ? `M${index % 5} ${Math.floor(index / 5)}h1v1h-1Z` : ''))
              .join('')}
          />
        </Svg>
      )}
    </View>
  );
}
