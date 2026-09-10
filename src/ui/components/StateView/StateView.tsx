import React from 'react';
import {ActivityIndicator, Text, View} from 'react-native';

import {Button} from '@ui/components/Button';
import {useAppTheme, useThemedStyles} from '@ui/theme';

import {createStyles} from './styles';

export type StateViewKind = 'loading' | 'empty' | 'error';

export type StateViewProps = Readonly<{
  kind: StateViewKind;
  title: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
}>;

export function StateView({kind, title, message, actionLabel, onAction}: StateViewProps) {
  const theme = useAppTheme();
  const styles = useThemedStyles(createStyles);
  const glyph = kind === 'error' ? '!' : '◎';

  return (
    <View style={styles.container}>
      {kind === 'loading' ? (
        <ActivityIndicator color={theme.colors.actionPrimary} />
      ) : (
        <View style={[styles.icon, kind === 'error' ? styles.errorIcon : undefined]}>
          <Text style={[styles.glyph, kind === 'error' ? styles.errorGlyph : undefined]}>{glyph}</Text>
        </View>
      )}
      <Text style={styles.title}>{title}</Text>
      {message ? <Text style={styles.message}>{message}</Text> : null}
      {actionLabel && onAction ? (
        <View style={styles.action}>
          <Button label={actionLabel} onPress={onAction} variant="secondary" />
        </View>
      ) : null}
    </View>
  );
}
