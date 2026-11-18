import { AssetPicker } from '@features/assets/AssetPicker';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Modal, Pressable, ScrollView, Switch, Text, TextInput, View } from 'react-native';
import { useFocusEffect, useIsFocused } from '@react-navigation/native';
import type { AccountRecord } from '@capabilities/account/types';
import type { Markets } from '@capabilities/markets/createMarkets';
import type { Asset, MarketRequest, MarketReview, Offer } from '@capabilities/markets/types';
import { assetKey } from '@capabilities/stellar/classicAmounts';
import { Screen } from '@ui/components';
import { CenteredPageHeader } from '@ui/components/CenteredPageHeader/CenteredPageHeader';
import { NativeButton } from '@ui/components/NativeButton';
import { PassphraseInput, type PassphraseInputHandle } from '@ui/components/PassphraseInput';
import { SlideToConfirm } from '@ui/SlideToConfirm';
import { useAppTheme, useThemedStyles } from '@ui/theme';
import { useLocalization } from '../../locale';
import { createStyles } from './styles';

type Data = Awaited<ReturnType<Markets['list']>>;
type Position = Data['positions'][number];
type Result = Readonly<{ status: string; hash?: string; code?: string }>;
type Flow =
  | { kind: 'list' }
  | { kind: 'pool'; position: Position }
  | { kind: 'offer'; offer?: Offer }
  | { kind: 'review'; review: MarketReview }
  | { kind: 'result'; result: Result };
type Props = Readonly<{
  account: AccountRecord;
  product: Markets;
  selectionRevision: number;
  captureSession: (isCurrentFocusEpoch: () => boolean) => () => boolean;
  kind: 'orders' | 'pools';
  active: boolean;
  canSign: boolean;
  invalidationRevision: number;
  refreshSignal?: number;
  isCurrentAccount: () => boolean;
  onRecover: () => Promise<unknown>;
  onBack?: () => void;
}>;
const knownErrors = new Set([
  'invalid_request',
  'slippage_out_of_range',
  'pool_not_found',
  'pool_state_unavailable',
  'pool_state_stale',
  'pool_share_trustline_missing',
  'insufficient_pool_shares',
  'receiving_trustline_missing',
  'receiving_capacity_insufficient',
  'withdrawal_too_small',
  'under_minimum',
  'close_requires_full_exit',
  'pool_identity_mismatch',
  'insufficient_fee',
  'insufficient_source',
  'not_authorized',
  'offer_not_found',
  'offer_state_changed',
  'watch_only',
  'unsupported_signer',
]);
export function MarketsScreen({
  account,
  product,
  selectionRevision,
  captureSession,
  kind,
  active: foreground,
  canSign,
  invalidationRevision,
  refreshSignal = 0,
  isCurrentAccount,
  onRecover,
  onBack,
}: Props) {
  const { t, formatNumber } = useLocalization();
  const styles = useThemedStyles(createStyles),
    theme = useAppTheme();
  const focused = useIsFocused();
  const [appActive, setAppActive] = useState(
    AppState.currentState !== 'background' && AppState.currentState !== 'inactive',
  );
  const active = foreground && focused && appActive && isCurrentAccount();
  const activeRef = useRef(active);
  activeRef.current = active;
  const epoch = useRef(0),
    readEpoch = useRef(0),
    running = useRef(false);
  const reviewSession = useRef<(() => boolean) | undefined>(undefined);
  const password = useRef<PassphraseInputHandle>(null);
  const [present, setPresent] = useState(false);
  const [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(false);
  const [data, setData] = useState<Data>();
  const [flow, setFlow] = useState<Flow>({ kind: 'list' });
  const [error, setError] = useState('');
  const [quantity, setQuantity] = useState(''),
    [price, setPrice] = useState('');
  const [side, setSide] = useState<'buy' | 'sell'>('sell');
  const [base, setBase] = useState<Asset>({ kind: 'native' }),
    [counter, setCounter] = useState<Asset>();
  const [all, setAll] = useState(true),
    [close, setClose] = useState(false),
    [slippage, setSlippage] = useState('50');
  const retire = useCallback(() => {
    activeRef.current = false;
    epoch.current += 1;
    readEpoch.current += 1;
    running.current = false;
    reviewSession.current = undefined;
    password.current?.clear();
  }, []);
  useFocusEffect(useCallback(() => () => retire(), [retire]));
  useEffect(() => {
    epoch.current += 1;
    reviewSession.current = undefined;
    running.current = false;
    password.current?.clear();
    setBusy(false);
    setPresent(false);
    setError('');
    setFlow(current => (current.kind === 'result' ? current : { kind: 'list' }));
  }, [selectionRevision]);
  useEffect(() => () => retire(), [retire]);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', next => {
      if (next !== 'active') retire();
      setAppActive(next === 'active');
    });
    return () => subscription.remove();
  }, [retire]);
  const reset = () => {
    epoch.current += 1;
    running.current = false;
    reviewSession.current = undefined;
    password.current?.clear();
    setPresent(false);
    setBusy(false);
    setError('');
    setFlow({ kind: 'list' });
  };
  const refresh = useCallback(() => {
    if (!activeRef.current || !isCurrentAccount()) return;
    const lease = ++readEpoch.current;
    setLoading(true);
    setError('');
    product
      .list(account.id, kind)
      .then(value => {
        if (activeRef.current && lease === readEpoch.current && isCurrentAccount()) setData(value);
      })
      .catch(() => {
        if (activeRef.current && lease === readEpoch.current) setError('market.loadError');
      })
      .finally(() => {
        if (activeRef.current && lease === readEpoch.current) setLoading(false);
      });
  }, [account.id, isCurrentAccount, kind, product]);
  useEffect(() => {
    if (!active) {
      retire();
      setBusy(false);
      setPresent(false);
      setFlow(current => (current.kind === 'result' ? current : { kind: 'list' }));
      return;
    }
    activeRef.current = true;
    refresh();
    return () => {
      readEpoch.current += 1;
    };
  }, [active, invalidationRevision, refresh, refreshSignal, retire]);
  const onError = (failure: unknown) => {
    const code = failure instanceof Error ? failure.message : '';
    setError(knownErrors.has(code) ? 'market.error.' + code : 'market.error.general');
  };
  async function prepare(request: MarketRequest) {
    if (!activeRef.current || !isCurrentAccount() || !canSign || running.current) return;
    running.current = true;
    setBusy(true);
    setError('');
    const lease = ++epoch.current;
    const current = captureSession(() => activeRef.current && isCurrentAccount() && lease === epoch.current);
    try {
      const review = await product.prepare(account.id, request, current);
      if (current()) {
        reviewSession.current = undefined;
        password.current?.clear();
        setPresent(false);
        reviewSession.current = current;
        setFlow({ kind: 'review', review });
      }
    } catch (failure) {
      if (current()) onError(failure);
    } finally {
      if (lease === epoch.current && activeRef.current) {
        running.current = false;
        setBusy(false);
        if (!current()) {
          setFlow({ kind: 'list' });
          setError('market.selectionChanged');
        }
      }
    }
  }
  async function submit(review: MarketReview, presentedEpoch: number) {
    if (!activeRef.current || !isCurrentAccount() || !canSign || running.current || presentedEpoch !== epoch.current)
      return;
    const current = reviewSession.current;
    if (!current || !current()) {
      reset();
      setError('market.selectionChanged');
      return;
    }
    const passphrase = password.current?.consume();
    if (!passphrase) return;
    running.current = true;
    setBusy(true);
    setError('');

    try {
      const result = await product.submit(review, passphrase, current);
      if (current()) {
        if (result.status === 'passphrase-required') setError('market.error.general');
        else
          setFlow({
            kind: 'result',
            result: {
              status: result.status,
              ...('hash' in result
                ? { hash: result.hash }
                : 'transactionHash' in result
                  ? { hash: result.transactionHash }
                  : {}),
              ...('resultCode' in result ? { code: result.resultCode } : {}),
            },
          });
      }
    } catch (failure) {
      if (current()) onError(failure);
    } finally {
      if (presentedEpoch === epoch.current && activeRef.current) {
        running.current = false;
        setBusy(false);
        if (!current()) {
          setFlow({ kind: 'list' });
          setError('market.selectionChanged');
        }
      }
    }
  }
  const value = (label: string, text: string) => (
    <View key={label} style={styles.field}>
      <Text style={styles.label}>{t('market.' + label)}</Text>
      <Text selectable style={styles.text}>
        {text}
      </Text>
    </View>
  );
  const decimal = (label: string, text: string, change: (value: string) => void) => (
    <View style={styles.field}>
      <Text style={styles.label}>{t('market.' + label)}</Text>
      <TextInput
        accessibilityLabel={t('market.' + label)}
        editable={!busy}
        keyboardType="decimal-pad"
        autoCorrect={false}
        value={text}
        onChangeText={change}
        style={styles.input}
      />
    </View>
  );
  const choose = (label: string, selected: boolean, action: () => void) => (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected, disabled: busy }}
      disabled={busy}
      onPress={action}
      style={[styles.card, selected ? styles.selected : undefined]}
    >
      <Text style={styles.text}>{t('market.' + label)}</Text>
    </Pressable>
  );
  const openOffer = (offer?: Offer) => {
    reset();
    setQuantity('');
    setPrice('');
    setSide('sell');
    setBase(offer?.selling ?? data?.balances[0]?.asset ?? { kind: 'native' });
    setCounter(offer?.buying ?? data?.balances[1]?.asset);
    setFlow({ kind: 'offer', ...(offer ? { offer } : {}) });
  };
  const shownAmount = (text: string) => (formatNumber ? formatNumber(text, 7) : text);
  const poolDetails = flow.kind === 'pool' ? flow.position : undefined;
  const offerDetails = flow.kind === 'offer' ? flow.offer : undefined;
  const presentedEpoch = epoch.current;
  const content = (
    <>
      {onBack ? null : <Text style={styles.heading}>{t('market.' + kind)}</Text>}
      {!canSign ? <Text style={styles.label}>{t('market.readOnly')}</Text> : null}
      {loading ? <ActivityIndicator color={theme.colors.actionPrimary} /> : null}
      {flow.kind === 'list' && error ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {t(error)}
        </Text>
      ) : null}
      <NativeButton label={t('market.refresh')} onPress={refresh} variant="secondary" disabled={!active || loading} />
      {kind === 'orders' ? (
        <NativeButton label={t('market.create')} disabled={!active || !canSign || !data} onPress={() => openOffer()} />
      ) : null}
      {data && (kind === 'orders' ? data.offers.length === 0 : data.positions.length === 0) ? (
        <Text style={styles.label}>{t('market.empty')}</Text>
      ) : null}
      {kind === 'orders'
        ? data?.offers.map(offer => (
            <Pressable
              key={offer.id}
              accessibilityRole="button"
              disabled={!active}
              onPress={() => openOffer(offer)}
              style={styles.card}
            >
              <Text style={styles.text}>{assetKey(offer.selling) + ' → ' + assetKey(offer.buying)}</Text>
              <Text style={styles.text}>{shownAmount(offer.amount) + ' · ' + offer.price.n + '/' + offer.price.d}</Text>
              <Text style={styles.label}>{t('market.offerId') + ': ' + offer.id}</Text>
            </Pressable>
          ))
        : data?.positions.map(position => (
            <Pressable
              key={position.id}
              accessibilityRole="button"
              disabled={!active}
              onPress={() => {
                reset();
                setAll(true);
                setClose(false);
                setQuantity('');
                setSlippage('50');
                setFlow({ kind: 'pool', position });
              }}
              style={styles.card}
            >
              <Text style={styles.text}>
                {position.pool ? assetKey(position.pool.assetA) + ' / ' + assetKey(position.pool.assetB) : position.id}
              </Text>
              <Text style={styles.text}>{t('market.shares') + ': ' + shownAmount(position.shares)}</Text>
              {position.underlyingA !== undefined && position.underlyingB !== undefined ? (
                <Text style={styles.label}>
                  {shownAmount(position.underlyingA) + ' / ' + shownAmount(position.underlyingB)}
                </Text>
              ) : (
                <Text style={styles.error}>{t('market.poolUnavailable')}</Text>
              )}
            </Pressable>
          ))}
    </>
  );
  return (
    <>
      {onBack ? (
        <Screen scrollable={false} contentInset="none">
          <CenteredPageHeader backLabel={t('common.back')} title={t('market.' + kind)} onBack={onBack} />
          <ScrollView contentContainerStyle={styles.pageContent}>
            <View style={styles.content}>{content}</View>
          </ScrollView>
        </Screen>
      ) : (
        <View style={styles.content}>{content}</View>
      )}
      {active && flow.kind !== 'list' ? (
        <Modal visible animationType="slide" onRequestClose={reset}>
          <Screen
            scrollable={false}
            title={t(
              'market.' +
                (flow.kind === 'review'
                  ? 'review'
                  : flow.kind === 'result'
                    ? 'result'
                    : flow.kind === 'pool'
                      ? 'poolDetails'
                      : 'orderDetails'),
            )}
          >
            <ScrollView
              style={styles.scroll}
              contentContainerStyle={styles.content}
              keyboardShouldPersistTaps="handled"
            >
              {busy ? <ActivityIndicator color={theme.colors.actionPrimary} /> : null}
              {poolDetails ? (
                <>
                  {value('poolId', poolDetails.id)}
                  {value('shares', shownAmount(poolDetails.shares))}
                  {poolDetails.pool ? (
                    <>
                      {value('assetA', assetKey(poolDetails.pool.assetA))}
                      {value('assetB', assetKey(poolDetails.pool.assetB))}
                      {value('expectedA', poolDetails.underlyingA ?? '—')}
                      {value('expectedB', poolDetails.underlyingB ?? '—')}
                    </>
                  ) : (
                    <Text style={styles.error}>{t('market.poolUnavailable')}</Text>
                  )}
                  <Text style={styles.label}>{t('market.liveWarning')}</Text>
                  <View style={styles.row}>
                    {choose('all', all, () => setAll(true))}
                    {choose('partial', !all, () => {
                      setAll(false);
                      setClose(false);
                    })}
                  </View>
                  {!all ? decimal('shares', quantity, setQuantity) : null}
                  {decimal('slippage', slippage, setSlippage)}
                  <Text style={styles.label}>{t('market.slippageHint')}</Text>
                  <View style={styles.row}>
                    <Text style={styles.text}>{t('market.closeLine')}</Text>
                    <Switch
                      accessibilityLabel={t('market.closeLine')}
                      disabled={!all || busy}
                      value={close}
                      onValueChange={setClose}
                    />
                  </View>
                  <Text style={styles.label}>{t('market.closeWarning')}</Text>
                  <NativeButton
                    label={t('market.exit')}
                    disabled={!canSign || busy}
                    onPress={() =>
                      prepare({
                        kind: 'exit',
                        poolId: poolDetails.id,
                        mode: all ? 'all' : 'exact_shares',
                        shares: quantity.trim(),
                        slippageBps: /^\d{1,4}$/.test(slippage.trim()) ? Number(slippage) : -1,
                        close,
                      })
                    }
                  />
                </>
              ) : null}
              {flow.kind === 'offer' ? (
                <>
                  {offerDetails ? (
                    <>
                      {value('offerId', offerDetails.id)}
                      {value('selling', assetKey(offerDetails.selling))}
                      {value('buying', assetKey(offerDetails.buying))}
                      {value('effectivePrice', `${offerDetails.price.n}/${offerDetails.price.d}`)}
                    </>
                  ) : (
                    <>
                      <Text style={styles.label}>{t('market.pairHint')}</Text>
                      <AssetPicker
                        label={t('market.base')}
                        balances={data?.balances ?? []}
                        selectedAsset={base.kind === 'native' ? { kind: 'native', code: 'XLM' } : base}
                        disabled={busy || !active}
                        onSelect={setBase}
                      />
                      <AssetPicker
                        label={t('market.counter')}
                        balances={data?.balances ?? []}
                        selectedAsset={counter?.kind === 'credit' ? counter : { kind: 'native', code: 'XLM' }}
                        disabled={busy || !active}
                        onSelect={setCounter}
                      />
                      <View style={styles.row}>
                        {choose('sell', side === 'sell', () => setSide('sell'))}
                        {choose('buy', side === 'buy', () => setSide('buy'))}
                      </View>
                    </>
                  )}
                  {decimal('amount', quantity, setQuantity)}
                  {decimal('price', price, setPrice)}
                  <Text style={styles.label}>{t('market.offerWarning')}</Text>
                  <NativeButton
                    label={t('market.' + (offerDetails ? 'update' : 'create'))}
                    disabled={!canSign || busy || !counter}
                    onPress={() => {
                      if (counter)
                        prepare({
                          kind: 'offer',
                          action: offerDetails ? 'update' : 'create',
                          base,
                          counter,
                          side,
                          amount: quantity.trim(),
                          price: price.trim(),
                          ...(offerDetails ? { offerId: offerDetails.id } : {}),
                        });
                    }}
                  />
                  {offerDetails ? (
                    <NativeButton
                      label={t('market.cancelOffer')}
                      variant="secondary"
                      disabled={!canSign || busy}
                      onPress={() =>
                        prepare({
                          kind: 'offer',
                          action: 'cancel',
                          base: offerDetails.selling,
                          counter: offerDetails.buying,
                          side: 'sell',
                          amount: '0',
                          price: '1',
                          offerId: offerDetails.id,
                        })
                      }
                    />
                  ) : null}
                </>
              ) : null}
              {flow.kind === 'review' ? (
                <>
                  <Text style={styles.label}>{t('market.reviewWarning')}</Text>
                  {value('network', account.networkId)}
                  {value('source', account.address)}
                  {flow.review.facts.map(fact =>
                    value(
                      fact.key,
                      fact.key === 'operations'
                        ? t('market.op.' + fact.value)
                        : fact.value === 'keep' ||
                            fact.value === 'close' ||
                            fact.value === 'all' ||
                            fact.value === 'exact_shares' ||
                            fact.key === 'action' ||
                            fact.key === 'side'
                          ? t('market.' + fact.value)
                          : fact.value,
                    ),
                  )}
                  <PassphraseInput
                    ref={password}
                    label={t('market.passphrase')}
                    hint={t('market.passphraseHint')}
                    disabled={busy}
                    style={styles.input}
                    onPresenceChange={setPresent}
                  />
                </>
              ) : null}
              {flow.kind === 'result' ? (
                <>
                  <Text style={styles.heading}>{t('market.status.' + flow.result.status)}</Text>
                  {flow.result.hash ? value('hash', flow.result.hash) : null}
                  {flow.result.status === 'rejected' ? (
                    <Text style={styles.error}>
                      {flow.result.code && knownErrors.has(flow.result.code)
                        ? t('market.error.' + flow.result.code)
                        : t('market.rejectedAdvice')}
                    </Text>
                  ) : null}
                  {flow.result.status === 'uncertain' ? (
                    <>
                      <Text style={styles.label}>{t('market.uncertainAdvice')}</Text>
                      <NativeButton
                        label={t('market.check')}
                        disabled={busy}
                        onPress={() => {
                          const lease = epoch.current;
                          setBusy(true);
                          onRecover()
                            .then(() => {
                              if (activeRef.current && lease === epoch.current && flow.result.hash) {
                                const outcome = product.outcome(flow.result.hash);
                                if (outcome === 'confirmed' || outcome === 'rejected')
                                  setFlow({
                                    kind: 'result',
                                    result: {
                                      status: outcome === 'confirmed' ? 'submitted' : 'rejected',
                                      hash: flow.result.hash,
                                    },
                                  });
                              }
                            })
                            .catch(failure => {
                              if (activeRef.current && lease === epoch.current) onError(failure);
                            })
                            .finally(() => {
                              if (activeRef.current && lease === epoch.current) setBusy(false);
                            });
                        }}
                      />
                    </>
                  ) : null}
                </>
              ) : null}
              {error ? (
                <Text accessibilityRole="alert" style={styles.error}>
                  {t(error)}
                </Text>
              ) : null}
            </ScrollView>
            <View style={styles.footer}>
              {flow.kind === 'review' ? (
                <SlideToConfirm
                  label={t('market.confirm')}
                  disabled={busy || !present || !canSign}
                  loading={busy}
                  onComplete={() => submit(flow.review, presentedEpoch)}
                />
              ) : null}
              <NativeButton
                label={t('common.close')}
                onPress={() => {
                  reset();
                  refresh();
                }}
                variant="secondary"
              />
            </View>
          </Screen>
        </Modal>
      ) : null}
    </>
  );
}
