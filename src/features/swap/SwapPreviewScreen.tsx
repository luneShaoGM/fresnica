import Clipboard from '@react-native-clipboard/clipboard';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  ActivityIndicator,
  BackHandler,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';

import { AccountIdentityCard, Screen, TransactionResult } from '@ui/components';
import type { TransactionResultAction, TransactionResultDetail, TransactionResultTone } from '@ui/components';
import { NativeButton } from '@ui/components/NativeButton';
import { SlideToConfirm } from '../../ui/SlideToConfirm';
import { useThemedStyles } from '../../ui/theme';
import { useLocalization } from '../../locale';
import { rememberSpendableAssets } from '../../capabilities/balance/BalanceCacheRepository';
import type { AccountRecord } from '../../capabilities/account/types';
import type { PendingSubmissionRecord } from '../../capabilities/transaction/pendingSubmission';
import type { SubmitReviewedTransactionResult } from '../../capabilities/transaction/submitReviewedTransaction';
import type { StellarPaymentAsset } from '../../capabilities/stellar/types';
import { transactionExplorerUrl } from '../../capabilities/network/transactionExplorer';
import type {
  PathPaymentMode,
  PathPaymentQuote,
  PreparedPathPaymentReview,
} from '../../capabilities/path-payment/types';
import type { PathPaymentSourceAvailability } from '../../capabilities/path-payment/sourceAvailability';
import { derivePathPaymentProtection } from '../../capabilities/path-payment/quotePolicy';
import { projectFeatureError } from '../featureError';
import {
  loadSwapAssetAvailability,
  prepareSwapPreviewReview,
  requestSwapPreviewQuotes,
  type SwapPreviewProductDependencies,
} from './swapPreviewProductFlow';
import { readCachedSwapAssets, spendableAssetsFromOptions } from './cachedSwapAssets';
import { createSwapPreviewStyles } from './styles';
import { isQuotableSwapAmount, SwapAmountInput } from './SwapAmountInput';
import {
  formatSlippagePermille,
  formatSwapRate,
  normalizeSlippagePermille,
  parseSlippagePermille,
} from './swapPresentation';
import { SwapPassphraseInput, type SwapPassphraseInputHandle } from './SwapPassphraseInput';
import {
  listSwapHistory,
  reconcileSwapPending,
  submitSwapReview,
  type SwapSubmissionProductDependencies,
} from './swapSubmissionProductFlow';

type SwapTerminalResult = Exclude<SubmitReviewedTransactionResult, { status: 'passphrase-required' }>;
type ViewState =
  | Readonly<{ kind: 'form' }>
  | Readonly<{ kind: 'quotes'; quotes: readonly PathPaymentQuote[]; selected: PathPaymentQuote }>
  | Readonly<{ kind: 'review'; review: PreparedPathPaymentReview }>
  | Readonly<{ kind: 'result'; result: SwapTerminalResult }>;

type Props = Readonly<{
  account: AccountRecord;
  active: boolean;
  selectedAccountId: string;
  dependencies: SwapPreviewProductDependencies;
  execution: SwapSubmissionProductDependencies;
  captureSession: () => () => boolean;
  openExternalUrl: (url: string) => Promise<void>;
  onManageAssets: () => void;
  onDone: () => void;
}>;

function assetLabel(asset: StellarPaymentAsset): string {
  return asset.kind === 'native' ? 'XLM' : asset.code + ' · ' + asset.issuer;
}

function resultTone(status: SwapTerminalResult['status']): TransactionResultTone {
  switch (status) {
    case 'submitted':
      return 'success';
    case 'uncertain':
      return 'unverified';
    case 'rejected':
    case 'authorization-blocked':
    case 'unsupported-signer':
      return 'failed';
  }
}

function fullPath(assets: readonly StellarPaymentAsset[], directLabel = '—'): string {
  return assets.length === 0 ? directLabel : assets.map(assetLabel).join(' → ');
}

function pathIdentity(assets: readonly StellarPaymentAsset[]): string {
  return assets.length === 0 ? 'direct' : assets.map(assetLabel).join('>');
}

function initialShownAssets(
  dependencies: SwapPreviewProductDependencies,
  account: AccountRecord,
): Readonly<{ options: readonly PathPaymentSourceAvailability[]; fee?: number; ready: boolean }> {
  const memory = dependencies.assetCache?.get(dependencies.network.id, account.id);
  if (memory && memory.options.length > 0) {
    return { options: memory.options, fee: memory.baseFeeStroops, ready: true };
  }
  const durable = readCachedSwapAssets(dependencies.balanceCache, account);
  if (durable && durable.options.length > 0) {
    return {
      options: durable.options,
      fee: durable.authoritative ? durable.baseFeeStroops : undefined,
      ready: true,
    };
  }
  return { options: [], ready: false };
}

function availabilityIdentity(option: PathPaymentSourceAvailability): string {
  return option.asset.kind === 'native' ? 'native' : `${option.asset.code}:${option.asset.issuer}`;
}

function mergeShownAvailability(
  current: readonly PathPaymentSourceAvailability[],
  next: readonly PathPaymentSourceAvailability[],
): readonly PathPaymentSourceAvailability[] {
  if (current.length === 0) return next;
  const incoming = new Map(next.map(option => [availabilityIdentity(option), option]));
  const merged = current.map(option => incoming.get(availabilityIdentity(option)) ?? option);
  const seen = new Set(merged.map(availabilityIdentity));
  return [...merged, ...next.filter(option => !seen.has(availabilityIdentity(option)))];
}

function quoteProtectionValue(
  quote: PathPaymentQuote,
  slippageBps: number | undefined,
  dependencies: SwapPreviewProductDependencies,
): string {
  if (slippageBps === undefined) return '—';
  try {
    const protection = derivePathPaymentProtection(quote, slippageBps, dependencies.quotes);
    return protection.mode === 'strict_send' ? protection.destinationMinimum : protection.sourceMaximum;
  } catch {
    return '—';
  }
}

export function SwapPreviewScreen({
  account,
  active,
  selectedAccountId,
  dependencies,
  execution,
  captureSession,
  openExternalUrl,
  onManageAssets,
  onDone,
}: Props) {
  const { t } = useLocalization();
  const styles = useThemedStyles(createSwapPreviewStyles);
  const [assetOptions, setAssetOptions] = useState(() => initialShownAssets(dependencies, account).options);
  const [loading, setLoading] = useState(() => !initialShownAssets(dependencies, account).ready);
  const [assetLoadRevision, setAssetLoadRevision] = useState(0);
  const [sourceIndex, setSourceIndex] = useState(0);
  const [destinationIndex, setDestinationIndex] = useState(1);
  const [mode, setMode] = useState<PathPaymentMode>('strict_send');
  const [sourceAmount, setSourceAmount] = useState('');
  const [destinationAmount, setDestinationAmount] = useState('');
  const [slippageInput, setSlippageInput] = useState('5');
  const [allowIntermediatePaths, setAllowIntermediatePaths] = useState(true);
  const [settingsExpanded, setSettingsExpanded] = useState(false);
  const [assetPicker, setAssetPicker] = useState<'source' | 'destination'>();
  const [view, setView] = useState<ViewState>({ kind: 'form' });
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [passphraseRequired, setPassphraseRequired] = useState(false);
  const [hasPassphrase, setHasPassphrase] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [history, setHistory] = useState<readonly PendingSubmissionRecord[]>([]);
  const [reconcileError, setReconcileError] = useState<string>();
  const [reconciling, setReconciling] = useState(false);
  const [explorerState, setExplorerState] = useState<'idle' | 'opening' | 'failed'>('idle');
  const [settingsSlippageDraft, setSettingsSlippageDraft] = useState('5');
  const [estimatedFeeStroops, setEstimatedFeeStroops] = useState(() => initialShownAssets(dependencies, account).fee);
  const [assetSnapshotCurrent, setAssetSnapshotCurrent] = useState(
    () => initialShownAssets(dependencies, account).ready,
  );
  const attempt = useRef(0);
  const locked = useRef(false);
  const submitLocked = useRef(false);
  const reconcileLocked = useRef(false);
  const explorerLocked = useRef(false);
  const securePassphraseInput = useRef<SwapPassphraseInputHandle>(null);
  const selectedPathIdentity = useRef<string | undefined>(undefined);
  const assetAttempt = useRef(0);

  const clearPassphrase = useCallback(() => {
    securePassphraseInput.current?.clear();
    setHasPassphrase(false);
  }, []);

  const resetQuotes = useCallback(() => {
    attempt.current += 1;
    locked.current = false;
    setBusy(false);
    setError(undefined);
    setPassphraseRequired(false);
    clearPassphrase();
    setExplorerState('idle');
    explorerLocked.current = false;
    setView({ kind: 'form' });
  }, [clearPassphrase]);

  useEffect(() => {
    if (view.kind !== 'review') return undefined;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!submitting) resetQuotes();
      return true;
    });
    return () => subscription.remove();
  }, [resetQuotes, submitting, view.kind]);

  useEffect(() => {
    const generation = ++assetAttempt.current;
    const memory = dependencies.assetCache?.get(dependencies.network.id, account.id);
    const durable = readCachedSwapAssets(dependencies.balanceCache, account);
    const shown = memory
      ? { options: memory.options, baseFeeStroops: memory.baseFeeStroops, authoritative: true }
      : durable;
    const hasShownAssets = shown !== undefined && shown.options.length > 0;
    locked.current = false;
    setAssetOptions(shown?.options ?? []);
    setEstimatedFeeStroops(shown?.authoritative ? shown.baseFeeStroops : undefined);
    setAssetSnapshotCurrent(hasShownAssets);
    setSourceIndex(0);
    setDestinationIndex(1);
    setSourceAmount('');
    setDestinationAmount('');
    setMode('strict_send');
    setAssetPicker(undefined);
    setView({ kind: 'form' });
    setError(undefined);
    setBusy(false);
    clearPassphrase();
    setPassphraseRequired(false);
    setSubmitting(false);
    setHistory([]);
    setReconcileError(undefined);
    setReconciling(false);
    setExplorerState('idle');
    explorerLocked.current = false;
    setLoading(active && !hasShownAssets);
    if (!active) {
      return () => {
        assetAttempt.current += 1;
      };
    }
    const session = captureSession();
    const valid = () => assetAttempt.current === generation && session();
    if (!valid()) {
      setLoading(false);
      setError(t('swap.error.session'));
      return () => {
        assetAttempt.current += 1;
      };
    }
    try {
      setHistory(listSwapHistory(execution, account, valid));
    } catch (caught) {
      if (valid()) setReconcileError(errorText(caught, t));
    }
    loadSwapAssetAvailability(dependencies, account, valid)
      .then(snapshot => {
        if (!valid()) return;
        dependencies.assetCache?.set(dependencies.network.id, account.id, snapshot);
        if (dependencies.balanceCache && account.identityKind === 'classic') {
          rememberSpendableAssets(
            dependencies.balanceCache,
            { networkId: account.networkId, accountAddress: account.address },
            spendableAssetsFromOptions(snapshot.options),
            snapshot.baseFeeStroops,
            new Date(),
          );
        }
        setAssetOptions(current => mergeShownAvailability(current, snapshot.options));
        setEstimatedFeeStroops(snapshot.baseFeeStroops);
        setAssetSnapshotCurrent(true);
      })
      .catch(caught => {
        if (!valid()) return;
        if (!hasShownAssets) dependencies.assetCache?.remove(dependencies.network.id, account.id);
        setError(errorText(caught, t));
      })
      .finally(() => {
        if (valid()) setLoading(false);
      });
    return () => {
      assetAttempt.current += 1;
    };
  }, [account, active, assetLoadRevision, captureSession, clearPassphrase, dependencies, execution, t]);

  const startQuote = useCallback(async () => {
    if (busy || locked.current || !assetSnapshotCurrent || assetOptions.length < 2) return;
    const sourceAsset = assetOptions[sourceIndex]?.asset;
    const destinationAsset = assetOptions[destinationIndex]?.asset;
    if (!sourceAsset || !destinationAsset) return;
    const fixedAmount = mode === 'strict_send' ? sourceAmount : destinationAmount;
    if (!isQuotableSwapAmount(fixedAmount)) return;
    locked.current = true;
    const generation = ++attempt.current;
    const session = captureSession();
    const valid = () => generation === attempt.current && session();
    setBusy(true);
    setError(undefined);
    try {
      const result = await requestSwapPreviewQuotes(
        dependencies,
        account,
        {
          mode,
          fixedAmount,
          sourceAsset,
          destinationAsset,
          allowIntermediatePaths,
        },
        valid,
      );
      if (valid()) {
        const selected =
          result.quotes.find(quote => pathIdentity(quote.path) === selectedPathIdentity.current) ?? result.best;
        selectedPathIdentity.current = pathIdentity(selected.path);
        if (mode === 'strict_send') setDestinationAmount(selected.destinationAmount);
        else setSourceAmount(selected.sourceAmount);
        setView({ kind: 'quotes', ...result, selected });
      }
    } catch (caught) {
      if (valid()) setError(errorText(caught, t));
    } finally {
      if (generation === attempt.current) {
        locked.current = false;
        if (valid()) setBusy(false);
      }
    }
  }, [
    account,
    allowIntermediatePaths,
    assetSnapshotCurrent,
    assetOptions,
    busy,
    captureSession,
    dependencies,
    destinationAmount,
    destinationIndex,
    mode,
    sourceAmount,
    sourceIndex,
    t,
  ]);
  const quoteRequest = useRef<() => Promise<void>>(async () => undefined);
  quoteRequest.current = startQuote;

  useEffect(() => {
    const fixedAmount = mode === 'strict_send' ? sourceAmount : destinationAmount;
    if (
      view.kind !== 'form' ||
      loading ||
      !assetSnapshotCurrent ||
      assetOptions.length < 2 ||
      !isQuotableSwapAmount(fixedAmount)
    )
      return;
    const timer = setTimeout(() => {
      void quoteRequest.current();
    }, 500);
    return () => clearTimeout(timer);
  }, [
    allowIntermediatePaths,
    assetOptions.length,
    assetSnapshotCurrent,
    destinationAmount,
    destinationIndex,
    loading,
    mode,
    sourceAmount,
    sourceIndex,
    view.kind,
  ]);

  const editSourceAmount = useCallback(
    (value: string) => {
      setMode('strict_send');
      setSourceAmount(value);
      setDestinationAmount('');
      resetQuotes();
    },
    [resetQuotes],
  );

  const editDestinationAmount = useCallback(
    (value: string) => {
      setMode('strict_receive');
      setDestinationAmount(value);
      setSourceAmount('');
      resetQuotes();
    },
    [resetQuotes],
  );

  const exchangeAssets = useCallback(() => {
    setSourceIndex(destinationIndex);
    setDestinationIndex(sourceIndex);
    setSourceAmount('');
    setDestinationAmount('');
    selectedPathIdentity.current = undefined;
    setAssetPicker(undefined);
    resetQuotes();
  }, [destinationIndex, resetQuotes, sourceIndex]);

  const selectAsset = useCallback(
    (side: 'source' | 'destination', index: number) => {
      if (side === 'source') {
        if (index === destinationIndex) {
          setDestinationIndex(sourceIndex);
        }
        setSourceIndex(index);
      } else {
        if (index === sourceIndex) {
          setSourceIndex(destinationIndex);
        }
        setDestinationIndex(index);
      }
      setSourceAmount('');
      setDestinationAmount('');
      selectedPathIdentity.current = undefined;
      setAssetPicker(undefined);
      resetQuotes();
    },
    [destinationIndex, resetQuotes, sourceIndex],
  );

  const selectQuote = useCallback(
    (quote: PathPaymentQuote) => {
      attempt.current += 1;
      setError(undefined);
      selectedPathIdentity.current = pathIdentity(quote.path);
      setSourceAmount(quote.sourceAmount);
      setDestinationAmount(quote.destinationAmount);
      if (view.kind === 'quotes') setView({ ...view, selected: quote });
    },
    [view],
  );

  const startReview = useCallback(async () => {
    if (view.kind !== 'quotes' || busy || locked.current) return;
    const slippageBps = parseSlippagePermille(slippageInput);
    if (slippageBps === undefined) {
      setError(t('swap.error.slippage'));
      return;
    }
    locked.current = true;
    const generation = ++attempt.current;
    const session = captureSession();
    const valid = () => generation === attempt.current && session();
    setBusy(true);
    setError(undefined);
    try {
      const review = await prepareSwapPreviewReview(dependencies, account, view.selected, slippageBps, valid);
      if (valid()) setView({ kind: 'review', review });
    } catch (caught) {
      if (valid()) setError(errorText(caught, t));
    } finally {
      if (generation === attempt.current) {
        locked.current = false;
        if (valid()) setBusy(false);
      }
    }
  }, [account, busy, captureSession, dependencies, slippageInput, t, view]);

  const confirmSwap = useCallback(async () => {
    if (view.kind !== 'review' || busy || submitting || submitLocked.current) return;
    // Never initiate a second trade while prior submission for this account
    // could still be on the network.
    if (history.some(record => record.state === 'uncertain' || record.state === 'submitting')) {
      setError(t('swap.error.pending'));
      return;
    }
    // Consume the password only for the direct D1 SDK call. It never enters
    // React state, a render prop, or the async callback's dependencies.
    const passphrase = passphraseRequired ? securePassphraseInput.current?.consume() : undefined;
    if (passphraseRequired && !passphrase) return;
    submitLocked.current = true;
    const generation = ++attempt.current;
    const session = captureSession();
    const valid = () => generation === attempt.current && session();
    setHasPassphrase(false);
    setSubmitting(true);
    setError(undefined);
    try {
      if (!valid()) throw new Error('swap-session-stale');
      const result = await submitSwapReview(execution, account, view.review, valid, passphrase);
      if (!valid()) return;
      if (result.status === 'passphrase-required') {
        setPassphraseRequired(true);
        return;
      }
      setPassphraseRequired(false);
      setView({ kind: 'result', result });
      try {
        setHistory(listSwapHistory(execution, account, valid));
      } catch {
        // A local history read can fail AFTER Horizon acceptance. Never tell
        // the user the signed transaction failed or suggest retrying it.
        if (valid()) setReconcileError(t('swap.error.historyUnavailable'));
      }
    } catch (caught) {
      if (valid()) setError(errorText(caught, t));
    } finally {
      if (generation === attempt.current) {
        submitLocked.current = false;
        if (valid()) setSubmitting(false);
      }
    }
  }, [account, busy, captureSession, execution, history, passphraseRequired, submitting, t, view]);

  const checkPending = useCallback(async () => {
    if (reconcileLocked.current || submitting || busy) return;
    reconcileLocked.current = true;
    const generation = ++attempt.current;
    const session = captureSession();
    const valid = () => generation === attempt.current && session();
    setReconcileError(undefined);
    setReconciling(true);
    try {
      await reconcileSwapPending(execution, account, valid);
      if (valid()) setHistory(listSwapHistory(execution, account, valid));
    } catch (caught) {
      if (valid()) setReconcileError(errorText(caught, t));
    } finally {
      if (generation === attempt.current) {
        reconcileLocked.current = false;
        if (valid()) setReconciling(false);
      }
    }
  }, [account, busy, captureSession, execution, submitting, t]);

  const unresolved = history.some(record => record.state === 'uncertain' || record.state === 'submitting');
  const sourceOption = assetOptions[sourceIndex];
  const destinationOption = assetOptions[destinationIndex];
  const selectedQuote = view.kind === 'quotes' ? view.selected : undefined;
  const showTradeForm = view.kind === 'form' || view.kind === 'quotes';
  const accountCurrent = selectedAccountId === account.id && active;
  if (!accountCurrent) {
    return (
      <Screen scrollable={false} contentInset="none">
        <View style={styles.content}>
          <Text style={styles.heading}>{t('swap.error.session')}</Text>
          <NativeButton label={t('common.back')} onPress={onDone} size="md" variant="quiet" />
        </View>
      </Screen>
    );
  }

  const close = () => {
    attempt.current += 1;
    clearPassphrase();
    onDone();
  };

  const onHeaderBack = () => {
    if (view.kind === 'review') {
      if (!submitting) resetQuotes();
      return;
    }
    close();
  };

  const resultHash =
    view.kind === 'result'
      ? 'hash' in view.result
        ? view.result.hash
        : 'transactionHash' in view.result
          ? view.result.transactionHash
          : undefined
      : undefined;
  const explorerUrl = resultHash === undefined ? undefined : transactionExplorerUrl(account.networkId, resultHash);
  const formControlsDisabled = busy && view.kind !== 'form';
  const openResultExplorer = async () => {
    if (explorerUrl === undefined || explorerLocked.current) return;
    explorerLocked.current = true;
    setExplorerState('opening');
    try {
      await openExternalUrl(explorerUrl);
      setExplorerState('idle');
    } catch {
      setExplorerState('failed');
      AccessibilityInfo.announceForAccessibility(t('swap.result.explorerError'));
    } finally {
      explorerLocked.current = false;
    }
  };

  if (view.kind === 'result') {
    const details: TransactionResultDetail[] = [];
    if (resultHash) {
      details.push({ label: t('swap.history.hash'), value: resultHash, copyLabel: t('common.copy') });
    }
    if (view.result.status === 'submitted' && view.result.ledger !== undefined) {
      details.push({ label: t('swap.history.ledger'), value: String(view.result.ledger) });
    }
    if (view.result.status === 'rejected' && view.result.resultCode) {
      details.push({ label: t('swap.result.code'), value: view.result.resultCode, copyLabel: t('common.copy') });
    }
    if (view.result.status === 'authorization-blocked') {
      details.push({ label: t('swap.result.reason'), value: view.result.reason });
    }
    const highlight =
      view.result.status === 'submitted' && sourceOption && destinationOption && sourceAmount && destinationAmount
        ? `${sourceAmount} ${assetShortLabel(sourceOption.asset)} → ${destinationAmount} ${assetShortLabel(destinationOption.asset)}`
        : undefined;
    const resultActions: TransactionResultAction[] = [];
    if (unresolved || view.result.status === 'uncertain') {
      resultActions.push({
        label: reconciling ? t('swap.history.checking') : t('swap.history.check'),
        disabled: reconciling || busy || submitting,
        onPress: () => checkPending(),
      });
    }
    if (explorerUrl) {
      resultActions.push({
        label: explorerState === 'opening' ? t('swap.result.explorerOpening') : t('swap.result.openExplorer'),
        disabled: explorerState === 'opening',
        onPress: () => openResultExplorer(),
      });
    }
    return (
      <Screen scrollable={false} contentInset="none">
        <TransactionResult
          actions={resultActions}
          details={details}
          highlight={highlight}
          notice={explorerState === 'failed' ? t('swap.result.explorerError') : reconcileError}
          onCopy={value => {
            Clipboard.setString(value);
            AccessibilityInfo.announceForAccessibility(t('common.copied'));
          }}
          primaryAction={{ label: t('swap.preview.done'), onPress: close }}
          subtitle={t('swap.result.description.' + view.result.status)}
          title={t('swap.result.' + view.result.status)}
          tone={resultTone(view.result.status)}
        />
      </Screen>
    );
  }

  return (
    <Screen scrollable={false} contentInset="none">
      <View style={styles.header}>
        <View style={styles.headerSide}>
          <NativeButton
            label={t('common.back')}
            disabled={submitting}
            onPress={onHeaderBack}
            size="sm"
            variant="quiet"
          />
        </View>
        <Text style={styles.heading}>{t('swap.preview.title')}</Text>
        <View style={styles.headerSide} />
      </View>
      <View style={styles.headerAccount}>
        <AccountIdentityCard address={account.address} name={account.label.trim() || 'Account'} variant="default" />
      </View>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
        {loading && assetOptions.length === 0 ? (
          <>
            <ActivityIndicator accessibilityLabel={t('swap.preview.loading')} />
            <SwapAssetLoadingShell styles={styles} />
          </>
        ) : null}
        {!loading && assetOptions.length === 0 ? (
          <NativeButton
            label={t('swap.preview.retryAssets')}
            size="md"
            variant="quiet"
            onPress={() => setAssetLoadRevision(current => current + 1)}
          />
        ) : null}
        {!loading && assetOptions.length === 1 ? (
          <View style={styles.emptyState}>
            <Text style={styles.text}>{t('swap.assets.additionalRequired')}</Text>
            <Text style={styles.secondary}>{t('swap.assets.additionalRequiredHint')}</Text>
            <NativeButton label={t('swap.assets.add')} onPress={onManageAssets} size="md" variant="primary" />
            <NativeButton
              label={t('swap.preview.retryAssets')}
              onPress={() => setAssetLoadRevision(current => current + 1)}
              size="sm"
              variant="quiet"
            />
          </View>
        ) : null}
        {showTradeForm && sourceOption && destinationOption ? (
          <>
            <SwapAssetCard
              amount={sourceAmount}
              amountLabel={t('swap.form.payAmount')}
              amountPrefix="-"
              disabled={formControlsDisabled}
              label={t('swap.form.pay')}
              onChangeAmount={editSourceAmount}
              onClear={() => editSourceAmount('')}
              onMax={() => editSourceAmount(sourceOption.spendable)}
              onOpenAssets={() => setAssetPicker(assetPicker === 'source' ? undefined : 'source')}
              option={sourceOption}
              styles={styles}
              t={t}
            />
            <Pressable
              accessibilityLabel={t('swap.form.exchangeAssets')}
              accessibilityRole="button"
              disabled={formControlsDisabled}
              onPress={exchangeAssets}
              style={styles.exchangeButton}
            >
              <Text style={styles.exchangeGlyph}>⇅</Text>
            </Pressable>
            <SwapAssetCard
              amount={destinationAmount}
              amountLabel={t('swap.form.receiveAmount')}
              amountPrefix="~"
              disabled={formControlsDisabled}
              label={t('swap.form.receive')}
              onChangeAmount={editDestinationAmount}
              onClear={() => editDestinationAmount('')}
              onOpenAssets={() => setAssetPicker(assetPicker === 'destination' ? undefined : 'destination')}
              option={destinationOption}
              showSpendable={false}
              styles={styles}
              t={t}
            />
            {busy && view.kind === 'form' ? (
              <View style={styles.quoteLoading}>
                <ActivityIndicator accessibilityLabel={t('swap.preview.loading')} />
                <Text style={styles.secondary}>{t('swap.quote.refreshing')}</Text>
              </View>
            ) : null}
            {selectedQuote ? (
              <View style={styles.quoteSummary}>
                <ReviewLine
                  label={t('swap.quote.rate')}
                  value={`1 ${assetShortLabel(sourceOption.asset)} = ${formatSwapRate(
                    selectedQuote.sourceAmount,
                    selectedQuote.destinationAmount,
                  )} ${assetShortLabel(destinationOption.asset)}`}
                />
                <ReviewLine
                  label={t(mode === 'strict_send' ? 'swap.preview.minReceive' : 'swap.preview.maxSend')}
                  value={quoteProtectionValue(selectedQuote, parseSlippagePermille(slippageInput), dependencies)}
                />
                <ReviewLine
                  label={t('swap.preview.fee')}
                  value={estimatedFeeStroops === undefined ? t('swap.quote.feeAtReview') : String(estimatedFeeStroops)}
                />
                <ReviewLine
                  label={t('swap.settings.slippage')}
                  value={formatSlippagePermille(parseSlippagePermille(slippageInput) ?? -1)}
                />
                <View style={styles.settingActionRow}>
                  <Text style={styles.label}>{t('swap.settings.intermediatePaths')}</Text>
                  <Pressable
                    accessibilityLabel={t('swap.settings.title')}
                    accessibilityRole="button"
                    disabled={formControlsDisabled}
                    onPress={() => {
                      setSettingsSlippageDraft(slippageInput);
                      setSettingsExpanded(true);
                    }}
                    style={styles.settingsActionButton}
                  >
                    <Text style={styles.settingsActionGlyph}>⚙︎</Text>
                  </Pressable>
                </View>
              </View>
            ) : null}
          </>
        ) : null}
        {view.kind === 'review' ? (
          <>
            <Text style={styles.heading}>{t('swap.preview.exactReview')}</Text>
            <ReviewLine label={t('swap.preview.mode')} value={t('swap.preview.' + view.review.mode)} />
            <ReviewLine label={t('swap.preview.source')} value={assetLabel(view.review.sourceAsset)} />
            <ReviewLine label={t('swap.preview.destination')} value={assetLabel(view.review.destinationAsset)} />
            <AccountIdentityCard
              address={view.review.source}
              name={reviewAccountName(account, view.review.source)}
              showSource
              sourceLabel={t('swap.preview.from')}
              variant="compact"
            />
            {view.review.destination === view.review.source ? null : (
              <AccountIdentityCard
                address={view.review.destination}
                name={reviewAccountName(account, view.review.destination)}
                showSource
                sourceLabel={t('swap.preview.to')}
                variant="compact"
              />
            )}
            <ReviewLine label={t('swap.preview.sourceAmount')} value={view.review.quotedSourceAmount} />
            <ReviewLine label={t('swap.preview.destinationAmount')} value={view.review.quotedDestinationAmount} />
            <ReviewLine
              label={t('swap.preview.path')}
              value={fullPath(view.review.path, t('swap.preview.directPath'))}
            />
            <ReviewLine
              label={t(view.review.mode === 'strict_send' ? 'swap.preview.minReceive' : 'swap.preview.maxSend')}
              value={view.review.mode === 'strict_send' ? view.review.destinationMinimum : view.review.sourceMaximum}
            />
            <ReviewLine label={t('swap.preview.slippage')} value={formatSlippagePermille(view.review.slippageBps)} />
            <ReviewLine label={t('swap.preview.fee')} value={view.review.fee} />
            <ReviewLine
              label={t('swap.preview.expires')}
              value={new Date(view.review.expiresAtUnixSeconds * 1000).toLocaleString()}
            />
            <View style={styles.notice}>
              <Text style={styles.text}>{t('swap.execution.authorizationNotice')}</Text>
              {unresolved ? <Text style={styles.error}>{t('swap.error.pending')}</Text> : null}
            </View>
            {passphraseRequired ? (
              <View style={styles.section}>
                <Text accessibilityLiveRegion="assertive" style={styles.text}>
                  {t('swap.execution.passphraseRequired')}
                </Text>
                <SwapPassphraseInput
                  ref={securePassphraseInput}
                  label={t('swap.execution.appPassphrase')}
                  hint={t('swap.execution.passphraseHint')}
                  disabled={submitting}
                  onPresenceChange={setHasPassphrase}
                  style={styles.input}
                />
              </View>
            ) : null}
          </>
        ) : null}
        {unresolved && history.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.label}>{t('swap.history.title')}</Text>
            {history.map(record => (
              <View style={styles.route} key={record.id}>
                <Text style={styles.text}>{t('swap.history.state.' + record.state)}</Text>
                <Text selectable style={styles.mono}>
                  {record.transactionHash}
                </Text>
                {record.ledger === undefined ? null : (
                  <Text style={styles.secondary}>
                    {t('swap.history.ledger')}: {record.ledger}
                  </Text>
                )}
                {record.resultCode === undefined ? null : (
                  <Text style={styles.secondary}>
                    {t('swap.result.code')}: {record.resultCode}
                  </Text>
                )}
              </View>
            ))}
            {unresolved ? (
              <NativeButton
                label={reconciling ? t('swap.history.checking') : t('swap.history.check')}
                disabled={reconciling || busy || submitting}
                onPress={() => checkPending()}
                size="md"
                variant="quiet"
              />
            ) : null}
          </View>
        ) : null}
        {reconcileError ? (
          <Text accessibilityLiveRegion="assertive" style={styles.error}>
            {reconcileError}
          </Text>
        ) : null}
        {error ? (
          <Text accessibilityLiveRegion="assertive" style={styles.error}>
            {error}
          </Text>
        ) : null}
      </ScrollView>

      {assetPicker ? (
        <AssetPickerModal
          closeLabel={t('common.close')}
          disabled={formControlsDisabled}
          onClose={() => setAssetPicker(undefined)}
          onSelect={index => selectAsset(assetPicker, index)}
          options={assetOptions}
          searchLabel={t('swap.assetPicker.search')}
          emptyLabel={t('swap.assetPicker.empty')}
          clearSearchLabel={t('swap.assetPicker.clearSearch')}
          selectedIndex={assetPicker === 'source' ? sourceIndex : destinationIndex}
          side={assetPicker}
          styles={styles}
          title={t(assetPicker === 'source' ? 'swap.assetPicker.payTitle' : 'swap.assetPicker.receiveTitle')}
        />
      ) : null}
      {settingsExpanded ? (
        <SwapSettingsModal
          allowIntermediatePaths={allowIntermediatePaths}
          closeLabel={t('common.close')}
          disabled={formControlsDisabled}
          doneLabel={t('swap.settings.done')}
          intermediateLabel={t('swap.settings.intermediatePaths')}
          onClose={() => {
            setSettingsSlippageDraft(slippageInput);
            setSettingsExpanded(false);
          }}
          onDone={() => {
            const nextSlippage = normalizeSlippagePermille(settingsSlippageDraft, slippageInput);
            setSettingsSlippageDraft(nextSlippage);
            setSlippageInput(nextSlippage);
            setSettingsExpanded(false);
            resetQuotes();
          }}
          onSelectRoute={selectQuote}
          onSelectSlippage={value => {
            setSettingsSlippageDraft(value);
            setSlippageInput(value);
            resetQuotes();
          }}
          onToggleIntermediate={() => {
            setAllowIntermediatePaths(current => !current);
            resetQuotes();
          }}
          onCommitSlippage={() => {
            const nextSlippage = normalizeSlippagePermille(settingsSlippageDraft, slippageInput);
            setSettingsSlippageDraft(nextSlippage);
            if (nextSlippage === slippageInput) return;
            setSlippageInput(nextSlippage);
            resetQuotes();
          }}
          onUpdateSlippage={setSettingsSlippageDraft}
          routes={view.kind === 'quotes' ? view.quotes : []}
          selectedQuote={selectedQuote}
          slippageDraft={settingsSlippageDraft}
          slippageLabel={t('swap.settings.slippage')}
          styles={styles}
          t={t}
          title={t('swap.settings.title')}
        />
      ) : null}

      {view.kind === 'form' ? null : (
        <View style={styles.footer}>
          {view.kind === 'quotes' ? (
            <>
              <NativeButton
                label={busy ? t('swap.preview.loading') : t('swap.preview.swap')}
                disabled={busy}
                onPress={() => startReview()}
                size="lg"
                variant="primary"
              />
            </>
          ) : view.kind === 'review' ? (
            <>
              <SlideToConfirm
                label={passphraseRequired ? t('swap.execution.slidePassphrase') : t('swap.execution.slide')}
                loading={submitting}
                disabled={busy || submitting || unresolved || (passphraseRequired && !hasPassphrase)}
                onComplete={() => confirmSwap()}
              />
              <NativeButton
                label={t('swap.preview.requote')}
                disabled={submitting}
                onPress={resetQuotes}
                size="md"
                variant="quiet"
              />
            </>
          ) : (
            <NativeButton label={t('swap.preview.done')} onPress={close} size="lg" variant="primary" />
          )}
        </View>
      )}
    </Screen>
  );
}

type Styles = ReturnType<typeof createSwapPreviewStyles>;

function SwapAssetLoadingShell({ styles }: Readonly<{ styles: Styles }>): React.JSX.Element {
  return (
    <View style={styles.loadingTradeShell}>
      {[0, 1].map(index => (
        <View key={index} style={styles.assetCard}>
          <View style={styles.loadingAssetRow}>
            <View style={styles.loadingAssetIcon} />
            <View style={styles.loadingAssetIdentity} />
          </View>
          <View style={styles.loadingAmountLine} />
          <View style={styles.loadingBalanceLine} />
        </View>
      ))}
    </View>
  );
}

function assetShortLabel(asset: StellarPaymentAsset): string {
  return asset.kind === 'native' ? 'XLM' : asset.code;
}

function reviewAccountName(account: AccountRecord, address: string): string {
  if (address === account.address && account.label.trim()) {
    return account.label.trim();
  }
  return 'Account';
}

function SwapAssetCard({
  label,
  amountLabel,
  amountPrefix,
  option,
  amount,
  disabled,
  onChangeAmount,
  onOpenAssets,
  onClear,
  onMax,
  showSpendable = true,
  styles,
  t,
}: Readonly<{
  label: string;
  amountLabel: string;
  amountPrefix: '-' | '~';
  option: PathPaymentSourceAvailability;
  amount: string;
  disabled: boolean;
  onChangeAmount: (value: string) => void;
  onOpenAssets: () => void;
  onClear: () => void;
  onMax?: () => void;
  showSpendable?: boolean;
  styles: Styles;
  t: (key: string) => string;
}>) {
  return (
    <View style={styles.assetCard}>
      <View style={styles.assetCardHeader}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.secondary}>
          {t('swap.form.balance')}: {option.balance}
        </Text>
      </View>
      <View style={styles.assetAmountRow}>
        <Pressable
          accessibilityLabel={`${label}: ${assetShortLabel(option.asset)}`}
          accessibilityRole="button"
          disabled={disabled}
          onPress={onOpenAssets}
          style={styles.assetSelector}
        >
          <View style={styles.assetIcon}>
            <Text style={styles.assetIconText}>{assetShortLabel(option.asset).slice(0, 2).toUpperCase()}</Text>
          </View>
          <View style={styles.assetIdentity}>
            <Text style={styles.assetCode}>{assetShortLabel(option.asset)}</Text>
            {option.asset.kind === 'credit' ? (
              <Text numberOfLines={1} style={styles.mono}>
                {option.asset.issuer}
              </Text>
            ) : null}
          </View>
          <Text style={styles.assetChevron}>⌄</Text>
        </Pressable>
        <View style={styles.amountEditorRow}>
          <Text style={styles.amountPrefix}>{amountPrefix}</Text>
          <SwapAmountInput
            accessibilityLabel={amountLabel}
            disabled={disabled}
            onChangeAmount={onChangeAmount}
            style={styles.amountInput}
            value={amount}
          />
        </View>
      </View>
      <View style={styles.assetCardActions}>
        {showSpendable ? (
          <Text style={styles.secondary}>
            {t('swap.form.spendable')}: {option.spendable}
          </Text>
        ) : (
          <View />
        )}
        <View style={styles.inlineActions}>
          {onMax ? (
            <Pressable accessibilityRole="button" disabled={disabled} onPress={onMax}>
              <Text style={styles.actionText}>{t('swap.form.max')}</Text>
            </Pressable>
          ) : null}
          <Pressable accessibilityRole="button" disabled={disabled || !amount} onPress={onClear}>
            <Text style={styles.actionText}>{t('swap.form.clear')}</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

function SwapSettingsModal({
  allowIntermediatePaths,
  closeLabel,
  disabled,
  doneLabel,
  intermediateLabel,
  onClose,
  onCommitSlippage,
  onDone,
  onSelectRoute,
  onSelectSlippage,
  onToggleIntermediate,
  onUpdateSlippage,
  routes,
  selectedQuote,
  slippageDraft,
  slippageLabel,
  styles,
  t,
  title,
}: Readonly<{
  allowIntermediatePaths: boolean;
  closeLabel: string;
  disabled: boolean;
  doneLabel: string;
  intermediateLabel: string;
  onClose: () => void;
  onCommitSlippage: () => void;
  onDone: () => void;
  onSelectRoute: (quote: PathPaymentQuote) => void;
  onSelectSlippage: (value: string) => void;
  onToggleIntermediate: () => void;
  onUpdateSlippage: (value: string) => void;
  routes: readonly PathPaymentQuote[];
  selectedQuote: PathPaymentQuote | undefined;
  slippageDraft: string;
  slippageLabel: string;
  styles: Styles;
  t: (key: string) => string;
  title: string;
}>) {
  return (
    <Modal
      animationType="fade"
      onRequestClose={onClose}
      presentationStyle="overFullScreen"
      statusBarTranslucent
      transparent
      visible
    >
      <Pressable
        accessibilityLabel={closeLabel}
        accessibilityRole="button"
        onPress={onClose}
        style={styles.modalBackdrop}
      >
        <View style={styles.settingsModalPosition}>
          <Pressable onPress={event => event.stopPropagation()} style={styles.settingsModalCard}>
            <ScrollView
              bounces={false}
              contentContainerStyle={styles.settingsModalContent}
              keyboardShouldPersistTaps="handled"
            >
              <View style={styles.settingsModalHeader}>
                <Text style={styles.settingsModalTitle}>{title}</Text>
                <Pressable
                  accessibilityRole="button"
                  disabled={disabled}
                  onPress={onDone}
                  style={styles.settingsDoneButton}
                >
                  <Text style={styles.settingsDoneText}>{doneLabel}</Text>
                </Pressable>
              </View>

              <Pressable
                accessibilityRole="switch"
                accessibilityState={{ checked: allowIntermediatePaths }}
                disabled={disabled}
                onPress={onToggleIntermediate}
                style={styles.settingRow}
              >
                <Text style={styles.text}>{intermediateLabel}</Text>
                <View style={[styles.settingsSwitch, allowIntermediatePaths ? styles.settingsSwitchActive : undefined]}>
                  <View
                    style={[
                      styles.settingsSwitchThumb,
                      allowIntermediatePaths ? styles.settingsSwitchThumbActive : undefined,
                    ]}
                  />
                </View>
              </Pressable>

              <View style={styles.settingsRow}>
                <Text style={styles.text}>{slippageLabel}</Text>
                <View style={styles.slippageInputContainer}>
                  <TextInput
                    accessibilityLabel={slippageLabel}
                    editable={!disabled}
                    keyboardType="number-pad"
                    onChangeText={value => onUpdateSlippage(value.replace(/[^0-9]/g, ''))}
                    onEndEditing={onCommitSlippage}
                    style={styles.slippageInput}
                    value={slippageDraft}
                  />
                  <Text style={styles.slippageSuffix}>‰</Text>
                </View>
              </View>
              <View style={styles.slippagePresetRow}>
                {['1', '5', '10'].map(value => (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ selected: slippageDraft === value }}
                    disabled={disabled}
                    key={value}
                    onPress={() => onSelectSlippage(value)}
                    style={[styles.slippagePreset, slippageDraft === value ? styles.choiceSelected : undefined]}
                  >
                    <Text style={styles.choiceText}>{value}‰</Text>
                  </Pressable>
                ))}
              </View>

              {allowIntermediatePaths && routes.length > 1 ? (
                <View style={styles.settingsRoutes}>
                  <Text style={styles.label}>{t('swap.settings.candidateRoutes')}</Text>
                  {routes.map((quote, index) => {
                    const selected = selectedQuote === quote;
                    return (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityState={{ selected }}
                        disabled={disabled}
                        key={`${quote.sourceAmount}-${quote.destinationAmount}-${index}`}
                        onPress={() => onSelectRoute(quote)}
                        style={[styles.route, selected ? styles.routeSelected : undefined]}
                      >
                        <View style={styles.settingActionRow}>
                          <Text style={styles.choiceText}>
                            {t('swap.settings.route')} {index + 1}
                          </Text>
                          <Text style={styles.settingValue}>
                            {t(selected ? 'swap.settings.selected' : 'swap.settings.select')}
                          </Text>
                        </View>
                        <Text style={styles.secondary}>
                          {quote.sourceAmount} → {quote.destinationAmount}
                        </Text>
                        <Text style={styles.secondary}>
                          {quote.path.length === 0
                            ? t('swap.preview.directPath')
                            : `${quote.path.length} ${t('swap.settings.hops')}`}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              ) : null}
            </ScrollView>
          </Pressable>
        </View>
      </Pressable>
    </Modal>
  );
}

function AssetPickerModal({
  options,
  selectedIndex,
  disabled,
  onSelect,
  onClose,
  side,
  title,
  closeLabel,
  searchLabel,
  emptyLabel,
  clearSearchLabel,
  styles,
}: Readonly<{
  options: readonly PathPaymentSourceAvailability[];
  selectedIndex: number;
  disabled: boolean;
  onSelect: (index: number) => void;
  onClose: () => void;
  side: 'source' | 'destination';
  title: string;
  closeLabel: string;
  searchLabel: string;
  emptyLabel: string;
  clearSearchLabel: string;
  styles: Styles;
}>) {
  const [query, setQuery] = useState('');
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const filteredOptions = options
    .map((option, index) => ({ option, index }))
    .filter(({ option }) => {
      if (!normalizedQuery) return true;
      const searchable =
        option.asset.kind === 'native' ? 'xlm stellar native' : `${option.asset.code} ${option.asset.issuer}`;
      return searchable.toLocaleLowerCase().includes(normalizedQuery);
    });
  return (
    <Modal
      animationType="fade"
      onRequestClose={onClose}
      presentationStyle="overFullScreen"
      statusBarTranslucent
      transparent
      visible
    >
      <Pressable accessibilityRole="button" onPress={onClose} style={styles.assetPickerBackdrop}>
        <View
          style={[
            styles.assetPickerPopover,
            side === 'source' ? styles.assetPickerSourcePosition : styles.assetPickerDestinationPosition,
          ]}
        >
          <Pressable onPress={event => event.stopPropagation()} style={styles.assetPicker}>
            <View style={styles.assetPickerHeader}>
              <Text style={styles.assetPickerTitle}>{title}</Text>
              <Pressable accessibilityLabel={closeLabel} accessibilityRole="button" onPress={onClose}>
                <Text style={styles.assetPickerClose}>×</Text>
              </Pressable>
            </View>
            <View style={styles.assetPickerSearchRow}>
              <TextInput
                accessibilityLabel={searchLabel}
                autoCapitalize="none"
                autoCorrect={false}
                onChangeText={setQuery}
                placeholder={searchLabel}
                style={styles.assetPickerSearchInput}
                value={query}
              />
              {query ? (
                <Pressable accessibilityRole="button" onPress={() => setQuery('')}>
                  <Text style={styles.actionText}>{clearSearchLabel}</Text>
                </Pressable>
              ) : null}
            </View>
            <ScrollView bounces={false} style={styles.assetPickerList}>
              {filteredOptions.map(({ option, index }) => (
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected: selectedIndex === index }}
                  disabled={disabled}
                  key={`${assetLabel(option.asset)}-${index}`}
                  onPress={() => onSelect(index)}
                  style={[styles.assetPickerRow, selectedIndex === index ? styles.choiceSelected : undefined]}
                >
                  <Text style={styles.choiceText}>{assetShortLabel(option.asset)}</Text>
                  <Text numberOfLines={1} style={styles.mono}>
                    {option.asset.kind === 'credit' ? option.asset.issuer : 'Stellar native asset'}
                  </Text>
                  <Text style={styles.secondary}>{option.balance}</Text>
                </Pressable>
              ))}
              {filteredOptions.length === 0 ? <Text style={styles.assetPickerEmpty}>{emptyLabel}</Text> : null}
            </ScrollView>
          </Pressable>
        </View>
      </Pressable>
    </Modal>
  );
}

function ReviewLine({ label, value }: Readonly<{ label: string; value: string }>) {
  const styles = useThemedStyles(createSwapPreviewStyles);
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text selectable style={styles.rowValue}>
        {value}
      </Text>
    </View>
  );
}

function errorText(error: unknown, t: (key: string) => string): string {
  return projectFeatureError(error, {
    fallbackMessage: t('swap.error.general'),
    messages: {
      'swap-session-stale': t('swap.error.session'),
      'swap-assets-unavailable': t('swap.error.assets'),
      invalid_request: t('swap.error.invalid'),
      route_unavailable: t('swap.error.routes'),
      quote_unavailable: t('swap.error.quoteUnavailable'),
      quote_expired: t('swap.error.expired'),
      insufficient_source: t('swap.error.balance'),
      slippage_out_of_range: t('swap.error.slippage'),
      destination_no_trust: t('swap.error.trustline'),
      not_authorized: t('swap.error.trustline'),
      'swap-unresolved-pending': t('swap.error.pending'),
      path_payment_review_mismatch: t('swap.error.reviewMismatch'),
      path_payment_signer_mismatch: t('swap.error.signerMismatch'),
      'user-cancel': t('swap.error.cancelled'),
      'review-expired': t('swap.error.expiredTransaction'),
    },
  }).message;
}

export function SwapLoadingScreen(): React.JSX.Element {
  const styles = useThemedStyles(createSwapPreviewStyles);
  const { t } = useLocalization();
  return (
    <Screen scrollable={false} contentInset="none">
      <View style={styles.header}>
        <View style={styles.headerSide} />
        <Text style={styles.heading}>{t('swap.preview.title')}</Text>
        <View style={styles.headerSide} />
      </View>
      <View style={styles.loadingShell}>
        <ActivityIndicator accessibilityLabel={t('swap.preview.loading')} />
      </View>
    </Screen>
  );
}

export function SwapUnavailableScreen({ onDone }: Readonly<{ onDone: () => void }>) {
  const styles = useThemedStyles(createSwapPreviewStyles);
  const { t } = useLocalization();
  return (
    <Screen scrollable={false} contentInset="none">
      <View style={styles.content}>
        <Text style={styles.heading}>{t('swap.error.session')}</Text>
        <NativeButton label={t('common.back')} onPress={onDone} size="lg" variant="quiet" />
      </View>
    </Screen>
  );
}
