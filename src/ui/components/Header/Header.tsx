import React from 'react';
import {Text, View} from 'react-native';

import {useThemedStyles} from '@ui/theme';

import {createStyles} from './styles';

export type HeaderProps = Readonly<{
  title: string;
  eyebrow?: string;
  subtitle?: string;
  leading?: React.ReactNode;
  trailing?: React.ReactNode;
}>;

export function Header({title, eyebrow, subtitle, leading, trailing}: HeaderProps) {
  const styles = useThemedStyles(createStyles);

  return (
    <View style={styles.header}>
      {leading ? <View style={styles.accessory}>{leading}</View> : null}
      <View style={styles.identity}>
        {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      {trailing ? <View style={styles.accessory}>{trailing}</View> : null}
    </View>
  );
}
