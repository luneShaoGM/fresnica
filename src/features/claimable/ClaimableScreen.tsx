import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, TextInput, View } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { BottomSheet, Screen } from '@ui/components';
import { NativeButton } from '@ui/components/NativeButton';
import { useAppTheme, useThemedStyles } from '@ui/theme';
import { SlideToConfirm } from '../../ui/SlideToConfirm';
import { TokenAssetIcon } from '../assets/TokenAssetIcon';
import type { AccountRecord } from '../../capabilities/account/types';
import { CLAIMABLE_TTL_MS, displayedClaimable } from '../../capabilities/claimable/records';
import type { ClaimableProduct, ClaimableState } from '../../capabilities/claimable/createClaimableProduct';
import {
  prepareClaimableReview,
  submitClaimableReview,
  type ClaimableReview,
  type ClaimableTransactionDependencies,
} from '../../capabilities/claimable/claimableTransaction';
import type { SubmitReviewedTransactionResult } from '../../capabilities/transaction/submitReviewedTransaction';
import { useLocalization } from '../../locale';
import { createClaimableStyles } from './styles';

type Display = ReturnType<typeof displayedClaimable>;
type Result = SubmitReviewedTransactionResult | { status: 'watch-only' | 'unsupported-account-signers' };
type Flow =
  | { kind: 'list' }
  | { kind: 'preparing' }
  | { kind: 'review'; review: ClaimableReview }
  | { kind: 'result'; result: Result };

type Props = Readonly<{
  account: AccountRecord;
  product: ClaimableProduct;
  transaction: ClaimableTransactionDependencies;
  active: boolean;
  canSign: boolean;
  invalidationRevision: number;
  onBack: () => void;
  onRecover: () => Promise<unknown>;
  isCurrentAccount: () => boolean;
}>;

function availabilityText(item: Display, t: (key: string) => string): string {
  if (item.availability === 'claimable') return t('claimable.ready');
  if (item.availability === 'locked' && item.nextAt)
    return t('claimable.locked') + ' · ' + new Date(item.nextAt * 1000).toLocaleString();
  if (item.availability === 'unknown') return t('claimable.unknown');
  return t('claimable.unclaimable');
}
const order: Record<Display['availability'], number> = { claimable: 0, locked: 1, unclaimable: 2, unknown: 3 };
function sortRows(rows: readonly Display[]): Display[] {
  return [...rows].sort(
    (a, b) =>
      order[a.availability] - order[b.availability] ||
      (b.ledgerTime ?? '').localeCompare(a.ledgerTime ?? '') ||
      a.id.localeCompare(b.id),
  );
}

export function ClaimableScreen({
  account,
  product,
  transaction,
  active: foreground,
  canSign,
  invalidationRevision,
  onBack,
  onRecover,
  isCurrentAccount,
}: Props) {
  const focused = useIsFocused();
  const active = foreground && focused && isCurrentAccount();
  const activeRef = useRef(active);
  activeRef.current = active;
  const { t } = useLocalization();
  const theme = useAppTheme();
  const styles = useThemedStyles(createClaimableStyles);
  const [data, setData] = useState<ClaimableState | undefined>(() => product.readCached(account));
  const [loadError, setLoadError] = useState(false);
  const [loading, setLoading] = useState(false);
  const [clock, setClock] = useState(() => Date.now());
  const [selectedId, setSelectedId] = useState<string>();
  const [suspectsOpen, setSuspectsOpen] = useState(true);
  const [spamOpen, setSpamOpen] = useState(false);
  const [spamCount, setSpamCount] = useState(20);
  const [riskRevision, setRiskRevision] = useState(0);
  const [flow, setFlow] = useState<Flow>({ kind: 'list' });
  const [operationError, setOperationError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [passphrasePrompt, setPassphrasePrompt] = useState(false);
  const passphraseRef = useRef('');
  const [passphraseAttempt, setPassphraseAttempt] = useState(0);
  const running = useRef(false);
  const generation = useRef(0);
  const operationGeneration = useRef(0);
  const lastLoad = useRef(0);

  const refresh = useCallback(
    (force: boolean) => {
      if (!activeRef.current || !isCurrentAccount()) return;
      const id = ++generation.current;
      setLoading(true);
      setLoadError(false);
      void product
        .refresh(account, force)
        .then(result => {
          if (!activeRef.current || generation.current !== id || !isCurrentAccount()) return;
          setData(result);
          setLoadError(result.refreshFailed);
          setClock(Date.now());
        })
        .catch(() => {
          if (activeRef.current && generation.current === id && isCurrentAccount()) setLoadError(true);
        })
        .finally(() => {
          if (generation.current === id && activeRef.current) setLoading(false);
        });
    },
    [account, isCurrentAccount, product],
  );

  useEffect(() => {
    if (!active) {
      generation.current += 1;
      operationGeneration.current += 1;
      lastLoad.current = 0;
      passphraseRef.current = '';
      return;
    }
    if (lastLoad.current !== invalidationRevision + 1) {
      lastLoad.current = invalidationRevision + 1;
      refresh(false);
    }
    const timer = setInterval(() => setClock(Date.now()), 30_000);
    return () => {
      clearInterval(timer);
      generation.current += 1;
      operationGeneration.current += 1;
      passphraseRef.current = '';
    };
  }, [active, invalidationRevision, refresh]);

  // The selected item is always resolved from the current account snapshot.
  // A stale modal callback never transfers its item across accounts.
  const displayed = (data?.snapshot.records ?? []).map(item => {
    const override = product.userSpam(account, item.id);
    return displayedClaimable(item, Math.floor(clock / 1000), { userSpam: override });
  });
  void riskRevision; // Local user mark triggers a fresh cache read during render.
  const safe = sortRows(displayed.filter(row => row.risk === 'SAFE'));
  const suspect = sortRows(displayed.filter(row => row.risk === 'SUSPECT'));
  const spam = sortRows(displayed.filter(row => row.risk === 'SPAM'));
  const selected = displayed.find(row => row.id === selectedId);
  const dataStale =
    !data || data.stale || clock < data.snapshot.savedAt || clock - data.snapshot.savedAt >= CLAIMABLE_TTL_MS;
  const canClaim =
    !!selected &&
    selected.availability === 'claimable' &&
    selected.risk !== 'SPAM' &&
    !dataStale &&
    !data?.refreshFailed &&
    !loading &&
    active &&
    canSign;

  const markSpam = (row: Display, spamChoice: boolean) => {
    if (!activeRef.current || !isCurrentAccount()) return;
    try {
      product.markSpam(account, row.id, spamChoice);
      setRiskRevision(value => value + 1);
      setSelectedId(undefined);
    } catch {
      setOperationError(t('claimable.error'));
    }
  };
  const prepare = async (row: Display) => {
    if (!canClaim || running.current || !activeRef.current || !isCurrentAccount()) return;
    running.current = true;
    const requestVersion = ++operationGeneration.current;
    setOperationError('');
    setSelectedId(undefined);
    setFlow({ kind: 'preparing' });
    try {
      const review = await prepareClaimableReview(transaction, account, row);
      if (!activeRef.current || !isCurrentAccount() || operationGeneration.current !== requestVersion) return;
      setPassphrasePrompt(false);
      setFlow({ kind: 'review', review });
    } catch {
      if (activeRef.current && operationGeneration.current === requestVersion) {
        setOperationError(t('claimable.prepareError'));
        setFlow({ kind: 'list' });
      }
    } finally {
      running.current = false;
    }
  };

  const submit = async (review: ClaimableReview) => {
    if (!activeRef.current || !isCurrentAccount() || running.current) return;
    running.current = true;
    setSubmitting(true);
    setOperationError('');
    const passphrase = passphrasePrompt ? passphraseRef.current : undefined;
    passphraseRef.current = '';
    setPassphraseAttempt(value => value + 1);
    try {
      const result = await submitClaimableReview(transaction, account, review, t('claimable.systemAuth'), passphrase);
      if (!activeRef.current || !isCurrentAccount()) return;
      if (result.status === 'passphrase-required') {
        setPassphrasePrompt(true);
      } else {
        setFlow({ kind: 'result', result });
        if (result.status === 'submitted') refresh(true);
      }
    } catch {
      if (activeRef.current) setOperationError(t('claimable.submitError'));
    } finally {
      running.current = false;
      if (activeRef.current) setSubmitting(false);
    }
  };

  const header = (title: string, back: () => void) => (
    <View style={styles.header}>
      <Text style={styles.title}>{title}</Text>
      <Pressable accessibilityRole="button" onPress={back} style={styles.button}>
        <Text style={styles.buttonText}>{t('common.back')}</Text>
      </Pressable>
    </View>
  );
  if (flow.kind === 'preparing')
    return (
      <Screen scrollable={false}>
        <View style={styles.content}>
          {header(t('claimable.review'), () => {
            operationGeneration.current += 1;
            setFlow({ kind: 'list' });
          })}
          <ActivityIndicator color={theme.colors.actionPrimary} />
          <Text style={styles.helper}>{t('claimable.preparing')}</Text>
        </View>
      </Screen>
    );
  if (flow.kind === 'review')
    return (
      <Screen scrollable={false}>
        <ScrollView contentContainerStyle={styles.content}>
          {header(t('claimable.review'), () => {
            if (!submitting) setFlow({ kind: 'list' });
          })}
          <Text style={styles.helper}>{t('claimable.reviewWarning')}</Text>
          <View style={styles.detailCard}>
            <ClaimablePair styles={styles} label={t('claimable.asset')} value={flow.review.asset.code} />
            <ClaimablePair styles={styles} label={t('claimable.amount')} value={flow.review.amount} />
            <ClaimablePair styles={styles} label={t('claimable.source')} value={flow.review.source} />
            <ClaimablePair styles={styles} label={t('claimable.balanceId')} value={flow.review.id} />
            <ClaimablePair styles={styles} label={t('claimable.fee')} value={flow.review.fee} />
            <ClaimablePair styles={styles} label={t('claimable.risk')} value={flow.review.risk} />
          </View>
          {flow.review.risk !== 'SAFE' ? <Text style={styles.error}>{t('claimable.caution')}</Text> : null}
          {passphrasePrompt ? (
            <>
              <Text style={styles.helper}>{t('claimable.passphrase')}</Text>
              <TextInput
                key={passphraseAttempt}
                secureTextEntry
                autoComplete="off"
                style={styles.passphrase}
                accessibilityLabel={t('claimable.passphrase')}
                onChangeText={value => {
                  passphraseRef.current = value;
                }}
              />
            </>
          ) : null}
          {operationError ? <Text style={styles.error}>{operationError}</Text> : null}
          <SlideToConfirm
            label={t('claimable.slideToClaim')}
            disabled={!active || submitting}
            loading={submitting}
            onComplete={() => void submit(flow.review)}
          />
        </ScrollView>
      </Screen>
    );
  if (flow.kind === 'result') {
    const hash =
      'transactionHash' in flow.result
        ? flow.result.transactionHash
        : 'hash' in flow.result
          ? flow.result.hash
          : undefined;
    return (
      <Screen scrollable={false}>
        <ScrollView contentContainerStyle={styles.content}>
          {header(t('claimable.result'), onBack)}
          <Text style={styles.title}>{t('claimable.result.' + flow.result.status)}</Text>
          {hash ? <ClaimablePair styles={styles} label={t('claimable.hash')} value={hash} /> : null}
          <Text style={styles.helper}>{t('claimable.resultAdvice')}</Text>
          {flow.result.status === 'uncertain' ? (
            <NativeButton label={t('claimable.checkStatus')} onPress={() => void onRecover()} variant="secondary" />
          ) : null}
          <NativeButton label={t('claimable.done')} onPress={onBack} />
        </ScrollView>
      </Screen>
    );
  }

  const renderRow = (row: Display) => (
    <Pressable
      key={row.id}
      accessibilityRole="button"
      accessibilityLabel={row.asset.code + ' ' + row.amount + ' ' + availabilityText(row, t)}
      onPress={() => {
        if (active) {
          setOperationError('');
          setSelectedId(row.id);
        }
      }}
      style={({ pressed }) => [styles.card, pressed ? styles.disabled : undefined]}
    >
      <View style={styles.row}>
        <TokenAssetIcon asset={row.asset} active={active} />
        <View style={styles.rowBody}>
          <Text style={styles.assetCode}>{row.asset.code}</Text>
          <Text numberOfLines={1} style={styles.issuer}>
            {row.asset.kind === 'credit' ? row.asset.issuer : t('claimable.nativeIssuer')}
          </Text>
          <Text style={[styles.state, row.availability === 'claimable' ? styles.safe : styles.warning]}>
            {availabilityText(row, t)}
          </Text>
        </View>
        <Text style={styles.amount}>{row.amount}</Text>
      </View>
    </Pressable>
  );
  return (
    <Screen scrollable={false}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={() => refresh(true)} tintColor={theme.colors.actionPrimary} />
        }
      >
        {header(t('claimable.title'), onBack)}
        <Text style={styles.subtitle}>{t('claimable.description')}</Text>
        {dataStale || loadError ? <Text style={styles.error}>{t('claimable.stale')}</Text> : null}
        {loading && !data ? <ActivityIndicator color={theme.colors.actionPrimary} /> : null}
        {!data && !loading ? <Text style={styles.helper}>{t('claimable.loadError')}</Text> : null}
        <NativeButton
          label={t('claimable.refresh')}
          variant="secondary"
          onPress={() => refresh(true)}
          disabled={loading || !active}
        />
        {data && displayed.length === 0 ? <Text style={styles.helper}>{t('claimable.empty')}</Text> : null}
        {safe.length ? <Text style={styles.sectionTitle}>{t('claimable.safe') + ' (' + safe.length + ')'}</Text> : null}
        {safe.map(renderRow)}
        {suspect.length ? (
          <Pressable accessibilityRole="button" style={styles.section} onPress={() => setSuspectsOpen(!suspectsOpen)}>
            <Text style={styles.sectionTitle}>{t('claimable.suspect') + ' (' + suspect.length + ')'}</Text>
            <Text style={styles.helper}>{suspectsOpen ? '⌃' : '⌄'}</Text>
          </Pressable>
        ) : null}
        {suspectsOpen ? suspect.map(renderRow) : null}
        {spam.length ? (
          <Pressable accessibilityRole="button" style={styles.section} onPress={() => setSpamOpen(!spamOpen)}>
            <Text style={styles.sectionTitle}>{t('claimable.spam') + ' (' + spam.length + ')'}</Text>
            <Text style={styles.helper}>{spamOpen ? '⌃' : '⌄'}</Text>
          </Pressable>
        ) : null}
        {spamOpen ? spam.slice(0, spamCount).map(renderRow) : null}
        {spamOpen && spamCount < spam.length ? (
          <NativeButton
            label={t('claimable.viewMore')}
            variant="secondary"
            onPress={() => setSpamCount(value => value + 20)}
          />
        ) : null}
      </ScrollView>
      {selected ? (
        <BottomSheet visible closeLabel={t('common.back')} onClose={() => setSelectedId(undefined)}>
          <ScrollView contentContainerStyle={styles.sheetContent}>
            {header(t('claimable.details'), () => setSelectedId(undefined))}
            <View style={styles.row}>
              <TokenAssetIcon asset={selected.asset} active={active} />
              <View style={styles.rowBody}>
                <Text style={styles.assetCode}>{selected.asset.code}</Text>
                <Text style={styles.amount}>{selected.amount}</Text>
              </View>
            </View>
            <View style={styles.detailCard}>
              <ClaimablePair styles={styles} label={t('claimable.balanceId')} value={selected.id} />
              <ClaimablePair styles={styles} label={t('claimable.status')} value={availabilityText(selected, t)} />
              <ClaimablePair styles={styles} label={t('claimable.risk')} value={t('claimable.risk.' + selected.risk)} />
              <ClaimablePair styles={styles} label={t('claimable.sponsor')} value={selected.sponsor || '—'} />
              <ClaimablePair
                styles={styles}
                label={t('claimable.issuer')}
                value={selected.asset.kind === 'credit' ? selected.asset.issuer : t('claimable.nativeIssuer')}
              />
              {selected.ledgerTime ? (
                <ClaimablePair styles={styles} label={t('claimable.ledgerTime')} value={selected.ledgerTime} />
              ) : null}
            </View>
            {selected.risk !== 'SAFE' ? <Text style={styles.error}>{t('claimable.caution')}</Text> : null}
            {selected.riskFlags.length ? <Text style={styles.helper}>{selected.riskFlags.join(' · ')}</Text> : null}
            {selected.availability === 'unknown' ? (
              <Text style={styles.error}>{t('claimable.unknownReason')}</Text>
            ) : null}
            {dataStale ? <Text style={styles.error}>{t('claimable.stale')}</Text> : null}
            {operationError ? <Text style={styles.error}>{operationError}</Text> : null}
            <NativeButton label={t('claimable.claim')} disabled={!canClaim} onPress={() => void prepare(selected)} />
            {selected.asset.kind === 'credit' ? (
              <NativeButton
                label={selected.risk === 'SPAM' ? t('claimable.restore') : t('claimable.markSpam')}
                variant="secondary"
                onPress={() => markSpam(selected, selected.risk !== 'SPAM')}
              />
            ) : null}
          </ScrollView>
        </BottomSheet>
      ) : null}
    </Screen>
  );
}

function ClaimablePair({
  label,
  value,
  styles,
}: Readonly<{ label: string; value: string; styles: ReturnType<typeof createClaimableStyles> }>) {
  return (
    <View style={styles.pair}>
      <Text style={styles.label}>{label}</Text>
      <Text selectable style={styles.value}>
        {value}
      </Text>
    </View>
  );
}
