import React from 'react';
import { Pressable, Text } from 'react-native';

import { useThemedStyles } from '@ui/theme';

import { createStyles } from './styles';

export type SelectableChipProps = Readonly<{
  label: string;
  selected: boolean;
  onPress: () => void;
  size?: 'compact' | 'regular';
  accessibilityRole?: 'button' | 'radio';
  disabled?: boolean;
}>;

export function SelectableChip({
  label,
  selected,
  onPress,
  size = 'regular',
  accessibilityRole = 'button',
  disabled = false,
}: SelectableChipProps) {
  const styles = useThemedStyles(createStyles);

  return (
    <Pressable
      accessibilityRole={accessibilityRole}
      accessibilityState={{ selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        size === 'compact' ? styles.compact : styles.regular,
        selected ? styles.selected : undefined,
        pressed && !disabled ? styles.pressed : undefined,
        disabled ? styles.disabled : undefined,
      ]}
    >
      <Text
        style={[
          styles.text,
          size === 'compact' ? styles.compactText : styles.regularText,
          selected ? styles.selectedText : undefined,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}
