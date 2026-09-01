import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import type {AccountRecord} from '../../capabilities/account/types';
import {
  loadHistoryPage,
  type HistoryDependencies,
} from '../../capabilities/history/loadHistoryPage';
import type {HistoryDirection, HistoryEntry} from '../../capabilities/history/types';
import {stellarDonorAssets} from '../../ui/stellarDonorAssets';
import {palette, radius, spacing, typography} from '../../ui/theme';
import {historyEntryPresentation, mergeHistoryEntries} from './historyList';

type HistoryState =
  | Readonly<{kind: 'loading'}>
  | Readonly<{kind: 'inactive'}>
  | Readonly<{kind: 'unsupported-account'}>
  | Readonly<{kind: 'error'; message: string}>
  | Readonly<{
      kind: 'ready';
      entries: readonly HistoryEntry[];
      nextCursor?: string;
      refreshing: boolean;
      loadingMore: boolean;
      loadMoreError?: string;
    }>;

type DirectionFilter = 'all' | 'incoming' | 'outgoing' | 'other';

type Props = Readonly<{
  account: AccountRecord;
  dependencies: HistoryDependencies;
}>;

export function ActivityHomeScreen({account, dependencies}: Props) {
  const [state, setState] = useState<HistoryState>({kind: 'loading'});
  const [searchText, setSearchText] = useState('');
  const [filtersVisible, setFiltersVisible] = useState(false);
  const [directionFilter, setDirectionFilter] = useState<DirectionFilter>('all');
  const requestVersion = useRef(0);

  const loadInitial = useCallback(
    (refreshing: boolean) => {
      const version = requestVersion.current + 1;
      requestVersion.current = version;

      if (refreshing) {
        setState(current =>
          current.kind === 'ready'
            ? {...current, refreshing: true, loadMoreError: undefined}
            : {kind: 'loading'},
        );
      } else {
        setState({kind: 'loading'});
      }

      void loadHistoryPage(dependencies, account)
        .then(page => {
          if (requestVersion.current !== version) {
            return;
          }

          switch (page.status) {
            case 'inactive':
              setState({kind: 'inactive'});
              return;
            case 'unsupported-account':
              setState({kind: 'unsupported-account'});
              return;
            case 'active':
              setState({
                kind: 'ready',
                entries: page.entries,
                ...(page.nextCursor === undefined ? {} : {nextCursor: page.nextCursor}),
                refreshing: false,
                loadingMore: false,
              });
              return;
          }
        })
        .catch(error => {
          if (requestVersion.current === version) {
            setState({kind: 'error', message: readableError(error)});
          }
        });
    },
    [account, dependencies],
  );

  useEffect(() => {
    setSearchText('');
    setDirectionFilter('all');
    setFiltersVisible(false);
    loadInitial(false);
    return () => {
      requestVersion.current += 1;
    };
  }, [loadInitial]);

  const loadMore = useCallback(() => {
    if (
      state.kind !== 'ready' ||
      state.loadingMore ||
      state.refreshing ||
      state.nextCursor === undefined
    ) {
      return;
    }

    const version = requestVersion.current;
    const cursor = state.nextCursor;
    setState({...state, loadingMore: true, loadMoreError: undefined});

    void loadHistoryPage(dependencies, account, {cursor})
      .then(page => {
        if (requestVersion.current !== version) {
          return;
        }
        if (page.status !== 'active') {
          throw new Error(
            page.status === 'inactive'
              ? 'history-account-became-inactive'
              : 'history-account-type-changed',
          );
        }

        setState(current => {
          if (current.kind !== 'ready') {
            return current;
          }
          return {
            kind: 'ready',
            entries: mergeHistoryEntries(current.entries, page.entries),
            ...(page.nextCursor === undefined ? {} : {nextCursor: page.nextCursor}),
            refreshing: false,
            loadingMore: false,
          };
        });
      })
      .catch(error => {
        if (requestVersion.current === version) {
          setState(current =>
            current.kind === 'ready'
              ? {...current, loadingMore: false, loadMoreError: readableError(error)}
              : current,
          );
        }
      });
  }, [account, dependencies, state]);

  const visibleEntries = useMemo(() => {
    if (state.kind !== 'ready') {
      return [];
    }
    const normalizedSearch = searchText.trim().toLocaleLowerCase();
    return state.entries.filter(entry => {
      if (!matchesDirection(entry, directionFilter)) {
        return false;
      }
      if (!normalizedSearch) {
        return true;
      }
      return searchableText(entry).includes(normalizedSearch);
    });
  }, [directionFilter, searchText, state]);

  const groups = useMemo(() => groupByDate(visibleEntries), [visibleEntries]);

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.title}>Activity</Text>
        <Pressable
          accessibilityLabel="Filter activity"
          accessibilityState={{selected: filtersVisible}}
          onPress={() => setFiltersVisible(current => !current)}
          style={({pressed}) => [styles.iconButton, pressed ? styles.pressed : undefined]}>
          <Image source={stellarDonorAssets.filter} style={styles.headerIcon} />
        </Pressable>
      </View>

      <View style={styles.searchWrap}>
        <Image source={stellarDonorAssets.search} style={styles.searchIcon} />
        <TextInput
          value={searchText}
          onChangeText={setSearchText}
          placeholder="Search"
          placeholderTextColor={palette.textMuted}
          autoCapitalize="none"
          autoCorrect={false}
          style={styles.searchInput}
        />
        {searchText ? (
          <Pressable onPress={() => setSearchText('')} style={styles.clearButton}>
            <Text style={styles.clearText}>×</Text>
          </Pressable>
        ) : null}
      </View>

      {filtersVisible ? (
        <ScrollView
          horizontal
          keyboardShouldPersistTaps="handled"
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterChips}>
          {(['all', 'incoming', 'outgoing', 'other'] as const).map(filter => (
            <Pressable
              key={filter}
              onPress={() => setDirectionFilter(filter)}
              style={({pressed}) => [
                styles.filterChip,
                directionFilter === filter ? styles.filterChipSelected : undefined,
                pressed ? styles.pressed : undefined,
              ]}>
              <Text
                style={[
                  styles.filterChipText,
                  directionFilter === filter ? styles.filterChipTextSelected : undefined,
                ]}>
                {filterLabel(filter)}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      ) : null}

      {renderBody({state, groups, onRefresh: () => loadInitial(true), onLoadMore: loadMore})}
    </View>
  );
}

function renderBody({
  state,
  groups,
  onRefresh,
  onLoadMore,
}: Readonly<{
  state: HistoryState;
  groups: readonly HistoryGroup[];
  onRefresh: () => void;
  onLoadMore: () => void;
}>) {
  if (state.kind === 'loading') {
    return <CenteredState loading title="Loading activity" detail="Loading recent Stellar operations…" />;
  }
  if (state.kind === 'inactive') {
    return <CenteredState title="No activity yet" detail="This account is not activated on the selected Stellar network." />;
  }
  if (state.kind === 'unsupported-account') {
    return <CenteredState title="History unavailable" detail="Classic Horizon activity is not applied to contract accounts." />;
  }
  if (state.kind === 'error') {
    return <CenteredState title="Unable to load activity" detail={state.message} action="Retry" onAction={onRefresh} />;
  }

  return (
    <ScrollView
      style={styles.list}
      contentContainerStyle={styles.listContent}
      refreshControl={
        <RefreshControl
          refreshing={state.refreshing}
          onRefresh={onRefresh}
          tintColor={palette.accent}
        />
      }>
      {groups.length === 0 ? (
        <CenteredState title="No activity found" detail="Try another search or filter." embedded />
      ) : (
        groups.map(group => (
          <View key={group.key}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionHeaderText}>{group.label}</Text>
            </View>
            {group.entries.map(entry => (
              <ActivityRow key={entry.id} entry={entry} />
            ))}
          </View>
        ))
      )}

      {state.loadMoreError ? (
        <Text style={styles.loadMoreError}>{state.loadMoreError}</Text>
      ) : null}
      {state.nextCursor !== undefined ? (
        <Pressable
          disabled={state.loadingMore || state.refreshing}
          onPress={onLoadMore}
          style={({pressed}) => [styles.loadMore, pressed ? styles.pressed : undefined]}>
          {state.loadingMore ? <ActivityIndicator color={palette.accent} /> : null}
          <Text style={styles.loadMoreText}>{state.loadingMore ? 'Loading…' : 'Load more'}</Text>
        </Pressable>
      ) : null}
    </ScrollView>
  );
}

function ActivityRow({entry}: Readonly<{entry: HistoryEntry}>) {
  const presentation = historyEntryPresentation(entry);
  const amount = activityAmount(entry);
  const direction = activityDirection(entry);

  return (
    <View style={styles.row}>
      <View style={[styles.rowIcon, direction === 'incoming' ? styles.rowIconIncoming : undefined]}>
        <Text style={styles.rowIconText}>{direction === 'incoming' ? '↓' : direction === 'outgoing' ? '↑' : '•'}</Text>
      </View>
      <View style={styles.rowCopy}>
        <Text style={styles.rowTitle}>{presentation.title}</Text>
        <Text numberOfLines={1} style={styles.rowSubtitle}>{compact(presentation.secondary)}</Text>
      </View>
      <View style={styles.rowValue}>
        <Text
          style={[
            styles.amount,
            direction === 'incoming' ? styles.amountIncoming : undefined,
          ]}>
          {amount}
        </Text>
        <Text style={styles.time}>{formatTime(entry.occurredAt)}</Text>
      </View>
    </View>
  );
}

function CenteredState({
  loading = false,
  title,
  detail,
  action,
  onAction,
  embedded = false,
}: Readonly<{
  loading?: boolean;
  title: string;
  detail: string;
  action?: string;
  onAction?: () => void;
  embedded?: boolean;
}>) {
  return (
    <View style={[styles.empty, embedded ? styles.emptyEmbedded : undefined]}>
      {loading ? <ActivityIndicator color={palette.accent} /> : null}
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyDetail}>{detail}</Text>
      {action && onAction ? (
        <Pressable onPress={onAction} style={styles.retryButton}>
          <Text style={styles.retryText}>{action}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

type HistoryGroup = Readonly<{
  key: string;
  label: string;
  entries: readonly HistoryEntry[];
}>;

function groupByDate(entries: readonly HistoryEntry[]): HistoryGroup[] {
  const groups = new Map<string, HistoryEntry[]>();
  for (const entry of entries) {
    const date = new Date(entry.occurredAt);
    const key = Number.isNaN(date.getTime()) ? 'unknown' : date.toISOString().slice(0, 10);
    const current = groups.get(key) ?? [];
    current.push(entry);
    groups.set(key, current);
  }
  return [...groups.entries()].map(([key, grouped]) => ({
    key,
    label: key === 'unknown' ? 'Unknown date' : dateLabel(new Date(`${key}T00:00:00Z`)),
    entries: grouped,
  }));
}

function dateLabel(date: Date): string {
  const now = new Date();
  const today = utcDayKey(now);
  const yesterday = utcDayKey(new Date(now.getTime() - 24 * 60 * 60 * 1000));
  const key = utcDayKey(date);
  if (key === today) {
    return 'Today';
  }
  if (key === yesterday) {
    return 'Yesterday';
  }
  return date.toLocaleDateString(undefined, {day: '2-digit', month: 'short', year: date.getUTCFullYear() === now.getUTCFullYear() ? undefined : 'numeric'});
}

function utcDayKey(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
}

function matchesDirection(entry: HistoryEntry, filter: DirectionFilter): boolean {
  if (filter === 'all') {
    return true;
  }
  const direction = activityDirection(entry);
  if (filter === 'other') {
    return direction !== 'incoming' && direction !== 'outgoing';
  }
  return direction === filter;
}

function activityDirection(entry: HistoryEntry): HistoryDirection {
  return entry.kind === 'unsupported' ? 'neutral' : entry.direction;
}

function activityAmount(entry: HistoryEntry): string {
  if (entry.kind === 'payment') {
    const sign = entry.direction === 'incoming' ? '+' : entry.direction === 'outgoing' ? '−' : '';
    return `${sign}${entry.amount} ${entry.asset.code}`;
  }
  if (entry.kind === 'create-account') {
    const sign = entry.direction === 'incoming' ? '+' : entry.direction === 'outgoing' ? '−' : '';
    return `${sign}${entry.startingBalance} XLM`;
  }
  return entry.operationType;
}

function searchableText(entry: HistoryEntry): string {
  const presentation = historyEntryPresentation(entry);
  const values = [
    presentation.title,
    presentation.primary,
    presentation.secondary,
    entry.operationType,
    entry.transactionHash,
    entry.sourceAccount,
  ];
  if (entry.kind === 'payment') {
    values.push(entry.amount, entry.asset.code, entry.counterparty);
    if (entry.asset.kind === 'credit') {
      values.push(entry.asset.issuer);
    }
  } else if (entry.kind === 'create-account') {
    values.push(entry.startingBalance, entry.counterparty);
  }
  return values.join(' ').toLocaleLowerCase();
}

function compact(value: string): string {
  return value.length <= 22 ? value : `${value.slice(0, 10)}…${value.slice(-8)}`;
}

function formatTime(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? ''
    : date.toLocaleTimeString(undefined, {hour: '2-digit', minute: '2-digit'});
}

function filterLabel(filter: DirectionFilter): string {
  switch (filter) {
    case 'all':
      return 'All';
    case 'incoming':
      return 'Incoming';
    case 'outgoing':
      return 'Outgoing';
    case 'other':
      return 'Other';
  }
}

function readableError(error: unknown): string {
  return error instanceof Error ? error.message : 'Unable to load account activity.';
}

const styles = StyleSheet.create({
  root: {flex: 1, backgroundColor: palette.background},
  header: {
    minHeight: 68,
    paddingHorizontal: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {...typography.title, color: palette.text},
  iconButton: {width: 42, height: 42, alignItems: 'center', justifyContent: 'center'},
  headerIcon: {width: 25, height: 25, resizeMode: 'contain', tintColor: palette.text},
  searchWrap: {
    marginHorizontal: spacing.md,
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.md,
    backgroundColor: palette.tint,
    paddingHorizontal: 12,
  },
  searchIcon: {width: 20, height: 20, resizeMode: 'contain', tintColor: palette.textMuted},
  searchInput: {flex: 1, minHeight: 44, paddingHorizontal: 10, ...typography.body, color: palette.text},
  clearButton: {width: 30, height: 36, alignItems: 'center', justifyContent: 'center'},
  clearText: {fontSize: 22, color: palette.textMuted},
  filterChips: {paddingHorizontal: spacing.md, paddingVertical: spacing.sm, gap: 8},
  filterChip: {borderRadius: radius.pill, backgroundColor: palette.tint, paddingHorizontal: 12, paddingVertical: 7},
  filterChipSelected: {backgroundColor: palette.darkBlue},
  filterChipText: {...typography.caption, color: palette.text, fontWeight: '700'},
  filterChipTextSelected: {color: palette.white},
  list: {flex: 1},
  listContent: {paddingHorizontal: spacing.md, paddingBottom: spacing.xl},
  sectionHeader: {backgroundColor: palette.background, paddingTop: 14, paddingBottom: 5},
  sectionHeaderText: {...typography.label, color: palette.textMuted},
  row: {
    minHeight: 70,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: palette.border,
  },
  rowIcon: {width: 40, height: 40, borderRadius: 20, backgroundColor: palette.tint, alignItems: 'center', justifyContent: 'center'},
  rowIconIncoming: {backgroundColor: '#E9FAF4'},
  rowIconText: {fontSize: 20, color: palette.text, fontWeight: '700'},
  rowCopy: {flex: 1, minWidth: 0},
  rowTitle: {...typography.body, color: palette.text, fontWeight: '700'},
  rowSubtitle: {...typography.caption, color: palette.textMuted, marginTop: 2},
  rowValue: {alignItems: 'flex-end', maxWidth: '44%'},
  amount: {...typography.body, color: palette.text, fontWeight: '700', fontVariant: ['tabular-nums']},
  amountIncoming: {color: palette.success},
  time: {...typography.caption, color: palette.textMuted, marginTop: 2},
  empty: {flex: 1, paddingHorizontal: spacing.xl, alignItems: 'center', justifyContent: 'center', gap: spacing.sm},
  emptyEmbedded: {minHeight: 260, flex: 0},
  emptyTitle: {...typography.sectionTitle, color: palette.text, textAlign: 'center'},
  emptyDetail: {...typography.body, color: palette.textMuted, textAlign: 'center'},
  retryButton: {marginTop: spacing.xs, borderRadius: radius.pill, backgroundColor: palette.accent, paddingHorizontal: spacing.lg, paddingVertical: 10},
  retryText: {...typography.label, color: palette.white},
  loadMore: {minHeight: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm},
  loadMoreText: {...typography.label, color: palette.accent},
  loadMoreError: {...typography.caption, color: palette.danger, textAlign: 'center', paddingTop: spacing.md},
  pressed: {opacity: 0.62},
});
