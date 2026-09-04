import React from 'react';
import {ScrollView, Text, View} from 'react-native';

import {useThemedStyles} from '@ui/theme';

import {createStyles} from './styles';

export type ScreenProps = React.PropsWithChildren<
  Readonly<{
    eyebrow?: string;
    title?: string;
    description?: string;
    keyboardShouldPersistTaps?: 'always' | 'never' | 'handled';
    leading?: React.ReactNode;
  }>
>;

export function Screen({
  children,
  eyebrow,
  title,
  description,
  keyboardShouldPersistTaps,
  leading,
}: ScreenProps) {
  const styles = useThemedStyles(createStyles);

  return (
    <ScrollView
      contentContainerStyle={styles.screen}
      keyboardShouldPersistTaps={keyboardShouldPersistTaps}>
      {leading ? <View>{leading}</View> : null}
      {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
      {title ? <Text style={styles.title}>{title}</Text> : null}
      {description ? <Text style={styles.description}>{description}</Text> : null}
      {children}
    </ScrollView>
  );
}
