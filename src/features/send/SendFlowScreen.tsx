import React, {useCallback, useEffect, useRef, useState} from 'react';
import {ActivityIndicator, Pressable, SafeAreaView, StyleSheet, Text, View} from 'react-native';

import type {AccountRecord} from '../../capabilities/account/types';
import {loadBalanceSnapshot} from '../../capabilities/balance/loadBalanceSnapshot';
import type {BalanceAsset, BalanceLine} from '../../capabilities/balance/types';
import type {PaymentReview} from '../../capabilities/payment/buildPaymentReview';
import {SendFormScreen} from './SendFormScreen';
import {SendResultScreen, type SendTerminalResult} from './SendResultScreen';
import {SendReviewScreen} from './SendReviewScreen';
import {
  buildSendReview,
  submitSendReview,
  type SendProductDependencies,
} from './sendProductFlow';

type LoadState =
  | Readonly<{kind: 'loading'}>
  | Readonly<{kind: 'blocked'; title: string; description: string}>
  | Readonly<{kind: 'ready'; balances: readonly BalanceLine[]}>;

type FlowState =
  | Readonly<{kind: 'form'}>
  | Readonly<{kind: 'review'; review: PaymentReview}>
  | Readonly<{kind: 'result'; result: SendTerminalResult}>;

type Props = Readonly<{
  account: AccountRecord;
  dependencies: SendProductDependencies;
  onDone: () => void;
}>;

export function SendFlowScreen({account, dependencies, onDone}: Props) {
  const [loadState, setLoadState] = useState<LoadState>({kind: 'loading'});
  const [flow, setFlow] = useState<FlowState>({kind: 'form'});
  const [selectedAsset, setSelectedAsset] = useState<BalanceAsset | undefined>();
  const [destination, setDestination] = useState('');
  const [amount, setAmount] = useState('');
  const [memo, setMemo] = useState('');
  const [building, setBuilding] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [passphraseRequired, setPassphraseRequired] = useState(false);
  const [appPassphrase, setAppPassphrase] = useState('');
  const [error, setError] = useState<string | undefined>();
  const loadVersion = useRef(0);

  useEffect(() => {
    const version = loadVersion.current + 1;
    loadVersion.current = version;
    setLoadState({kind: 'loading'});
    setFlow({kind: 'form'});
    setSelectedAsset(undefined);
    setDestination('');
    setAmount('');
    setMemo('');
    setAppPassphrase('');
    setPassphraseRequired(false);
    setError(undefined);

    void loadBalanceSnapshot({gateway: dependencies.gateway}, account)
      .then(snapshot => {
        if (loadVersion.current !== version) {
          return;
        }
        if (snapshot.status === 'inactive') {
          setLoadState({
            kind: 'blocked',
            title: 'Account not activated',
            description: 'This Stellar account must exist on Testnet before it can send a payment.',
          });
          return;
        }
        if (snapshot.status === 'unsupported-account') {
          setLoadState({
            kind: 'blocked',
            title: 'Send unavailable',
            description: 'Classic payment Send is not applied to contract accounts.',
          });
          return;
        }
        if (snapshot.balances.length === 0) {
          setLoadState({
            kind: 'blocked',
            title: 'No assets available',
            description: 'No displayable balance is available for this account.',
          });
          return;
        }

        setSelectedAsset(snapshot.balances[0].asset);
        setLoadState({kind: 'ready', balances: snapshot.balances});
      })
      .catch(caught => {
        if (loadVersion.current === version) {
          setLoadState({
            kind: 'blocked',
            title: 'Unable to load account balances',
            description: readableError(caught),
          });
        }
      });

    return () => {
      loadVersion.current += 1;
    };
  }, [account, dependencies.gateway]);

  const buildReview = useCallback(async () => {
    if (loadState.kind !== 'ready' || !selectedAsset) {
      return;
    }

    setBuilding(true);
    setError(undefined);
    try {
      const review = await buildSendReview(dependencies, account, {
        destination,
        amount,
        asset: selectedAsset,
        memo,
      });

      setPassphraseRequired(false);
      setAppPassphrase('');
      setFlow({kind: 'review', review});
    } catch (caught) {
      setError(readableError(caught));
    } finally {
      setBuilding(false);
    }
  }, [account, amount, dependencies, destination, loadState.kind, memo, selectedAsset]);

  const submitReview = useCallback(async () => {
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
      const result = await submitSendReview(
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
      <FlowMessageScreen
        title="Send"
        message="Loading current Stellar balances…"
        loading
        onBack={onDone}
      />
    );
  }

  if (loadState.kind === 'blocked') {
    return (
      <FlowMessageScreen
        title={loadState.title}
        message={loadState.description}
        onBack={onDone}
      />
    );
  }

  if (flow.kind === 'review') {
    return (
      <SendReviewScreen
        review={flow.review}
        submitting={submitting}
        passphraseRequired={passphraseRequired}
        appPassphrase={appPassphrase}
        error={error}
        onChangePassphrase={setAppPassphrase}
        onConfirm={() => void submitReview()}
        onBack={() => {
          setAppPassphrase('');
          setPassphraseRequired(false);
          setError(undefined);
          setFlow({kind: 'form'});
        }}
      />
    );
  }

  if (flow.kind === 'result') {
    return <SendResultScreen result={flow.result} onDone={onDone} />;
  }

  return (
    <SendFormScreen
      accountLabel={account.label || account.address}
      balances={loadState.balances}
      selectedAsset={selectedAsset ?? loadState.balances[0].asset}
      destination={destination}
      amount={amount}
      memo={memo}
      building={building}
      error={error}
      onSelectAsset={asset => {
        setSelectedAsset(asset);
        setError(undefined);
      }}
      onChangeDestination={setDestination}
      onChangeAmount={setAmount}
      onChangeMemo={setMemo}
      onContinue={() => void buildReview()}
      onCancel={onDone}
    />
  );
}

function FlowMessageScreen({
  title,
  message,
  onBack,
  loading = false,
}: Readonly<{title: string; message: string; onBack: () => void; loading?: boolean}>) {
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Pressable accessibilityLabel="Back" onPress={onBack} style={styles.backButton}>
          <Text style={styles.backGlyph}>‹</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Send</Text>
        <View style={styles.headerSpacer} />
      </View>
      <View style={styles.messageBody}>
        {loading ? <ActivityIndicator color="#00CA8A" /> : <View style={styles.messageIcon}><Text style={styles.messageGlyph}>!</Text></View>}
        <Text style={styles.messageTitle}>{title}</Text>
        <Text style={styles.messageText}>{message}</Text>
      </View>
    </SafeAreaView>
  );
}

function readableError(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown Send error.';
}

const styles = StyleSheet.create({
  safeArea: {flex: 1, backgroundColor: '#FFFFFF'},
  header: {minHeight: 58, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#E7EAF0'},
  backButton: {width: 42, height: 42, alignItems: 'center', justifyContent: 'center'},
  backGlyph: {fontSize: 36, lineHeight: 38, fontWeight: '300', color: '#181D41'},
  headerTitle: {fontSize: 18, lineHeight: 22, fontWeight: '800', color: '#000000'},
  headerSpacer: {width: 42},
  messageBody: {flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 34, gap: 10},
  messageIcon: {width: 58, height: 58, borderRadius: 29, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F3F6FA'},
  messageGlyph: {fontSize: 24, color: '#606885', fontWeight: '800'},
  messageTitle: {fontSize: 18, lineHeight: 23, color: '#000000', fontWeight: '800', textAlign: 'center'},
  messageText: {fontSize: 12, lineHeight: 18, color: '#606885', textAlign: 'center'},
});
