import React from 'react';
import { View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useAppTheme, useThemedStyles } from '@ui/theme';
import { AccountAvatarImage } from '@ui/components/AccountAvatarImage';
import { createStyles } from './styles';
export { AccountAvatar as ActivityAccountAvatar } from '../contacts/AccountAvatar';

export function ActivitySymbol({ document = false }: Readonly<{ document?: boolean }>) {
  const theme = useAppTheme();
  const styles = useThemedStyles(createStyles);
  if (!document) return <AccountAvatarImage />;
  return (
    <View
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={styles.avatarFrame}
    >
      <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" accessible={false}>
        <Path
          d="M6 3h8l4 4v14H6V3Zm8 0v5h4M9 12h6M9 16h6"
          stroke={theme.colors.textPrimary}
          strokeWidth={1.6}
          strokeLinejoin="round"
        />
      </Svg>
    </View>
  );
}
