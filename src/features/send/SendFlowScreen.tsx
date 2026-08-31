import React, {useCallback, useEffect, useRef, useState} from 'react';

import type {AccountSignerRepository} from '../../capabilities/account/AccountSignerRepository';
import type {AccountRecord} from '../../capabilities/account/types';
import {loadBalanceSnapshot} from '../../capabilities/balance/loadBalanceSnapshot';
import type {BalanceAsset, BalanceLine} from '../../capabilities/balance/types';
import {
  buildPaymentReview,
  type PaymentReview,
} from '../../capabilities/payment/buildPaymentReview';
import {
  submitReviewedPayment,
  type SubmitReviewedPaymentResult,
} from '../../capabilities/payment/submitReviewedPayment';
import type {FresnicaSdk} from '../../platform/fresnica/FresnicaSdk';
import type {StellarGateway} from '../../platform/stellar/StellarGateway';
import {Button} from '../../ui/Button';
import {Card} from '../../ui/Card';
import {Screen} from '../../ui/Screen';
import {resolveSendSigner} from './resolveSendSigner';
import {SendFormScreen} from './SendFormScreen';
import {SendResultScreen, type SendTerminalResult} from './SendResultScreen';
import {SendReviewScreen} from './SendReviewScreen';
import {validateSendDraft} from './sendDraft';

const TESTNET_BASE_FEE_STROOPS = '100';

export type SendFlowDependencies = Readonly<{
  gateway: StellarGateway;
  sdk: FresnicaSdk;
  repository: AccountSignerRepository;
}>;

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
  dependencies: SendFlowDependencies;
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
      const draft = validateSendDraft({
        destination,
        amount,
        memo,
        asset: selectedAsset,
      });
      const built = await dependencies.gateway.buildPayment({
        source: account.address,
        destination: draft.destination,
        asset: draft.asset,
        amount: draft.amount,
        ...(draft.memo === undefined ? {} : {memo: draft.memo}),
        baseFee: TESTNET_BASE_FEE_STROOPS,
      });
      const review = buildPaymentReview(built);
      if (review.source !== account.address) {
        throw new Error('payment-review-source-mismatch');
      }

      setPassphraseRequired(false);
      setAppPassphrase('');
      setFlow({kind: 'review', review});
    } catch (caught) {
      setError(readableError(caught));
    } finally {
      setBuilding(false);
    }
  }, [account.address, amount, dependencies.gateway, destination, loadState, memo, selectedAsset]);

  const submitReview = useCallback(async () => {
    if (flow.kind !== 'review') {
      return;
    }

    let signer;
    try {
      signer = resolveSendSigner(dependencies.repository, account.id);
    } catch (caught) {
      setError(sendSignerError(caught));
      return;
    }

    const passphrase = passphraseRequired ? appPassphrase : undefined;
    if (passphraseRequired) {
      setAppPassphrase('');
    }

    setSubmitting(true);
    setError(undefined);
    try {
      const result: SubmitReviewedPaymentResult = await submitReviewedPayment({
        gateway: dependencies.gateway,
        sdk: dependencies.sdk,
        review: flow.review,
        signer,
        ...(passphrase === undefined ? {} : {appPasscode: passphrase}),
        systemAuthReason: `Send ${flow.review.amount} ${assetCode(flow.review)}`,
      });

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
  }, [account.id, appPassphrase, dependencies, flow, passphraseRequired]);

  if (loadState.kind === 'loading') {
    return (
      <Screen eyebrow="Send" title="Preparing payment">
        <Card
          title="Loading account state"
          description="Fresnica is loading current Testnet balances before constructing a payment."
        />
      </Screen>
    );
  }

  if (loadState.kind === 'blocked') {
    return (
      <Screen eyebrow="Send" title="Send unavailable">
        <Card title={loadState.title} description={loadState.description} />
        <Button label="Back to Wallet" onPress={onDone} />
      </Screen>
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

function assetCode(review: PaymentReview): string {
  return review.asset.kind === 'native' ? 'XLM' : review.asset.code;
}

function sendSignerError(error: unknown): string {
  if (error instanceof Error && error.message === 'send-watch-only-account') {
    return 'This account is watch-only and has no attached local signer.';
  }
  if (error instanceof Error && error.message === 'send-multisig-not-supported') {
    return 'Multiple attached signers require the future multisig coordination milestone.';
  }
  return readableError(error);
}

function readableError(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown Send error.';
}
