import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import { Screen } from '@ui/components';
import { NativeButton } from '@ui/components/NativeButton';
import { useThemedStyles } from '../../ui/theme';
import { useLocalization } from '../../locale';
import type { AccountRecord } from '../../capabilities/account/types';
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

type ViewState =
  | Readonly<{ kind: 'form' }>
  | Readonly<{ kind: 'quotes'; quotes: readonly PathPaymentQuote[]; selected: PathPaymentQuote }>
  | Readonly<{ kind: 'review'; review: PreparedPathPaymentReview }>;

type Props = Readonly<{
  account: AccountRecord;
  active: boolean;
  selectedAccountId: string;
  dependencies: SwapPreviewProductDependencies;
  captureSession: () => () => boolean;
  onDone: () => void;
}>;

function assetLabel(asset: StellarPaymentAsset): string {
  return asset.kind === 'native' ? 'XLM' : asset.code + ' · ' + asset.issuer;
}

function fullPath(assets: readonly StellarPaymentAsset[]): string {
  return assets.length === 0 ? '—' : assets.map(assetLabel).join(' → ');
}

export function SwapPreviewScreen({ account, active, selectedAccountId, dependencies, captureSession, onDone }: Props) {
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
  const attempt = useRef(0);
  const locked = useRef(false);

  const resetQuotes = useCallback(() => {
    attempt.current += 1;
    setError(undefined);
    setView({ kind: 'form' });
  }, []);

  useEffect(() => {
    const generation = ++attempt.current;
    locked.current = false;
    setAssets([]);
    setSourceIndex(0);
    setDestinationIndex(1);
    setView({ kind: 'form' });
    setError(undefined);
    setBusy(false);
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
  }, [account, active, assetLoadRevision, captureSession, dependencies, t]);

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
    onDone();
  };

  return (
    <Screen scrollable={false} contentInset="none">
      <View style={styles.header}>
        <NativeButton label={t('common.back')} onPress={close} size="sm" variant="quiet" />
        <Text style={styles.heading}>{t('swap.preview.title')}</Text>
        <View />
      </View>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
        <View style={styles.notice}>
          <Text style={styles.text}>{t('swap.preview.notice')}</Text>
          <Text style={styles.secondary}>{t('swap.preview.unsignable')}</Text>
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
              <Text style={styles.text}>{t('swap.preview.reviewOnly')}</Text>
            </View>
          </>
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
