import React from 'react';
import {Text, TextInput, View} from 'react-native';

import {useAppTheme, useThemedStyles} from '@ui/theme';

import {createStyles} from './styles';

export type FieldProps = React.ComponentProps<typeof TextInput> &
  Readonly<{
    label: string;
    hint?: string;
  }>;

export function Field({label, hint, multiline, style, ...inputProps}: FieldProps) {
  const theme = useAppTheme();
  const styles = useThemedStyles(createStyles);

  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        {...inputProps}
        multiline={multiline}
        placeholderTextColor={theme.colors.textSecondary}
        style={[styles.input, multiline ? styles.multiline : undefined, style]}
      />
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}
