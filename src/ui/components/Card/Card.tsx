import React from 'react';
import {Text, View} from 'react-native';

import {useThemedStyles} from '@ui/theme';

import {createStyles} from './styles';

export type CardProps = React.PropsWithChildren<
  Readonly<{
    title?: string;
    description?: string;
  }>
>;

export function Card({title, description, children}: CardProps) {
  const styles = useThemedStyles(createStyles);

  return (
    <View style={styles.card}>
      {title ? <Text style={styles.title}>{title}</Text> : null}
      {description ? <Text style={styles.description}>{description}</Text> : null}
      {children}
    </View>
  );
}
