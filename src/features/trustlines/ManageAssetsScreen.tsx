import React, {useCallback, useEffect, useRef, useState} from 'react';
import {StyleSheet, Text, View} from 'react-native';

import type {AccountRecord} from '../../capabilities/account/types';
import {loadBalanceSnapshot} from '../../capabilities/balance/loadBalanceSnapshot';
import type {BalanceLine} from '../../capabilities/balance/types';
import type {TrustlineReview} from '../../capabilities/trustline/buildTrustlineReview';
import {Button} from '../../ui/Button';
import {Card} from '../../ui/Card';
import {Field} from '../../ui/Field';
import {Screen} from '../../ui/Screen';
import {palette, spacing, typography} from '../../ui/theme';
import {
  prepareTrustlineProductReview,
  submitTrustlineProductReview,
  type TrustlineProductDependencies,
  type TrustlineSubmissionResult,
} from './trustlineProductFlow';

type LoadState =
  | Readonly<{kind: 'loading'}>
  | Readonly<{kind: 'blocked'; title: string; description: string}>
  | Readonly<{kind: 'ready'; trustlines: readonly BalanceLine[]}>;

type FlowState =
  | Readonly<{kind: 'manage'}>
  | Readonly<{kind: 'review'; review: TrustlineReview}>
  | Readonly<{kind: 'result'; result: TrustlineSubmissionResult}>;

type Props = Readonly<{
  account: AccountRecord;
  dependencies: TrustlineProductDependencies;
  onDone: () => void;
}>;

export function ManageAssetsScreen({account, dependencies, onDone}: Props) {
  const [loadState, setLoadState] = useState<LoadState>({kind: 'loading'});
  const [flow, setFlow] = useState<FlowState>({kind: 'manage'});
  const [assetCode, setAssetCode] = useState('');
  const [assetIssuer, setAssetIssuer] = useState('');
  const [building, setBuilding] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [passphraseRequired, setPassphraseRequired] = useState(false);
  const [appPassphrase, setAppPassphrase] = useState('');
  const [error, setError] = useState<string | undefined>();
  const loadVersion = useRef(0);

  const loadTrustlines = useCallback(() => {
    const version = loadVersion.current + 1;
    loadVersion.current = version;
    setLoadState({kind: 'loading'});

    void loadBalanceSnapshot({gateway: dependencies.gateway}, account)
      .then(snapshot => {
        if (loadVersion.current !== version) {
          return;
        }
        if (snapshot.status === 'inactive') {
          setLoadState({
            kind: 'blocked',
            title: 'Account not activated',
            description: 'This Stellar account must exist on Testnet before trustlines can be changed.',
          });
          return;
        }
        if (snapshot.status === 'unsupported-account') {
          setLoadState({
            kind: 'blocked',
            title: 'Manage Assets unavailable',
            description: 'Classic ChangeTrust semantics are not applied to contract accounts.',
          });
          return;
        }

        setLoadState({
          kind: 'ready',
          trustlines: snapshot.balances.filter(line => line.asset.kind === 'credit'),
        });
      })
      .catch(caught => {
        if (loadVersion.current === version) {
          setLoadState({
            kind: 'blocked',
            title: 'Unable to load trustlines',
            description: readableError(caught),
          });
        }
      });
  }, [account, dependencies.gateway]);

  useEffect(() => {
    setFlow({kind: 'manage'});
    setAssetCode('');
    setAssetIssuer('');
    setAppPassphrase('');
    setPassphraseRequired(false);
    setError(undefined);
    loadTrustlines();

    return () => {
      loadVersion.current += 1;
    };
  }, [loadTrustlines]);

  const prepare = useCallback(
    async (action: 'add' | 'remove', code: string, issuer: string) => {
      setBuilding(true);
      setError(undefined);
      try {
        const review = await prepareTrustlineProductReview(dependencies, account, {
          action,
          asset: {code, issuer},
        });
        setAppPassphrase('');
        setPassphraseRequired(false);
        setFlow({kind: 'review', review});
      } catch (caught) {
        setError(readableError(caught));
      } finally {
        setBuilding(false);
      }
    },
    [account, dependencies],
  );

  const submit = useCallback(async () => {
    if (flow.kind !== 'review') {
      return;
    }

    const passphrase = passphraseRequired ? appPassphrase : undefined;
    if (passphraseRequired) {
      setAppPassphrase('');
    }

    setSubmitting(true);
    setError(undefined);
    try {
      const result = await submitTrustlineProductReview(
        dependencies,
        account,
        flow.review,
        passphrase,
      );
      if (result.status === 'passcode-required') {
        setPassphraseRequired(true);
        return;
      }
      setFlow({kind: 'result', result});
    } catch (caught) {
      setError(readableError(caught));
    } finally {
      setSubmitting(false);
    }
  }, [account, appPassphrase, dependencies, flow, passphraseRequired]);

  if (loadState.kind === 'loading') {
    return (
      <Screen eyebrow="Wallet" title="Manage assets">
        <Card
          title="Loading trustlines"
          description="Fresnica is loading current Testnet asset state before allowing a ChangeTrust review."
        />
      </Screen>
    );
  }

  if (loadState.kind === 'blocked') {
    return (
      <Screen eyebrow="Wallet" title="Manage assets">
        <Card title={loadState.title} description={loadState.description} />
        <Button label="Back to Wallet" onPress={onDone} />
      </Screen>
    );
  }

  if (flow.kind === 'review') {
    const review = flow.review;
    return (
      <Screen
        eyebrow="Manage assets"
        title={`Review ${review.operation === 'add' ? 'trustline' : 'removal'}`}
        description="Every ledger-changing value below is derived from the exact unsigned ChangeTrust XDR that will be signed.">
        <Card title="ChangeTrust">
          <ReviewRow label="Action" value={review.operation} />
          <ReviewRow label="Source" value={review.source} />
          <ReviewRow label="Asset" value={`${review.asset.code}:${review.asset.issuer}`} />
          <ReviewRow label="Resulting limit" value={review.limit ?? '0 (remove)'} />
          <ReviewRow label="Fee" value={`${review.fee} stroops`} />
          {review.expectedAuthorization ? (
            <ReviewRow label="Expected authorization" value={review.expectedAuthorization} />
          ) : null}
          {review.expectedClawbackEnabled === undefined ? null : (
            <ReviewRow
              label="Expected clawback"
              value={review.expectedClawbackEnabled ? 'Enabled' : 'Disabled'}
            />
          )}
        </Card>
        <Card
          title="Authorization"
          description="Current ledger authorization is reloaded immediately before signing. Routine signing uses System Auth when enrolled and otherwise requests the app passphrase.">
          {passphraseRequired ? (
            <Field
              label="App passphrase"
              value={appPassphrase}
              onChangeText={setAppPassphrase}
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
              disabled={submitting}
              onPress={() => {
                setAppPassphrase('');
                setPassphraseRequired(false);
                setError(undefined);
                setFlow({kind: 'manage'});
              }}
            />
          </View>
          <View style={styles.flex}>
            <Button
              label={submitting ? 'Submitting...' : 'Confirm change'}
              disabled={submitting || (passphraseRequired && appPassphrase.length === 0)}
              onPress={() => void submit()}
            />
          </View>
        </View>
      </Screen>
    );
  }

  if (flow.kind === 'result') {
    return (
      <Screen eyebrow="Manage assets" title="Trustline result">
        <Card
          title={resultTitle(flow.result)}
          description={resultDescription(flow.result)}
        />
        <Button label="Back to Wallet" onPress={onDone} />
      </Screen>
    );
  }

  return (
    <Screen
      eyebrow="Wallet"
      title="Manage assets"
      description={`Classic issued-asset trustlines for ${account.label || account.address}.`}>
      <Card
        title="Add trustline"
        description="Enter the full issued-asset identity. Fresnica uses its normative default limit and preflights issuer existence, reserve and fee capacity before constructing XDR.">
        <Field
          label="Asset code"
          value={assetCode}
          onChangeText={setAssetCode}
          autoCapitalize="characters"
          autoCorrect={false}
          editable={!building}
        />
        <Field
          label="Issuer (G...)"
          value={assetIssuer}
          onChangeText={setAssetIssuer}
          autoCapitalize="characters"
          autoCorrect={false}
          editable={!building}
        />
        <Button
          label={building ? 'Preparing...' : 'Review add'}
          disabled={building || assetCode.trim().length === 0 || assetIssuer.trim().length === 0}
          onPress={() => void prepare('add', assetCode, assetIssuer)}
        />
      </Card>

      <Card
        title="Existing issued assets"
        description={
          loadState.trustlines.length === 0
            ? 'No ordinary issued-asset trustlines are currently visible.'
            : 'Removal is preflighted against balance, liabilities and liquidity-pool relationships before XDR is built.'
        }>
        {loadState.trustlines.map(line => {
          if (line.asset.kind !== 'credit') {
            return null;
          }
          return (
            <View key={`${line.asset.code}:${line.asset.issuer}`} style={styles.assetRow}>
              <View style={styles.flex}>
                <Text style={styles.assetCode}>{line.asset.code}</Text>
                <Text selectable style={styles.assetIssuer}>
                  {line.asset.issuer}
                </Text>
                <Text style={styles.balance}>Balance {line.balance}</Text>
              </View>
              <Button
                label="Review remove"
                variant="secondary"
                disabled={building}
                onPress={() => void prepare('remove', line.asset.code, line.asset.issuer)}
              />
            </View>
          );
        })}
      </Card>

      {error ? (
        <Card title="Unable to prepare change">
          <Text style={styles.error}>{error}</Text>
        </Card>
      ) : null}
      <Button label="Back to Wallet" variant="secondary" onPress={onDone} />
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

function resultTitle(result: TrustlineSubmissionResult): string {
  switch (result.status) {
    case 'submitted':
      return 'Trustline change submitted';
    case 'rejected':
      return 'Transaction rejected';
    case 'uncertain':
      return 'Submission status uncertain';
    case 'authorization-blocked':
      return 'Ledger authorization blocked';
    case 'unsupported-signer':
      return 'Signer unsupported';
    case 'watch-only':
      return 'Watch-only account';
    case 'unsupported-account-signers':
      return 'Multiple local signers not supported yet';
    case 'passcode-required':
      return 'App passphrase required';
  }
}

function resultDescription(result: TrustlineSubmissionResult): string {
  switch (result.status) {
    case 'submitted':
      return `Accepted as ${result.hash}${result.ledger === undefined ? '' : ` in ledger ${result.ledger}`}. Return to Wallet to refresh asset state.`;
    case 'rejected':
      return `Horizon deterministically rejected ${result.transactionHash}${result.resultCode ? ` (${result.resultCode})` : ''}.`;
    case 'uncertain':
      return `The network outcome for ${result.transactionHash} is uncertain. Do not blindly retry until the hash is verified.`;
    case 'authorization-blocked':
      return `Current ledger authorization cannot satisfy the medium threshold (${result.availableWeight}/${result.requiredWeight}).`;
    case 'unsupported-signer':
      return 'The attached signer is not a supported protected software signer.';
    case 'watch-only':
      return 'This account has no attached local signer, so Fresnica will not execute ChangeTrust.';
    case 'unsupported-account-signers':
      return 'This account has multiple attached local signers. Multisig coordination is a later milestone, so Fresnica fails closed.';
    case 'passcode-required':
      return 'Enter the current app passphrase on the review screen.';
  }
}

function readableError(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown Trustline error.';
}

const styles = StyleSheet.create({
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  flex: {
    flex: 1,
  },
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
  assetRow: {
    gap: spacing.sm,
  },
  assetCode: {
    ...typography.sectionTitle,
    color: palette.text,
  },
  assetIssuer: {
    ...typography.caption,
    color: palette.textMuted,
  },
  balance: {
    ...typography.caption,
    color: palette.text,
  },
  error: {
    ...typography.caption,
    color: palette.danger,
  },
});
