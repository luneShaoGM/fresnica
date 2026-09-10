import React from 'react';
import {View, type StyleProp, type ViewStyle} from 'react-native';

import {useThemedStyles} from '@ui/theme';

import {createStyles} from './styles';

export type BottomActionProps = React.PropsWithChildren<
  Readonly<{
    style?: StyleProp<ViewStyle>;
  }>
>;

export function BottomAction({children, style}: BottomActionProps) {
  const styles = useThemedStyles(createStyles);
  return <View style={[styles.container, style]}>{children}</View>;
}
