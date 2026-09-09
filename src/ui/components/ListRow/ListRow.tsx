import React from 'react';
import {Pressable, Text, View} from 'react-native';

import {useThemedStyles} from '@ui/theme';

import {createStyles} from './styles';

export type ListRowProps = Readonly<{
  title: string;
  subtitle?: string;
  leading?: React.ReactNode;
  trailing?: React.ReactNode;
  onPress?: () => void;
  disabled?: boolean;
  selected?: boolean;
}>;

export function ListRow({title, subtitle, leading, trailing, onPress, disabled, selected}: ListRowProps) {
  const styles = useThemedStyles(createStyles);
  const content = (
    <>
      {leading ? <View style={styles.leading}>{leading}</View> : null}
      <View style={styles.identity}>
        <Text numberOfLines={1} style={styles.title}>{title}</Text>
        {subtitle ? <Text numberOfLines={2} style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      {trailing ? <View style={styles.trailing}>{trailing}</View> : null}
    </>
  );
  if (!onPress) {
    return <View style={styles.row}>{content}</View>;
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{disabled: Boolean(disabled), selected: Boolean(selected)}}
      disabled={disabled}
      onPress={onPress}
      style={({pressed}) => [
        styles.row,
        selected ? styles.selected : undefined,
        pressed && !disabled ? styles.pressed : undefined,
        disabled ? styles.disabled : undefined,
      ]}>
      {content}
    </Pressable>
  );
}
