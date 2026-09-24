import React, { useEffect, useMemo, useState } from 'react';

import type { AccountRecord } from '../../capabilities/account/types';
import type { StellarPaymentAsset, StellarPaymentMemo } from '../../capabilities/stellar/types';
import { useLocalization } from '../../locale';
import {
  buildRequestDraftUri,
  copyRequestUri,
  loadRequestAssetChoices,
  requestAssetKey,
  shareRequestUri,
  type RequestProductDependencies,
} from './requestProductFlow';
import { RequestFormScreen } from './RequestFormScreen';

const NATIVE_ASSET: StellarPaymentAsset = Object.freeze({ kind: 'native' });

type Props = Readonly<{
  account: AccountRecord;
  dependencies: RequestProductDependencies;
  onDone: () => void;
}>;

export function RequestFlowScreen({ account, dependencies, onDone }: Props) {
  const { t } = useLocalization();
  const [assets, setAssets] = useState<readonly StellarPaymentAsset[]>([NATIVE_ASSET]);
  const [selectedAsset, setSelectedAsset] = useState<StellarPaymentAsset>(NATIVE_ASSET);
  const [assetWarning, setAssetWarning] = useState<string>();
  const [amountEnabled, setAmountEnabled] = useState(false);
  const [amount, setAmount] = useState('');
  const [memoType, setMemoType] = useState<'none' | StellarPaymentMemo['type']>('none');
  const [memoValue, setMemoValue] = useState('');
  const [message, setMessage] = useState('');
  const [qrVisible, setQrVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [outputError, setOutputError] = useState<string>();
  const [status, setStatus] = useState<string>();

  useEffect(() => {
    let cancelled = false;
    setAssetWarning(undefined);
    loadRequestAssetChoices(dependencies, account)
      .then(nextAssets => {
        if (cancelled) return;
        setAssets(nextAssets);
        setSelectedAsset(current =>
          nextAssets.some(asset => requestAssetKey(asset) === requestAssetKey(current)) ? current : NATIVE_ASSET,
        );
      })
      .catch(() => {
        if (cancelled) return;
        setAssets([NATIVE_ASSET]);
        setSelectedAsset(NATIVE_ASSET);
        setAssetWarning(t('request.asset.warning'));
      });
    return () => {
      cancelled = true;
    };
  }, [account, dependencies, t]);

  const projection = useMemo(() => {
    try {
      const memo = memoType === 'none' ? undefined : ({ type: memoType, value: memoValue } as StellarPaymentMemo);
      const uri = buildRequestDraftUri(
        dependencies,
        account,
        {
          asset: selectedAsset,
          ...(amountEnabled ? { amount } : {}),
          ...(memo === undefined ? {} : { memo }),
          ...(message.length === 0 ? {} : { message }),
        },
        assets,
      );
      return { uri } as const;
    } catch (error) {
      return { error: requestErrorMessage(error, t) } as const;
    }
  }, [account, amount, amountEnabled, assets, dependencies, memoType, memoValue, message, selectedAsset, t]);

  const clearOutputFeedback = () => {
    setOutputError(undefined);
    setStatus(undefined);
  };

  const runOutput = async (operation: 'copy' | 'share') => {
    if (!projection.uri || busy) return;
    setBusy(true);
    setOutputError(undefined);
    setStatus(undefined);
    try {
      if (operation === 'copy') {
        await copyRequestUri(dependencies, projection.uri);
        setStatus(t('request.status.copied'));
      } else {
        const result = await shareRequestUri(dependencies, projection.uri);
        if (result === 'shared') setStatus(t('request.status.shared'));
      }
    } catch {
      setOutputError(t(operation === 'copy' ? 'request.error.copy' : 'request.error.share'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <RequestFormScreen
      accountAddress={account.address}
      accountLabel={account.label.trim() || t('request.accountFallback')}
      amount={amount}
      amountEnabled={amountEnabled}
      assetWarning={assetWarning}
      assets={assets}
      busy={busy}
      canonicalUri={projection.uri}
      error={outputError ?? projection.error}
      memoType={memoType}
      memoValue={memoValue}
      message={message}
      onCancel={onDone}
      onChangeAmount={value => {
        setAmount(value);
        clearOutputFeedback();
      }}
      onChangeMemoValue={value => {
        setMemoValue(value);
        clearOutputFeedback();
      }}
      onChangeMessage={value => {
        setMessage(value);
        clearOutputFeedback();
      }}
      onCopy={() => runOutput('copy')}
      onSelectAsset={asset => {
        setSelectedAsset(asset);
        clearOutputFeedback();
      }}
      onSelectMemoType={type => {
        setMemoType(type);
        setMemoValue('');
        clearOutputFeedback();
      }}
      onSetAmountEnabled={enabled => {
        setAmountEnabled(enabled);
        if (!enabled) setAmount('');
        clearOutputFeedback();
      }}
      onShare={() => runOutput('share')}
      onToggleQr={() => setQrVisible(current => !current)}
      qrVisible={qrVisible}
      selectedAsset={selectedAsset}
      status={status}
    />
  );
}

function requestErrorMessage(error: unknown, t: (key: string) => string): string {
  const message = error instanceof Error ? error.message : '';
  switch (message) {
    case 'request-invalid-amount':
      return t('request.error.amount');
    case 'request-invalid-memo':
    case 'request-memo-hash-invalid':
      return t('request.error.memo');
    case 'request-sensitive-input':
      return t('request.error.sensitive');
    case 'request-message-too-long':
      return t('request.error.message');
    case 'request-network-mismatch':
      return t('request.error.network');
    case 'request-asset-not-receivable':
      return t('request.error.asset');
    case 'request-requires-classic-account':
      return t('request.error.account');
    default:
      return t('request.error.invalid');
  }
}
