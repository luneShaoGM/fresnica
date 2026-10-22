import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import { Screen } from '@ui/components';
import { NativeButton } from '@ui/components/NativeButton';
import { SlideToConfirm } from '../../ui/SlideToConfirm';
import { useThemedStyles } from '../../ui/theme';
import { useLocalization } from '../../locale';
import type { AccountRecord } from '../../capabilities/account/types';
import type { PendingSubmissionRecord } from '../../capabilities/transaction/pendingSubmission';
import type { SubmitReviewedTransactionResult } from '../../capabilities/transaction/submitReviewedTransaction';
import type { StellarPaymentAsset } from '../../capabilities/stellar/types';
import type {
  PathPaymentMode,
  PathPaymentQuote,
  PreparedPathPaymentReview,
} from '../../capabilities/path-payment/types';
import { projectFeatureError } from '../featureError';
import {
  loadSwapPreviewAssets,
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
  onDone: () => void;
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
  selectedAccountId,
  dependencies,
  execution,
  captureSession,
  onDone,
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
  const attempt = useRef(0);
  const locked = useRef(false);
  const submitLocked = useRef(false);
  const reconcileLocked = useRef(false);
  const securePassphraseInput = useRef<SwapPassphraseInputHandle>(null);

  const clearPassphrase = useCallback(() => {
    securePassphraseInput.current?.clear();
    setHasPassphrase(false);
  }, []);

  const resetQuotes = useCallback(() => {
    attempt.current += 1;
    setError(undefined);
    setPassphraseRequired(false);
    clearPassphrase();
    setView({ kind: 'form' });
  }, [clearPassphrase]);

  useEffect(() => {
    const generation = ++attempt.current;
    locked.current = false;
    setAssets([]);
    setSourceIndex(0);
    setDestinationIndex(1);
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
    if (busy || locked.current || assets.length < 2) return;
    const sourceAsset = assets[sourceIndex];
    const destinationAsset = assets[destinationIndex];
    if (!sourceAsset || !destinationAsset) return;
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
  }, [account, amount, assets, busy, captureSession, dependencies, destinationIndex, mode, sourceIndex, t]);

  const startReview = useCallback(async () => {
    if (view.kind !== 'quotes' || busy || locked.current) return;
    const slippageText = slippageInput.trim();
    if (!/^(0|[1-9]\d{0,3})$/.test(slippageText) || Number(slippageText) > 1000) {
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
        <Text style={styles.secondary}>
          {t('swap.preview.account')}: {account.label || account.address}
        </Text>

        {loading ? <ActivityIndicator accessibilityLabel={t('swap.preview.loading')} /> : null}
        {!loading && assets.length < 2 ? (
          <NativeButton
            label={t('swap.preview.retryAssets')}
            size="md"
            variant="quiet"
            onPress={() => setAssetLoadRevision(current => current + 1)}
          />
        ) : null}
        {view.kind === 'form' && !loading && assets.length >= 2 ? (
          <>
            <View style={styles.section}>
              <Text style={styles.label}>{t('swap.preview.source')}</Text>
              <View style={styles.choices}>
                {assets.map((asset, index) => (
                  <AssetChoice
                    key={'source-' + assetLabel(asset)}
                    asset={asset}
                    selected={sourceIndex === index}
                    disabled={busy}
                    onPress={() => {
                      setSourceIndex(index);
                      if (index === destinationIndex) setDestinationIndex((index + 1) % assets.length);
                      resetQuotes();
                    }}
                  />
                ))}
              </View>
            </View>
            <View style={styles.section}>
              <Text style={styles.label}>{t('swap.preview.destination')}</Text>
              <View style={styles.choices}>
                {assets.map((asset, index) => (
                  <AssetChoice
                    key={'destination-' + assetLabel(asset)}
                    asset={asset}
                    selected={destinationIndex === index}
                    disabled={busy}
                    onPress={() => {
                      setDestinationIndex(index);
                      if (index === sourceIndex) setSourceIndex((index + 1) % assets.length);
                      resetQuotes();
                    }}
                  />
                ))}
              </View>
            </View>
            <View style={styles.section}>
              <Text style={styles.label}>{t('swap.preview.mode')}</Text>
              <View style={styles.choices}>
                {(['strict_send', 'strict_receive'] as const).map(value => (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ selected: mode === value }}
                    disabled={busy}
                    key={value}
                    onPress={() => {
                      setMode(value);
                      resetQuotes();
                    }}
                    style={[styles.choice, mode === value ? styles.choiceSelected : undefined]}
                  >
                    <Text style={styles.choiceText}>{t('swap.preview.' + value)}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
            <View style={styles.section}>
              <Text style={styles.label}>{t('swap.preview.fixedAmount')}</Text>
              <TextInput
                accessibilityLabel={t('swap.preview.fixedAmount')}
                autoCorrect={false}
                editable={!busy}
                keyboardType="decimal-pad"
                onChangeText={value => {
                  setAmount(value);
                  resetQuotes();
                }}
                placeholder="0.0000000"
                style={styles.input}
                value={amount}
              />
              <Text style={styles.secondary}>{t('swap.preview.fixedHint')}</Text>
            </View>
          </>
        ) : null}
        {view.kind === 'quotes' ? (
          <>
            <Text style={styles.label}>{t('swap.preview.routes')}</Text>
            {view.quotes.map((quote, index) => (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected: view.selected === quote }}
                disabled={busy}
                key={String(index)}
                onPress={() => {
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
            <Text style={styles.secondary}>
              {t('swap.preview.quotedUntil')}: {new Date(view.selected.expiresAtUnixMs).toLocaleTimeString()}
            </Text>
            <View style={styles.section}>
              <Text style={styles.label}>{t('swap.preview.slippage')}</Text>
              <TextInput
                accessibilityLabel={t('swap.preview.slippage')}
                editable={!busy}
                keyboardType="number-pad"
                value={slippageInput}
                onChangeText={setSlippageInput}
                style={styles.input}
              />
            </View>
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
        {view.kind === 'result' ? (
          <View style={styles.section}>
            <Text accessibilityLiveRegion="polite" style={styles.heading}>
              {t('swap.result.' + view.result.status)}
            </Text>
            <Text style={styles.secondary}>{t('swap.result.description.' + view.result.status)}</Text>
            {'hash' in view.result ? <ReviewLine label={t('swap.history.hash')} value={view.result.hash} /> : null}
            {'transactionHash' in view.result ? (
              <ReviewLine label={t('swap.history.hash')} value={view.result.transactionHash} />
            ) : null}
            {view.result.status === 'submitted' && view.result.ledger !== undefined ? (
              <ReviewLine label={t('swap.history.ledger')} value={String(view.result.ledger)} />
            ) : null}
            {view.result.status === 'submitted' ? (
              <ReviewLine label={t('swap.execution.authorization')} value={view.result.authorization} />
            ) : null}
            {view.result.status === 'rejected' && view.result.resultCode ? (
              <ReviewLine label={t('swap.result.code')} value={view.result.resultCode} />
            ) : null}
            {view.result.status === 'authorization-blocked' ? (
              <ReviewLine label={t('swap.result.reason')} value={view.result.reason} />
            ) : null}
          </View>
        ) : null}
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
            disabled={busy || loading || assets.length < 2 || !amount.trim()}
            onPress={() => startQuote()}
            size="lg"
            variant="primary"
          />
        ) : view.kind === 'quotes' ? (
          <>
            <NativeButton
              label={busy ? t('swap.preview.loading') : t('swap.preview.review')}
              disabled={busy}
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
        ) : (
          <NativeButton label={t('swap.preview.done')} onPress={close} size="lg" variant="primary" />
        )}
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
