import React from 'react';
import {StyleSheet, Text} from 'react-native';

import {Button} from '../../ui/Button';
import {Card} from '../../ui/Card';
import {Screen} from '../../ui/Screen';
import {palette, typography} from '../../ui/theme';
import type {SendSubmissionResult} from './sendProductFlow';

export type SendTerminalResult = Exclude<
  SendSubmissionResult,
  {status: 'passcode-required'}
>;

type Props = Readonly<{
  result: SendTerminalResult;
  onDone: () => void;
}>;

export function SendResultScreen({result, onDone}: Props) {
  const presentation = describeResult(result);

  return (
    <Screen eyebrow="Send" title="Payment result">
      <Card title={presentation.title} description={presentation.description}>
        {'hash' in result ? (
          <Text selectable style={styles.value}>
            Transaction hash: {result.hash}
          </Text>
        ) : null}
        {'transactionHash' in result ? (
          <Text selectable style={styles.value}>
            Transaction hash: {result.transactionHash}
          </Text>
        ) : null}
        {result.status === 'submitted' && result.ledger !== undefined ? (
          <Text style={styles.value}>Ledger: {result.ledger}</Text>
        ) : null}
        {result.status === 'submitted' ? (
          <Text style={styles.value}>Authorization: {result.authorization}</Text>
        ) : null}
      </Card>
      <Button label="Done" onPress={onDone} />
    </Screen>
  );
}

function describeResult(result: SendTerminalResult): {
  title: string;
  description: string;
} {
  switch (result.status) {
    case 'submitted':
      return {
        title: 'Payment submitted',
        description: 'Horizon accepted the exact signed transaction.',
      };
    case 'rejected':
      return {
        title: 'Payment rejected',
        description: result.resultCode
          ? `Horizon deterministically rejected the transaction: ${result.resultCode}.`
          : 'Horizon deterministically rejected the transaction.',
      };
    case 'uncertain':
      return {
        title: 'Submission uncertain',
        description:
          'Fresnica could not prove whether the network accepted this transaction. Do not assume failure or submit a replacement until its status is checked.',
      };
    case 'authorization-blocked':
      return {
        title: 'Signing authorization unavailable',
        description: `Current ledger authorization is blocked (${result.reason}). Required weight ${result.requiredWeight}; available local weight ${result.availableWeight}.`,
      };
    case 'unsupported-signer':
      return {
        title: 'Signer unsupported',
        description:
          'The signer attached to this account cannot be invoked by the current Mobile signing provider.',
      };
    case 'watch-only':
      return {
        title: 'Watch-only account',
        description: 'This account has no attached signer and cannot send a payment.',
      };
    case 'unsupported-account-signers':
      return {
        title: 'Multiple signers not yet supported',
        description:
          'This account requires the future multisig coordination milestone before Mobile can submit this payment.',
      };
  }
}

const styles = StyleSheet.create({
  value: {
    ...typography.caption,
    color: palette.text,
  },
});
