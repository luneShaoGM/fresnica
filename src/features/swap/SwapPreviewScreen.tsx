import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import { AccountIdentityCard, Screen } from '@ui/components';
import { NativeButton } from '@ui/components/NativeButton';
import { SlideToConfirm } from '../../ui/SlideToConfirm';
import { useThemedStyles } from '../../ui/theme';
import { useLocalization } from '../../locale';
import type { AccountRecord } from '../../capabilities/account/types';
import type { PendingSubmissionRecord } from '../../capabilities/transaction/pendingSubmission';
import type { StellarPaymentAsset } from '../../capabilities/stellar/types';
import type {
  PathPaymentMode,
  PathPaymentQuote,
  PreparedPathPaymentReview,
} from '../../capabilities/path-payment/types';
import { projectFeatureError } from '../featureError';
import {
  loadSwapPreviewAssets,
  loadSwapSourceSpendable,
  prepareSwapPreviewReview,
  requestSwapPreviewQuotes,
  type SwapPreviewProductDependencies,
} from './swapPreviewProductFlow';
import { createSwapPreviewStyles } from './styles';
import { SwapPassphraseInput, type SwapPassphraseInputHandle } from './SwapPassphraseInput';
import {
  listSwapHistory,
  reconcileSwapPending,
  submitSwapReview,
  type SwapSubmissionProductDependencies,
} from './swapSubmissionProductFlow';

import { isQuotableSwapAmount, SwapAmountInput } from './SwapAmountInput';
import { SwapResultScreen, type SwapTerminalResult } from './SwapResultScreen';
type ViewState =
  | Readonly<{ kind: 'form' }>
  | Readonly<{ kind: 'quotes'; quotes: readonly PathPaymentQuote[]; selected: PathPaymentQuote }>
  | Readonly<{ kind: 'review'; review: PreparedPathPaymentReview }>
  | Readonly<{ kind: 'result'; result: SwapTerminalResult }>;

type Props = Readonly<{
  account: AccountRecord;
  active: boolean;
  foreground: boolean;
  selectedAccountId: string;
  dependencies: SwapPreviewProductDependencies;
  execution: SwapSubmissionProductDependencies;
  captureSession: () => () => boolean;
  onDone: () => void;
  copyPublicText: (value: string) => Promise<void>;
  openExternalUrl: (url: string) => Promise<void>;
}>;

function assetLabel(asset: StellarPaymentAsset): string {
  return asset.kind === 'native' ? 'XLM' : asset.code + ' · ' + asset.issuer;
}

function fullPath(assets: readonly StellarPaymentAsset[]): string {
  return assets.length === 0 ? '—' : assets.map(assetLabel).join(' → ');
}

export function SwapPreviewScreen({
  account,
  active,
  foreground,
  selectedAccountId,
  dependencies,
  execution,
  captureSession,
  onDone,
  copyPublicText,
  openExternalUrl,
}: Props) {
  const { t } = useLocalization();
  const styles = useThemedStyles(createSwapPreviewStyles);
  const [assets, setAssets] = useState<readonly StellarPaymentAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [assetLoadRevision, setAssetLoadRevision] = useState(0);
  const [sourceIndex, setSourceIndex] = useState(0);
  const [destinationIndex, setDestinationIndex] = useState(1);
  const [mode, setMode] = useState<PathPaymentMode>('strict_send');
  const [amount, setAmount] = useState('');
  const [slippageInput, setSlippageInput] = useState('100');
  const [view, setView] = useState<ViewState>({ kind: 'form' });
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [passphraseRequired, setPassphraseRequired] = useState(false);
  const [hasPassphrase, setHasPassphrase] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [history, setHistory] = useState<readonly PendingSubmissionRecord[]>([]);
  const [reconcileError, setReconcileError] = useState<string>();
  const [reconciling, setReconciling] = useState(false);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [spendable, setSpendable] = useState<
    | Readonly<{ kind: 'loading' | 'unavailable'; key: string }>
    | Readonly<{ kind: 'ready'; key: string; amount: string }>
  >({ kind: 'unavailable', key: '' });
  const [spendableRevision, setSpendableRevision] = useState(0);
  const [maxLoading, setMaxLoading] = useState(false);
  const attempt = useRef(0);
  const locked = useRef(false);
  const submitLocked = useRef(false);
  const reconcileLocked = useRef(false);
  const securePassphraseInput = useRef<SwapPassphraseInputHandle>(null);
  const quoteTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const foregroundRef = useRef(foreground);
  foregroundRef.current = foreground;
  const spendableAttempt = useRef(0);
  const draftRevision = useRef(0);
  const maxReadLocked = useRef(false);
  const maxSurfaceRef = useRef(view.kind === 'form' || view.kind === 'quotes');
  maxSurfaceRef.current = view.kind === 'form' || view.kind === 'quotes';
  const selectedSourceAsset = assets[sourceIndex];
  const spendableKey = JSON.stringify([
    account.id,
    account.networkId,
    account.address,
    selectedSourceAsset ? assetLabel(selectedSourceAsset) : '',
  ]);

  const clearPassphrase = useCallback(() => {
    securePassphraseInput.current?.clear();
    setHasPassphrase(false);
  }, []);

  const resetQuotes = useCallback(() => {
    if (maxReadLocked.current) {
      maxReadLocked.current = false;
      setMaxLoading(false);
      setSpendableRevision(current => current + 1);
    }
    draftRevision.current += 1;
    attempt.current += 1;
    clearTimeout(quoteTimer.current);
    locked.current = false;
    setBusy(false);
    setError(undefined);
    setPassphraseRequired(false);
    clearPassphrase();
    setView({ kind: 'form' });
    setSettingsVisible(false);
  }, [clearPassphrase]);

  useEffect(() => {
    const generation = ++attempt.current;
    locked.current = false;
    setAssets([]);
    setSourceIndex(0);
    setDestinationIndex(1);
    setMode('strict_send');
    setSettingsVisible(false);
    setAmount('');
    setView({ kind: 'form' });
    setError(undefined);
    setBusy(false);
    clearPassphrase();
    setPassphraseRequired(false);
    setSubmitting(false);
    setHistory([]);
    setReconcileError(undefined);
    setReconciling(false);
    setLoading(active);
    if (!active)
      return () => {
        attempt.current += 1;
      };
    const session = captureSession();
    const valid = () => attempt.current === generation && session();
    if (!valid()) {
      setLoading(false);
      setError(t('swap.error.session'));
      return () => {
        attempt.current += 1;
      };
    }
    try {
      setHistory(listSwapHistory(execution, account, valid));
    } catch (caught) {
      if (valid()) setReconcileError(errorText(caught, t));
    }
    loadSwapPreviewAssets(dependencies, account, valid)
      .then(available => {
        if (!valid()) return;
        setAssets(available);
      })
      .catch(caught => {
        if (!valid()) return;
        setError(errorText(caught, t));
      })
      .finally(() => {
        if (valid()) setLoading(false);
      });
    return () => {
      attempt.current += 1;
    };
  }, [account, active, assetLoadRevision, captureSession, clearPassphrase, dependencies, execution, t]);

  const startQuote = useCallback(async () => {
    if (
      !foregroundRef.current ||
      busy ||
      maxLoading ||
      locked.current ||
      assets.length < 2 ||
      !isQuotableSwapAmount(amount)
    )
      return;
    clearTimeout(quoteTimer.current);
    const sourceAsset = assets[sourceIndex];
    const destinationAsset = assets[destinationIndex];
    if (!sourceAsset || !destinationAsset) return;
    locked.current = true;
    const generation = ++attempt.current;
    const session = captureSession();
    const valid = () => generation === attempt.current && foregroundRef.current && session();
    setBusy(true);
    setError(undefined);
    try {
      const result = await requestSwapPreviewQuotes(
        dependencies,
        account,
        {
          mode,
          fixedAmount: amount,
          sourceAsset,
          destinationAsset,
        },
        valid,
      );
      if (valid()) setView({ kind: 'quotes', ...result, selected: result.best });
    } catch (caught) {
      if (valid()) setError(errorText(caught, t));
    } finally {
      if (generation === attempt.current) {
        locked.current = false;
        if (valid()) setBusy(false);
      }
    }
  }, [account, amount, assets, busy, maxLoading, captureSession, dependencies, destinationIndex, mode, sourceIndex, t]);

  const quoteRequest = useRef(startQuote);
  quoteRequest.current = startQuote;
  useEffect(() => {
    if (
      !active ||
      !foreground ||
      selectedAccountId !== account.id ||
      loading ||
      view.kind !== 'form' ||
      locked.current ||
      maxLoading ||
      assets.length < 2 ||
      !isQuotableSwapAmount(amount)
    )
      return undefined;
    const timer = setTimeout(() => {
      void quoteRequest.current();
    }, 500);
    quoteTimer.current = timer;
    return () => clearTimeout(timer);
  }, [
    account.id,
    active,
    foreground,
    selectedAccountId,
    loading,
    view.kind,
    assets,
    amount,
    maxLoading,
    mode,
    sourceIndex,
    destinationIndex,
  ]);

  useEffect(() => {
    // Do not invalidate the native System Auth handoff of an explicitly submitted review.
    if (!foreground && !loading && (view.kind === 'form' || view.kind === 'quotes')) resetQuotes();
  }, [foreground, loading, view.kind, resetQuotes]);

  const startReview = useCallback(async () => {
    if (!foregroundRef.current || view.kind !== 'quotes' || busy || maxLoading || locked.current) return;
    const slippageText = slippageInput.trim();
    if (!/^(0|[1-9]\d{0,3})$/.test(slippageText) || Number(slippageText) > 1000) {
      setError(t('swap.error.slippage'));
      return;
    }
    locked.current = true;
    const generation = ++attempt.current;
    const session = captureSession();
    const valid = () => generation === attempt.current && foregroundRef.current && session();
    setBusy(true);
    setError(undefined);
    try {
      const review = await prepareSwapPreviewReview(dependencies, account, view.selected, Number(slippageText), valid);
      if (valid()) setView({ kind: 'review', review });
    } catch (caught) {
      if (valid()) setError(errorText(caught, t));
    } finally {
      if (generation === attempt.current) {
        locked.current = false;
        if (valid()) setBusy(false);
      }
    }
  }, [account, busy, maxLoading, captureSession, dependencies, slippageInput, t, view]);

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

  const spendableSurfaceActive = view.kind === 'form' || view.kind === 'quotes';
  useEffect(() => {
    const generation = ++spendableAttempt.current;
    maxReadLocked.current = false;
    setMaxLoading(false);
    if (
      !active ||
      !foreground ||
      loading ||
      !spendableSurfaceActive ||
      selectedAccountId !== account.id ||
      !selectedSourceAsset
    )
      return;
    const session = captureSession();
    const valid = () => generation === spendableAttempt.current && foregroundRef.current && session();
    setSpendable({ kind: 'loading', key: spendableKey });
    void loadSwapSourceSpendable(dependencies, account, selectedSourceAsset, valid)
      .then(amount => {
        if (!valid()) return;
        setSpendable(
          amount === undefined
            ? { kind: 'unavailable', key: spendableKey }
            : { kind: 'ready', key: spendableKey, amount },
        );
      })
      .catch(() => {
        if (valid()) setSpendable({ kind: 'unavailable', key: spendableKey });
      });
    return () => {
      spendableAttempt.current += 1;
    };
  }, [
    account,
    active,
    assets,
    captureSession,
    dependencies,
    foreground,
    loading,
    spendableSurfaceActive,
    selectedAccountId,
    selectedSourceAsset,
    spendableKey,
    spendableRevision,
  ]);

  const applyMax = async () => {
    if (
      !active ||
      !foregroundRef.current ||
      !spendableSurfaceActive ||
      !maxSurfaceRef.current ||
      selectedAccountId !== account.id ||
      !selectedSourceAsset ||
      maxLoading ||
      maxReadLocked.current ||
      busy ||
      locked.current ||
      spendable.kind !== 'ready' ||
      spendable.key !== spendableKey ||
      !isQuotableSwapAmount(spendable.amount)
    )
      return;
    const generation = ++spendableAttempt.current;
    maxReadLocked.current = true;
    locked.current = true;
    const draft = draftRevision.current;
    const session = captureSession();
    const valid = () =>
      generation === spendableAttempt.current &&
      draft === draftRevision.current &&
      maxSurfaceRef.current &&
      foregroundRef.current &&
      session();
    setMaxLoading(true);
    setSpendable({ kind: 'loading', key: spendableKey });
    try {
      const amount = await loadSwapSourceSpendable(dependencies, account, selectedSourceAsset, valid);
      if (!valid()) return;
      setSpendable(
        amount === undefined
          ? { kind: 'unavailable', key: spendableKey }
          : { kind: 'ready', key: spendableKey, amount },
      );
      if (amount !== undefined && isQuotableSwapAmount(amount)) {
        maxReadLocked.current = false;
        resetQuotes();
        setMode('strict_send');
        setAmount(amount);
      }
    } catch {
      if (valid()) setSpendable({ kind: 'unavailable', key: spendableKey });
    } finally {
      if (generation === spendableAttempt.current) {
        maxReadLocked.current = false;
        locked.current = false;
        setMaxLoading(false);
      }
    }
  };

  const unresolved = history.some(record => record.state === 'uncertain' || record.state === 'submitting');
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
    draftRevision.current += 1;
    spendableAttempt.current += 1;
    attempt.current += 1;
    clearTimeout(quoteTimer.current);
    clearPassphrase();
    onDone();
  };

  const selectedQuote = view.kind === 'quotes' ? view.selected : undefined;
  const sourceAmount = mode === 'strict_send' ? amount : (selectedQuote?.sourceAmount ?? '');
  const destinationAmount = mode === 'strict_receive' ? amount : (selectedQuote?.destinationAmount ?? '');
  const preparing = busy && view.kind === 'quotes';
  const visibleSpendable =
    foreground && spendable.key === spendableKey ? spendable : ({ kind: 'unavailable', key: spendableKey } as const);
  const editAmount = (nextMode: PathPaymentMode, value: string) => {
    if (preparing) return;
    setMode(nextMode);
    setAmount(value);
    resetQuotes();
  };

  const historyPanel = (
    <>
      {history.length > 0 || (view.kind === 'result' && view.result.status === 'uncertain') ? (
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
          {unresolved || (view.kind === 'result' && view.result.status === 'uncertain') ? (
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
    </>
  );

  if (view.kind === 'result') {
    return (
      <Screen scrollable={false} contentInset="none">
        <SwapResultScreen
          key={JSON.stringify(view.result)}
          account={account}
          result={view.result}
          captureSession={captureSession}
          copyPublicText={copyPublicText}
          openExternalUrl={openExternalUrl}
          onDone={close}
        >
          {historyPanel}
        </SwapResultScreen>
      </Screen>
    );
  }

  return (
    <Screen scrollable={false} contentInset="none">
      <View style={styles.header}>
        <NativeButton label={t('common.back')} disabled={submitting} onPress={close} size="sm" variant="quiet" />
        <Text style={styles.heading}>{t('swap.preview.title')}</Text>
        <View />
      </View>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
        <View style={styles.notice}>
          <Text style={styles.text}>{t('swap.preview.notice')}</Text>
          <Text style={styles.secondary}>{t('swap.execution.safePreview')}</Text>
        </View>
        <AccountIdentityCard address={account.address} name={account.label} label={t('swap.preview.account')} />

        {loading ? <ActivityIndicator accessibilityLabel={t('swap.preview.loading')} /> : null}
        {!loading && assets.length < 2 ? (
          <NativeButton
            label={t('swap.preview.retryAssets')}
            size="md"
            variant="quiet"
            onPress={() => setAssetLoadRevision(current => current + 1)}
          />
        ) : null}
        {(view.kind === 'form' || view.kind === 'quotes') && !loading && assets.length >= 2 ? (
          <>
            <View style={styles.section}>
              <Text style={styles.label}>{t('swap.preview.source')}</Text>
              <View style={styles.choices}>
                {assets.map((asset, index) => (
                  <AssetChoice
                    key={'source-' + assetLabel(asset)}
                    asset={asset}
                    selected={sourceIndex === index}
                    disabled={preparing}
                    onPress={() => {
                      if (preparing) return;
                      setSourceIndex(index);
                      if (index === destinationIndex) setDestinationIndex((index + 1) % assets.length);
                      resetQuotes();
                    }}
                  />
                ))}
              </View>
              <SwapAmountInput
                accessibilityLabel={t('swap.form.payAmount')}
                disabled={preparing}
                onChangeAmount={value => editAmount('strict_send', value)}
                style={styles.input}
                value={sourceAmount}
              />
              <View style={styles.row}>
                <Text style={styles.secondary}>
                  {t('swap.form.spendable')}:{' '}
                  {visibleSpendable.kind === 'ready'
                    ? visibleSpendable.amount
                    : t(
                        visibleSpendable.kind === 'loading'
                          ? 'swap.form.loadingSpendable'
                          : 'swap.form.spendableUnavailable',
                      )}
                </Text>
                <NativeButton
                  label={t('swap.form.max')}
                  disabled={
                    preparing ||
                    maxLoading ||
                    busy ||
                    visibleSpendable.kind !== 'ready' ||
                    !isQuotableSwapAmount(visibleSpendable.amount)
                  }
                  onPress={() => void applyMax()}
                  size="sm"
                  variant="quiet"
                />
              </View>
              {visibleSpendable.kind === 'unavailable' ? (
                <NativeButton
                  label={t('swap.form.retrySpendable')}
                  disabled={maxLoading || preparing}
                  onPress={() => setSpendableRevision(current => current + 1)}
                  size="sm"
                  variant="quiet"
                />
              ) : null}
            </View>
            <NativeButton
              label={t('swap.form.exchangeAssets')}
              disabled={preparing}
              size="sm"
              variant="quiet"
              onPress={() => {
                if (preparing) return;
                setSourceIndex(destinationIndex);
                setDestinationIndex(sourceIndex);
                setMode('strict_send');
                setSettingsVisible(false);
                setAmount('');
                resetQuotes();
              }}
            />
            <View style={styles.section}>
              <Text style={styles.label}>{t('swap.preview.destination')}</Text>
              <View style={styles.choices}>
                {assets.map((asset, index) => (
                  <AssetChoice
                    key={'destination-' + assetLabel(asset)}
                    asset={asset}
                    selected={destinationIndex === index}
                    disabled={preparing}
                    onPress={() => {
                      if (preparing) return;
                      setDestinationIndex(index);
                      if (index === sourceIndex) setSourceIndex((index + 1) % assets.length);
                      resetQuotes();
                    }}
                  />
                ))}
              </View>
              <SwapAmountInput
                accessibilityLabel={t('swap.form.receiveAmount')}
                disabled={preparing}
                onChangeAmount={value => editAmount('strict_receive', value)}
                style={styles.input}
                value={destinationAmount}
              />
            </View>
            <Text style={styles.secondary}>{t('swap.preview.' + mode)}</Text>
            <Text style={styles.secondary}>{t('swap.quote.automatic')}</Text>
            {busy && view.kind === 'form' ? <ActivityIndicator accessibilityLabel={t('swap.preview.loading')} /> : null}
            {amount && !isQuotableSwapAmount(amount) ? (
              <Text style={styles.error}>{t('swap.amount.invalid')}</Text>
            ) : null}
          </>
        ) : null}
        {view.kind === 'quotes' ? (
          <>
            <View style={styles.row}>
              <Text style={styles.label}>{t('swap.preview.routes')}</Text>
              <NativeButton
                label={t('swap.settings.open')}
                disabled={busy}
                onPress={() => setSettingsVisible(value => !value)}
                size="sm"
                variant="quiet"
              />
            </View>
            <View style={[styles.route, styles.routeSelected]}>
              <Text style={styles.choiceText}>
                {view.selected.sourceAmount} → {view.selected.destinationAmount}
              </Text>
              <Text style={styles.secondary}>
                {t('swap.preview.path')}: {fullPath(view.selected.path)}
              </Text>
            </View>
            <Text style={styles.secondary}>
              {t('swap.preview.quotedUntil')}: {new Date(view.selected.expiresAtUnixMs).toLocaleTimeString()}
            </Text>
            {settingsVisible ? (
              <View style={styles.section}>
                <View style={styles.row}>
                  <Text style={styles.heading}>{t('swap.settings.title')}</Text>
                  <NativeButton
                    label={t('swap.settings.done')}
                    disabled={busy}
                    onPress={() => setSettingsVisible(false)}
                    size="sm"
                    variant="quiet"
                  />
                </View>
                <Text style={styles.label}>{t('swap.preview.slippage')}</Text>
                <View style={styles.choices}>
                  {[10, 50, 100].map(bps => (
                    <Pressable
                      key={bps}
                      accessibilityRole="button"
                      accessibilityState={{ selected: slippageInput === String(bps) }}
                      disabled={busy}
                      onPress={() => setSlippageInput(String(bps))}
                      style={[styles.choice, slippageInput === String(bps) ? styles.choiceSelected : undefined]}
                    >
                      <Text style={styles.choiceText}>{(bps / 100).toString()}%</Text>
                    </Pressable>
                  ))}
                </View>
                <TextInput
                  accessibilityLabel={t('swap.settings.customSlippage')}
                  editable={!busy}
                  keyboardType="number-pad"
                  value={slippageInput}
                  onChangeText={setSlippageInput}
                  style={styles.input}
                />
                <Text style={styles.secondary}>{t('swap.settings.slippageBpsHint')}</Text>
                <Text style={styles.label}>{t('swap.preview.routes')}</Text>
                {view.quotes.map((quote, index) => (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ selected: view.selected === quote }}
                    disabled={busy || maxLoading}
                    key={String(index)}
                    onPress={() => {
                      if (locked.current) return;
                      attempt.current += 1;
                      setError(undefined);
                      setView({ ...view, selected: quote });
                    }}
                    style={[styles.route, view.selected === quote ? styles.routeSelected : undefined]}
                  >
                    <Text style={styles.choiceText}>
                      {quote.sourceAmount} → {quote.destinationAmount}
                    </Text>
                    <Text style={styles.secondary}>
                      {t('swap.preview.path')}: {fullPath(quote.path)}
                    </Text>
                  </Pressable>
                ))}
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
            <ReviewLine label={t('swap.preview.from')} value={view.review.source} />
            <ReviewLine label={t('swap.preview.to')} value={view.review.destination} />
            <ReviewLine label={t('swap.preview.sourceAmount')} value={view.review.quotedSourceAmount} />
            <ReviewLine label={t('swap.preview.destinationAmount')} value={view.review.quotedDestinationAmount} />
            <ReviewLine label={t('swap.preview.path')} value={fullPath(view.review.path)} />
            <ReviewLine
              label={t(view.review.mode === 'strict_send' ? 'swap.preview.minReceive' : 'swap.preview.maxSend')}
              value={view.review.mode === 'strict_send' ? view.review.destinationMinimum : view.review.sourceMaximum}
            />
            <ReviewLine label={t('swap.preview.slippage')} value={String(view.review.slippageBps)} />
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
        {historyPanel}
        {error ? (
          <Text accessibilityLiveRegion="assertive" style={styles.error}>
            {error}
          </Text>
        ) : null}
      </ScrollView>

      <View style={styles.footer}>
        {view.kind === 'form' ? (
          <NativeButton
            label={busy ? t('swap.preview.loading') : t('swap.preview.getQuotes')}
            disabled={busy || maxLoading || loading || assets.length < 2 || !isQuotableSwapAmount(amount)}
            onPress={() => startQuote()}
            size="lg"
            variant="primary"
          />
        ) : view.kind === 'quotes' ? (
          <>
            <NativeButton
              label={busy ? t('swap.preview.loading') : t('swap.preview.review')}
              disabled={busy || maxLoading}
              onPress={() => startReview()}
              size="lg"
              variant="primary"
            />
            <NativeButton
              label={t('swap.preview.requote')}
              disabled={busy}
              onPress={() => {
                resetQuotes();
                startQuote();
              }}
              size="md"
              variant="quiet"
            />
            <NativeButton label={t('common.back')} disabled={busy} onPress={resetQuotes} size="sm" variant="quiet" />
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
        ) : null}
      </View>
    </Screen>
  );
}

function AssetChoice({
  asset,
  selected,
  disabled,
  onPress,
}: Readonly<{
  asset: StellarPaymentAsset;
  selected: boolean;
  disabled: boolean;
  onPress: () => void;
}>) {
  const styles = useThemedStyles(createSwapPreviewStyles);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[styles.choice, selected ? styles.choiceSelected : undefined]}
    >
      <Text style={styles.choiceText}>{asset.kind === 'native' ? 'XLM' : asset.code}</Text>
      {asset.kind === 'credit' ? (
        <Text numberOfLines={2} style={styles.mono}>
          {asset.issuer}
        </Text>
      ) : null}
    </Pressable>
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
      quote_unavailable: t('swap.error.routes'),
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
