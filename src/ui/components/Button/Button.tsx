import React from 'react';
import {Pressable, Text} from 'react-native';

import {useThemedStyles} from '@ui/theme';

import {createStyles} from './styles';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost';

export type ButtonProps = Readonly<{
  label: string;
  onPress: () => void;
  disabled?: boolean;
  variant?: ButtonVariant;
}>;

export function Button({label, onPress, disabled, variant = 'primary'}: ButtonProps) {
  const styles = useThemedStyles(createStyles);

  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({pressed}) => [
        styles.base,
        buttonStyle(styles, variant),
        pressed && !disabled ? styles.pressed : undefined,
        disabled ? styles.disabled : undefined,
      ]}>
      <Text style={[styles.text, buttonTextStyle(styles, variant)]}>{label}</Text>
    </Pressable>
  );
}

function buttonStyle(styles: ReturnType<typeof createStyles>, variant: ButtonVariant) {
  switch (variant) {
    case 'primary':
      return styles.primary;
    case 'secondary':
      return styles.secondary;
    case 'ghost':
      return styles.ghost;
  }
}

function buttonTextStyle(styles: ReturnType<typeof createStyles>, variant: ButtonVariant) {
  switch (variant) {
    case 'primary':
      return styles.primaryText;
    case 'secondary':
      return styles.secondaryText;
    case 'ghost':
      return styles.ghostText;
  }
}
