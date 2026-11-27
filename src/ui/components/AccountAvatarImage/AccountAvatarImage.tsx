import React from 'react';
import { Image, View } from 'react-native';
import Svg, { Circle, Path, SvgXml } from 'react-native-svg';
import { accountIdenticon } from './accountIdenticon';
import { useAppTheme, useThemedStyles } from '@ui/theme';
import { accountAvatarFrameBorderWidth, createStyles } from './styles';

export function AccountAvatarImage({
  uri,
  seed,
  size = 40,
  onError,
}: Readonly<{ uri?: string; seed?: string; size?: number; onError?: () => void }>) {
  const theme = useAppTheme();
  const styles = useThemedStyles(createStyles);
  const frame = [styles.frame, { width: size, height: size, borderRadius: (size * 11) / 40 }];
  const accessibility = {
    accessible: false,
    accessibilityElementsHidden: true,
    importantForAccessibility: 'no-hide-descendants' as const,
  };
  if (uri) return <Image {...accessibility} source={{ uri }} resizeMode="cover" style={frame} onError={onError} />;
  const xml = seed ? accountIdenticon(seed) : undefined;
  if (xml) {
    const artwork = Math.max(0, size - accountAvatarFrameBorderWidth * 2);
    return (
      <View {...accessibility} style={frame}>
        <SvgXml xml={xml} width={artwork} height={artwork} accessible={false} />
      </View>
    );
  }
  return (
    <View {...accessibility} style={frame}>
      <Svg width={size / 2} height={size / 2} viewBox="0 0 24 24" fill="none" accessible={false}>
        <Circle cx={12} cy={8} r={3.5} stroke={theme.colors.textPrimary} strokeWidth={1.6} />
        <Path d="M5 21v-2a7 7 0 0 1 14 0v2" stroke={theme.colors.textPrimary} strokeWidth={1.6} strokeLinecap="round" />
      </Svg>
    </View>
  );
}
