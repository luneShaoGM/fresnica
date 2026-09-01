import React from 'react';
import {Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View} from 'react-native';

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
  const positive = result.status === 'submitted';
  const uncertain = result.status === 'uncertain';

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.resultHero}>
          <View
            style={[
              styles.resultIcon,
              positive ? styles.resultIconPositive : uncertain ? styles.resultIconUncertain : styles.resultIconNegative,
            ]}>
            <Text style={styles.resultGlyph}>{positive ? '✓' : uncertain ? '?' : '!'}</Text>
          </View>
          <Text style={styles.title}>{presentation.title}</Text>
          <Text style={styles.description}>{presentation.description}</Text>
        </View>

        {'hash' in result ? <ResultRow label="Transaction hash" value={result.hash} mono /> : null}
        {'transactionHash' in result ? (
          <ResultRow label="Transaction hash" value={result.transactionHash} mono />
        ) : null}
        {result.status === 'submitted' && result.ledger !== undefined ? (
          <ResultRow label="Ledger" value={String(result.ledger)} />
        ) : null}
        {result.status === 'submitted' ? (
          <ResultRow label="Authorization" value={result.authorization} />
        ) : null}
      </ScrollView>

      <View style={styles.bottomBar}>
        <Pressable onPress={onDone} style={({pressed}) => [styles.doneButton, pressed ? styles.pressed : undefined]}>
          <Text style={styles.doneText}>Done</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function ResultRow({label, value, mono = false}: Readonly<{label: string; value: string; mono?: boolean}>) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text numberOfLines={mono ? 3 : 2} selectable style={[styles.rowValue, mono ? styles.mono : undefined]}>
        {value}
      </Text>
    </View>
  );
}

function describeResult(result: SendTerminalResult): {
  title: string;
  description: string;
} {
  switch (result.status) {
    case 'submitted':
      return {
        title: 'Payment sent',
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
        title: 'Status uncertain',
        description:
          'Fresnica could not prove whether the network accepted this transaction. Verify the transaction hash before trying again.',
      };
    case 'authorization-blocked':
      return {
        title: 'Authorization unavailable',
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
  safeArea: {flex: 1, backgroundColor: '#FFFFFF'},
  content: {flexGrow: 1, paddingBottom: 24},
  resultHero: {alignItems: 'center', paddingHorizontal: 28, paddingTop: 60, paddingBottom: 36, gap: 10},
  resultIcon: {width: 78, height: 78, borderRadius: 39, alignItems: 'center', justifyContent: 'center', marginBottom: 8},
  resultIconPositive: {backgroundColor: '#00CA8A'},
  resultIconNegative: {backgroundColor: '#FF5B5B'},
  resultIconUncertain: {backgroundColor: '#F8BF4C'},
  resultGlyph: {fontSize: 34, lineHeight: 39, color: '#FFFFFF', fontWeight: '800'},
  title: {fontSize: 23, lineHeight: 28, color: '#000000', fontWeight: '800', textAlign: 'center'},
  description: {fontSize: 12, lineHeight: 18, color: '#606885', textAlign: 'center'},
  row: {minHeight: 57, flexDirection: 'row', alignItems: 'center', gap: 18, paddingHorizontal: 18, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#E7EAF0'},
  rowLabel: {fontSize: 12, lineHeight: 16, color: '#606885', fontWeight: '600'},
  rowValue: {flex: 1, fontSize: 12, lineHeight: 16, color: '#000000', fontWeight: '600', textAlign: 'right'},
  mono: {fontSize: 10, lineHeight: 14, color: '#606885', fontWeight: '400'},
  bottomBar: {paddingHorizontal: 18, paddingTop: 10, paddingBottom: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#E7EAF0'},
  doneButton: {minHeight: 54, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: '#00CA8A'},
  doneText: {fontSize: 15, lineHeight: 19, color: '#FFFFFF', fontWeight: '800'},
  pressed: {opacity: 0.68},
});
