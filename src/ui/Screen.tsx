import React from 'react';
import {ScrollView, StyleSheet, Text, View} from 'react-native';

import {palette, spacing, typography} from './theme';

type Props = React.PropsWithChildren<
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
}: Props) {
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

const styles = StyleSheet.create({
  screen: {
    flexGrow: 1,
    backgroundColor: palette.background,
    paddingHorizontal: spacing.lg,
    paddingTop: 56,
    paddingBottom: spacing.xxl,
    gap: spacing.md,
  },
  eyebrow: {
    ...typography.eyebrow,
    color: palette.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  title: {
    ...typography.title,
    color: palette.text,
  },
  description: {
    ...typography.body,
    color: palette.textMuted,
  },
});
