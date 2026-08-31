import React from 'react';
import {StyleSheet, Text, TextInput, View} from 'react-native';

import {palette, radius, spacing, typography} from './theme';

type Props = React.ComponentProps<typeof TextInput> &
  Readonly<{
    label: string;
    hint?: string;
  }>;

export function Field({label, hint, multiline, style, ...inputProps}: Props) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        {...inputProps}
        multiline={multiline}
        placeholderTextColor={palette.textMuted}
        style={[styles.input, multiline ? styles.multiline : undefined, style]}
      />
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    gap: spacing.xs,
  },
  label: {
    ...typography.label,
    color: palette.text,
  },
  input: {
    minHeight: 50,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: palette.surface,
    color: palette.text,
    fontSize: 16,
  },
  multiline: {
    minHeight: 112,
    textAlignVertical: 'top',
  },
  hint: {
    ...typography.caption,
    color: palette.textMuted,
  },
});
