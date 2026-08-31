import React from 'react';
import {Pressable, StyleSheet, Text} from 'react-native';

import {palette, radius, spacing, typography} from './theme';

type Props = Readonly<{
  label: string;
  onPress: () => void;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'ghost';
}>;

export function Button({label, onPress, disabled, variant = 'primary'}: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({pressed}) => [
        styles.base,
        styles[variant],
        pressed && !disabled ? styles.pressed : undefined,
        disabled ? styles.disabled : undefined,
      ]}>
      <Text style={[styles.text, styles[`${variant}Text`]]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 52,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  primary: {
    backgroundColor: palette.accent,
    borderColor: palette.accent,
  },
  secondary: {
    backgroundColor: palette.surface,
    borderColor: palette.border,
  },
  ghost: {
    backgroundColor: 'transparent',
    borderColor: 'transparent',
  },
  pressed: {
    opacity: 0.82,
  },
  disabled: {
    opacity: 0.45,
  },
  text: {
    ...typography.button,
  },
  primaryText: {
    color: palette.accentText,
  },
  secondaryText: {
    color: palette.text,
  },
  ghostText: {
    color: palette.accent,
  },
});
