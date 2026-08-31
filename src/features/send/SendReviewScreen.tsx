import React from 'react';
import {StyleSheet, Text, View} from 'react-native';

import type {PaymentReview} from '../../capabilities/payment/buildPaymentReview';
import {Button} from '../../ui/Button';
import {Card} from '../../ui/Card';
import {Field} from '../../ui/Field';
import {Screen} from '../../ui/Screen';
import {palette, spacing, typography} from '../../ui/theme';

type Props = Readonly<{
  review: PaymentReview;
  submitting: boolean;
  passphraseRequired: boolean;
  appPassphrase: string;
  error?: string;
  onChangePassphrase: (value: string) => void;
  onConfirm: () => void;
  onBack: () => void;
}>;

export function SendReviewScreen({
  review,
  submitting,
  passphraseRequired,
  appPassphrase,
  error,
  onChangePassphrase,
  onConfirm,
  onBack,
}: Props) {
  const assetLabel =
    review.asset.kind === 'native'
      ? 'XLM'
      : `${review.asset.code}:${review.asset.issuer}`;

  return (
    <Screen
      eyebrow="Send"
      title="Review payment"
      description="Every value below was derived from the exact unsigned transaction XDR that will be signed.">
      <Card title="Payment">
        <ReviewRow label="From" value={review.source} />
        <ReviewRow label="To" value={review.destination} />
        <ReviewRow label="Asset" value={assetLabel} />
        <ReviewRow label="Amount" value={review.amount} />
        <ReviewRow label="Memo" value={review.memo ?? 'None'} />
        <ReviewRow label="Fee" value={`${review.fee} stroops`} />
        {review.expiresAtUnixSeconds === undefined ? null : (
          <ReviewRow
            label="Expires"
            value={new Date(review.expiresAtUnixSeconds * 1000).toISOString()}
          />
        )}
      </Card>

      <Card
        title="Authorization"
        description="Fresnica reloads current ledger authorization before signing. Routine signing uses System Auth when enrolled; otherwise it asks for the app passphrase.">
        {passphraseRequired ? (
          <Field
            label="App passphrase"
            value={appPassphrase}
            onChangeText={onChangePassphrase}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            editable={!submitting}
          />
        ) : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </Card>

      <View style={styles.actions}>
        <View style={styles.flex}>
          <Button
            label="Back"
            variant="secondary"
            onPress={onBack}
            disabled={submitting}
          />
        </View>
        <View style={styles.flex}>
          <Button
            label={submitting ? 'Submitting...' : 'Confirm and send'}
            onPress={onConfirm}
            disabled={submitting || (passphraseRequired && appPassphrase.length === 0)}
          />
        </View>
      </View>
    </Screen>
  );
}

function ReviewRow({label, value}: Readonly<{label: string; value: string}>) {
  return (
    <View style={styles.reviewRow}>
      <Text style={styles.label}>{label}</Text>
      <Text selectable style={styles.value}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  reviewRow: {
    gap: 4,
  },
  label: {
    ...typography.label,
    color: palette.textMuted,
  },
  value: {
    ...typography.caption,
    color: palette.text,
  },
  error: {
    ...typography.caption,
    color: palette.danger,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  flex: {
    flex: 1,
  },
});
