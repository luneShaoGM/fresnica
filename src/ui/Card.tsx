import React from 'react';
import {StyleSheet, Text, View} from 'react-native';

import {palette, radius, spacing, typography} from './theme';

type Props = React.PropsWithChildren<
  Readonly<{
    title?: string;
    description?: string;
  }>
>;

export function Card({title, description, children}: Props) {
  return (
    <View style={styles.card}>
      {title ? <Text style={styles.title}>{title}</Text> : null}
      {description ? <Text style={styles.description}>{description}</Text> : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: radius.lg,
    padding: spacing.md,
    backgroundColor: palette.surface,
    gap: spacing.sm,
  },
  title: {
    ...typography.sectionTitle,
    color: palette.text,
  },
  description: {
    ...typography.caption,
    color: palette.textMuted,
  },
});
