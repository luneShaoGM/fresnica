import React from 'react';
import {StyleSheet, Text} from 'react-native';

import {Card} from '../../ui/Card';
import {Screen} from '../../ui/Screen';
import {palette, spacing, typography} from '../../ui/theme';

type Props = Readonly<{
  accountLabel?: string;
}>;

export function ActivityHomeScreen({accountLabel}: Props) {
  return (
    <Screen eyebrow="Activity" title="History">
      <Text style={styles.context}>
        {accountLabel ? `Showing activity for ${accountLabel}.` : 'Select an account to view activity.'}
      </Text>
      <Card
        title="No activity loaded"
        description="Horizon operation history has not been connected to this product surface yet. This screen does not fabricate cached operations."
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  context: {
    ...typography.body,
    color: palette.textMuted,
    marginBottom: spacing.sm,
  },
});
