import React from 'react';
import { Image, View } from 'react-native';
import { useAppTheme, useThemedStyles } from '@ui/theme';
import { createStyles } from './styles';

// User-authorized, locally bundled default Token artwork. Never derive branding from a token address.
export function TokenFallbackAvatar({ small = false }: Readonly<{ small?: boolean }>) {
  const styles = useThemedStyles(createStyles);
  const theme = useAppTheme();
  const source =
    theme.statusBarContent === 'light'
      ? require('./assets/unknownTokenLight.png')
      : require('./assets/unknownToken.png');
  return (
    <View
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.avatar, small ? styles.small : undefined]}
    >
      <Image resizeMode="contain" source={source} style={styles.image} />
    </View>
  );
}
