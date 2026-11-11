import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useFocusEffect, useIsFocused } from '@react-navigation/native';
import { AppModal, Screen } from '@ui/components';
import { NativeButton } from '@ui/components/NativeButton';
import { useAppTheme, useThemedStyles } from '@ui/theme';
import { SlideToConfirm } from '../../ui/SlideToConfirm';
import { SmallChevron } from '../../ui/components/SmallIcons';
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
import { maskAddress } from '../home/homeViewModel';

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
  onRecover: () => Promise<unknown>;
  isCurrentAccount: () => boolean;
  refreshSignal?: number;
  onSnapshotUpdated?: (snapshot: ClaimableState) => void;
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
  onRecover,
  isCurrentAccount,
  refreshSignal = 0,
  onSnapshotUpdated,
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
  const [passphrasePrompt, setPassphrasePrompt] = useState(true);
  const passphraseRef = useRef('');
  const [passphraseAttempt, setPassphraseAttempt] = useState(0);
  const [technicalOpen, setTechnicalOpen] = useState(false);
  const running = useRef(false);
  const generation = useRef(0);
  const operationGeneration = useRef(0);
  const lastLoad = useRef(0);
  const lastRefreshSignal = useRef(refreshSignal);

  // A navigation blur must invalidate in-flight authorization even if React
  // has not rerendered this screen yet; returning to the route is a new epoch.
  useFocusEffect(
    useCallback(
      () => () => {
        activeRef.current = false;
        operationGeneration.current += 1;
        passphraseRef.current = '';
      },
      [],
    ),
  );

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
          onSnapshotUpdated?.(result);
        })
        .catch(() => {
          if (activeRef.current && generation.current === id && isCurrentAccount()) setLoadError(true);
        })
        .finally(() => {
          if (generation.current === id && activeRef.current) setLoading(false);
        });
    },
    [account, isCurrentAccount, onSnapshotUpdated, product],
  );

  useEffect(() => {
    if (active && lastRefreshSignal.current !== refreshSignal) {
      lastRefreshSignal.current = refreshSignal;
      refresh(true);
    }
  }, [active, refresh, refreshSignal]);

  useEffect(() => {
    if (!active) {
      generation.current += 1;
      operationGeneration.current += 1;
      lastLoad.current = 0;
      passphraseRef.current = '';
      return;
    }
    if (lastLoad.current === 0) {
      // Foreground/focus returned after an expired attempt. Reset the local
      // controls without changing any already-durable transaction recovery.
      running.current = false;
      setSubmitting(false);
      setPassphrasePrompt(true);
      setSelectedId(undefined);
      setFlow(current => (current.kind === 'review' || current.kind === 'preparing' ? { kind: 'list' } : current));
    }
    if (lastLoad.current !== invalidationRevision + 1) {
      lastLoad.current = invalidationRevision + 1;
      refresh(false);
    }
    const timer = setInterval(() => setClock(Date.now()), 30_000);
    return () => {
      clearInterval(timer);
      generation.current += 1;
      // A cache invalidation or parent rerender is not a route blur:
      // do not cancel active authorization merely because refresh changed.
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
      setPassphrasePrompt(true);
      setFlow({ kind: 'review', review });
    } catch {
      if (activeRef.current && operationGeneration.current === requestVersion) {
        setOperationError(t('claimable.prepareError'));
        setFlow({ kind: 'list' });
      }
    } finally {
      if (operationGeneration.current === requestVersion) running.current = false;
    }
  };

  const submit = async (review: ClaimableReview, reviewedEpoch: number) => {
    if (!activeRef.current || !isCurrentAccount() || running.current || operationGeneration.current !== reviewedEpoch)
      return;
    const requestVersion = reviewedEpoch;
    const isCurrent = () => activeRef.current && isCurrentAccount() && operationGeneration.current === requestVersion;
    if (!isCurrent()) return;
    running.current = true;
    setSubmitting(true);
    setOperationError('');
    const passphrase = passphrasePrompt ? passphraseRef.current : undefined;
    passphraseRef.current = '';
    setPassphraseAttempt(value => value + 1);
    try {
      const result = await submitClaimableReview(
        transaction,
        account,
        review,
        t('claimable.systemAuth'),
        isCurrent,
        passphrase,
      );
      if (!isCurrent()) return;
      if (result.status === 'passphrase-required') {
        setPassphrasePrompt(true);
      } else {
        setFlow({ kind: 'result', result });
        if (result.status === 'submitted') refresh(true);
      }
    } catch {
      if (isCurrent()) setOperationError(t('claimable.submitError'));
    } finally {
      if (operationGeneration.current === requestVersion) running.current = false;
      if (isCurrent()) setSubmitting(false);
    }
  };

  const leave = () => {
    operationGeneration.current += 1;
    passphraseRef.current = '';
    running.current = false;
    setSubmitting(false);
    setPassphrasePrompt(true);
    setFlow({ kind: 'list' });
    refresh(true);
  };

  const closeReview = () => {
    operationGeneration.current += 1;
    running.current = false;
    passphraseRef.current = '';
    setPassphrasePrompt(true);
    setSubmitting(false);
    setOperationError('');
    setFlow({ kind: 'list' });
  };

  const wrapFlow = (node: React.ReactElement) => (
    <Modal visible animationType="slide" onRequestClose={closeReview}>
      {node}
    </Modal>
  );

  const header = (title: string, back: () => void) => (
    <View style={styles.header}>
      <Text style={styles.title}>{title}</Text>
      <Pressable accessibilityRole="button" onPress={back} style={styles.button}>
        <Text style={styles.buttonText}>{t('common.back')}</Text>
      </Pressable>
    </View>
  );
  if (flow.kind === 'preparing')
    return wrapFlow(
      <Screen scrollable={false}>
        <View style={styles.content}>
          {header(t('claimable.review'), closeReview)}
          <ActivityIndicator color={theme.colors.actionPrimary} />
          <Text style={styles.helper}>{t('claimable.preparing')}</Text>
        </View>
      </Screen>,
    );
  const presentedReviewEpoch = operationGeneration.current;
  if (flow.kind === 'review')
    return wrapFlow(
      <Screen scrollable={false}>
        <ScrollView contentContainerStyle={styles.content} style={styles.reviewScroll}>
          {header(t('claimable.review'), () => {
            closeReview();
          })}
          <Text style={styles.helper}>{t('claimable.reviewWarning')}</Text>
          <View style={styles.detailCard}>
            <ClaimablePair styles={styles} label={t('claimable.asset')} value={flow.review.asset.code} />
            {flow.review.asset.kind === 'credit' ? (
              <ClaimablePair styles={styles} label={t('claimable.issuer')} value={flow.review.asset.issuer} />
            ) : null}
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
        </ScrollView>
        <View style={styles.reviewFooter}>
          <SlideToConfirm
            label={t('claimable.slideToClaim')}
            disabled={!active || submitting}
            loading={submitting}
            onComplete={() => void submit(flow.review, presentedReviewEpoch)}
          />
        </View>
      </Screen>,
    );
  if (flow.kind === 'result') {
    const hash =
      'transactionHash' in flow.result
        ? flow.result.transactionHash
        : 'hash' in flow.result
          ? flow.result.hash
          : undefined;
    return wrapFlow(
      <Screen scrollable={false}>
        <ScrollView contentContainerStyle={styles.content}>
          {header(t('claimable.result'), leave)}
          <Text style={styles.title}>{t('claimable.result.' + flow.result.status)}</Text>
          {hash ? <ClaimablePair styles={styles} label={t('claimable.hash')} value={hash} /> : null}
          <Text style={styles.helper}>{t('claimable.resultAdvice')}</Text>
          {flow.result.status === 'uncertain' ? (
            <NativeButton label={t('claimable.checkStatus')} onPress={() => void onRecover()} variant="secondary" />
          ) : null}
          <NativeButton label={t('claimable.done')} onPress={leave} />
        </ScrollView>
      </Screen>,
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
          setTechnicalOpen(false);
          setSelectedId(row.id);
        }
      }}
      style={({ pressed }) => [
        styles.claimableRow,
        row.risk === 'SUSPECT' ? styles.suspectRow : undefined,
        pressed ? styles.disabled : undefined,
      ]}
    >
      <View style={styles.avatar}>
        <TokenAssetIcon asset={row.asset} active={active} />
      </View>
      <View style={styles.rowBody}>
        <Text numberOfLines={1} style={styles.assetCode}>
          {row.asset.code}
        </Text>
        <Text numberOfLines={1} style={styles.issuer}>
          {row.asset.kind === 'credit' ? maskAddress(row.asset.issuer) : t('claimable.nativeIssuer')}
        </Text>
      </View>
      <View style={styles.amountColumn}>
        <Text numberOfLines={1} style={styles.amount}>
          {row.amount}
        </Text>
        <Text
          numberOfLines={1}
          style={[
            styles.state,
            row.availability === 'claimable'
              ? styles.safe
              : row.availability === 'locked'
                ? styles.locked
                : styles.warning,
          ]}
        >
          {availabilityText(row, t)}
        </Text>
      </View>
    </Pressable>
  );
  const listContent = (
    <>
      {dataStale && data ? <Text style={styles.error}>{t('claimable.stale')}</Text> : null}
      {loadError && !data ? <Text style={styles.error}>{t('claimable.loadError')}</Text> : null}
      {loading ? <ActivityIndicator color={theme.colors.actionPrimary} /> : null}
      {!data && !loading ? (
        <NativeButton label={t('claimable.refresh')} variant="secondary" onPress={() => refresh(true)} />
      ) : null}
      {data && displayed.length === 0 ? <Text style={styles.helper}>{t('claimable.empty')}</Text> : null}
      {safe.map(renderRow)}
      {suspect.length ? (
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ expanded: suspectsOpen }}
          style={[styles.section, styles.suspectSection]}
          onPress={() => setSuspectsOpen(value => !value)}
        >
          <Text style={[styles.sectionTitle, styles.suspectSectionText]}>
            {t('claimable.suspect') + ' (' + suspect.length + ')'}
          </Text>
          <SmallChevron color={theme.colors.warning} up={suspectsOpen} />
        </Pressable>
      ) : null}
      {suspectsOpen ? suspect.map(renderRow) : null}
      {spam.length ? (
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ expanded: spamOpen }}
          style={[styles.section, styles.spamSection]}
          onPress={() => setSpamOpen(value => !value)}
        >
          <Text style={styles.sectionTitle}>{t('claimable.spam') + ' (' + spam.length + ')'}</Text>
          <SmallChevron color={theme.colors.textSecondary} up={spamOpen} />
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
    </>
  );
  const details = selected ? (
    <AppModal
      visible
      onRequestClose={() => {
        setSelectedId(undefined);
        setTechnicalOpen(false);
      }}
    >
      <View style={styles.detailHeading}>
        <Text style={styles.title}>{t('claimable.details')}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('common.close')}
          style={styles.button}
          onPress={() => {
            setSelectedId(undefined);
            setTechnicalOpen(false);
          }}
        >
          <Text style={styles.buttonText}>{t('common.close')}</Text>
        </Pressable>
      </View>
      <ScrollView style={styles.dialogScroll} contentContainerStyle={styles.dialogContent}>
        <View style={styles.detailPrimary}>
          <View style={styles.claimableRow}>
            <View style={styles.avatar}>
              <TokenAssetIcon asset={selected.asset} active={active} />
            </View>
            <View style={styles.rowBody}>
              <Text numberOfLines={1} style={styles.assetCode}>
                {selected.asset.code}
              </Text>
              <Text numberOfLines={1} style={styles.issuer}>
                {selected.asset.kind === 'credit' ? maskAddress(selected.asset.issuer) : t('claimable.nativeIssuer')}
              </Text>
              {selected.risk !== 'SAFE' ? (
                <Text style={styles.warning}>{t('claimable.risk.' + selected.risk)}</Text>
              ) : null}
            </View>
            <Text numberOfLines={1} style={styles.amount}>
              {selected.amount}
            </Text>
          </View>
          <View
            style={[
              styles.statusChip,
              selected.availability === 'claimable'
                ? styles.statusReady
                : selected.availability === 'locked'
                  ? styles.statusLocked
                  : selected.availability === 'unclaimable'
                    ? styles.statusUnclaimable
                    : styles.statusUnknown,
            ]}
          >
            <Text style={styles.statusIcon}>
              {selected.availability === 'claimable' ? '✓' : selected.availability === 'locked' ? '⌛' : '!'}
            </Text>
            <Text style={styles.statusChipText}>
              {selected.availability === 'locked' && selected.nextAt
                ? t('claimable.unlockInDays').replace(
                    '{days}',
                    String(Math.max(1, Math.ceil((selected.nextAt * 1000 - clock) / 86400000))),
                  )
                : availabilityText(selected, t)}
            </Text>
          </View>
          <View style={styles.claimAction}>
            <NativeButton label={t('claimable.claim')} disabled={!canClaim} onPress={() => void prepare(selected)} />
          </View>
        </View>
        {selected.availability !== 'claimable' ? (
          <View style={styles.statusExplanation}>
            <Text style={styles.warning}>
              {selected.availability === 'locked' && selected.nextAt
                ? t('claimable.availableAt').replace('{time}', new Date(selected.nextAt * 1000).toLocaleString())
                : selected.availability === 'unknown'
                  ? t('claimable.unknownReason')
                  : t('claimable.unclaimable')}
            </Text>
          </View>
        ) : null}
        {selected.risk !== 'SAFE' ? <Text style={styles.error}>{t('claimable.caution')}</Text> : null}
        {selected.riskFlags.length ? <Text style={styles.helper}>{selected.riskFlags.join(' · ')}</Text> : null}
        {dataStale ? <Text style={styles.error}>{t('claimable.stale')}</Text> : null}
        {operationError ? <Text style={styles.error}>{operationError}</Text> : null}
        {selected.risk === 'SUSPECT' || selected.risk === 'SPAM' ? (
          <NativeButton
            label={selected.risk === 'SPAM' ? t('claimable.restore') : t('claimable.markSpam')}
            variant="secondary"
            onPress={() => markSpam(selected, selected.risk !== 'SPAM')}
          />
        ) : null}
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ expanded: technicalOpen }}
          onPress={() => setTechnicalOpen(value => !value)}
          style={styles.technicalToggle}
        >
          <Text style={styles.sectionTitle}>{t('claimable.technicalDetails')}</Text>
          <SmallChevron color={theme.colors.textSecondary} up={technicalOpen} />
        </Pressable>
        {technicalOpen ? (
          <View style={styles.technicalDetails}>
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
        ) : null}
      </ScrollView>
    </AppModal>
  ) : null;

  return (
    <View style={styles.embeddedList}>
      {listContent}
      {details}
    </View>
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
