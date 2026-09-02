import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  SafeAreaView,
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
import type {HistoryEntry} from '../../capabilities/history/types';
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

type Props = Readonly<{
  account: AccountRecord;
  dependencies: HistoryDependencies;
}>;

export function ActivityHomeScreen({account, dependencies}: Props) {
  const [state, setState] = useState<HistoryState>({kind: 'loading'});
  const [searchText, setSearchText] = useState('');
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
    if (state.kind !== 'ready' || searchText.trim() === '') {
      return state.kind === 'ready' ? state.entries : [];
    }
    const query = searchText.trim().toLowerCase();
    return state.entries.filter(entry => {
      const presentation = historyEntryPresentation(entry);
      return [
        presentation.title,
        presentation.primary,
        presentation.secondary,
        entry.transactionHash,
      ].some(value => value.toLowerCase().includes(query));
    });
  }, [searchText, state]);

  const refreshing = state.kind === 'ready' && state.refreshing;

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Text style={styles.title}>Activity</Text>
        <View
          accessibilityLabel="Filter activity"
          accessibilityRole="button"
          accessibilityState={{disabled: true}}
          style={styles.filterButton}>
          <Text style={styles.filterGlyph}>≡</Text>
        </View>
      </View>

      <View style={styles.searchBox}>
        <Text style={styles.searchGlyph}>⌕</Text>
        <TextInput
          autoCapitalize="none"
          autoCorrect={false}
          onChangeText={setSearchText}
          placeholder="Search"
          placeholderTextColor="#ACB1C1"
          returnKeyType="search"
          style={styles.searchInput}
          value={searchText}
        />
      </View>

      <ScrollView
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            tintColor="#181D41"
            onRefresh={() => loadInitial(true)}
          />
        }
        showsVerticalScrollIndicator={false}>
        {renderHistoryState(state, visibleEntries, () => loadInitial(true), loadMore)}
      </ScrollView>
    </SafeAreaView>
  );
}

function renderHistoryState(
  state: HistoryState,
  visibleEntries: readonly HistoryEntry[],
  onRefresh: () => void,
  onLoadMore: () => void,
): React.ReactNode {
  switch (state.kind) {
    case 'loading':
      return <StatePanel loading title="Loading activity" message="Loading recent Stellar operations…" />;
    case 'inactive':
      return (
        <StatePanel
          title="No activity yet"
          message="This account is not activated on the selected Stellar network."
          action="Refresh"
          onAction={onRefresh}
        />
      );
    case 'unsupported-account':
      return (
        <StatePanel
          title="History unavailable"
          message="Classic Horizon operation history is not applied to contract accounts in this version."
        />
      );
    case 'error':
      return (
        <StatePanel
          title="Unable to load activity"
          message={state.message}
          action="Try again"
          onAction={onRefresh}
        />
      );
    case 'ready': {
      if (visibleEntries.length === 0) {
        return (
          <StatePanel
            title="No activity found"
            message={
              state.entries.length === 0
                ? 'No successful Stellar operations yet.'
                : 'No activity matches your search.'
            }
          />
        );
      }

      let previousDate = '';
      return (
        <>
          {visibleEntries.map(entry => {
            const dateLabel = new Date(entry.occurredAt).toLocaleDateString(undefined, {
              month: 'long',
              day: 'numeric',
              year: 'numeric',
            });
            const showDate = dateLabel !== previousDate;
            previousDate = dateLabel;
            return (
              <React.Fragment key={entry.id}>
                {showDate ? <Text style={styles.dateHeader}>{dateLabel}</Text> : null}
                <HistoryRow entry={entry} />
              </React.Fragment>
            );
          })}
          {state.loadMoreError ? (
            <Text style={styles.loadMoreError}>{state.loadMoreError}</Text>
          ) : null}
          {state.nextCursor !== undefined ? (
            <Pressable
              disabled={state.loadingMore || state.refreshing}
              onPress={onLoadMore}
              style={({pressed}) => [styles.loadMoreButton, pressed ? styles.pressed : undefined]}>
              {state.loadingMore ? (
                <ActivityIndicator color="#00B279" />
              ) : (
                <Text style={styles.loadMoreText}>Load older activity</Text>
              )}
            </Pressable>
          ) : null}
        </>
      );
    }
  }
}

function HistoryRow({entry}: Readonly<{entry: HistoryEntry}>) {
  const presentation = historyEntryPresentation(entry);
  const incoming = presentation.title === 'Received' || presentation.title === 'Account funded';
  const outgoing = presentation.title === 'Sent' || presentation.title === 'Funded account';
  const glyph = incoming ? '↙' : outgoing ? '↗' : '•';

  return (
    <View style={styles.activityRow}>
      <View
        style={[
          styles.operationIcon,
          incoming
            ? styles.operationIncoming
            : outgoing
              ? styles.operationOutgoing
              : styles.operationNeutral,
        ]}>
        <Text style={styles.operationGlyph}>{glyph}</Text>
      </View>
      <View style={styles.activityIdentity}>
        <Text style={styles.activityTitle}>{presentation.title}</Text>
        <Text numberOfLines={1} style={styles.activitySecondary}>
          {shortAddress(presentation.secondary)}
        </Text>
        <Text style={styles.activityTime}>
          {new Date(entry.occurredAt).toLocaleTimeString(undefined, {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </Text>
      </View>
      <Text
        numberOfLines={1}
        style={[
          styles.activityAmount,
          incoming ? styles.amountIncoming : outgoing ? styles.amountOutgoing : undefined,
        ]}>
        {presentation.primary}
      </Text>
    </View>
  );
}

function StatePanel({
  title,
  message,
  action,
  onAction,
  loading = false,
}: Readonly<{
  title: string;
  message: string;
  action?: string;
  onAction?: () => void;
  loading?: boolean;
}>) {
  return (
    <View style={styles.statePanel}>
      {loading ? (
        <ActivityIndicator color="#00CA8A" />
      ) : (
        <View style={styles.emptyIcon}><Text style={styles.emptyGlyph}>◎</Text></View>
      )}
      <Text style={styles.stateTitle}>{title}</Text>
      <Text style={styles.stateMessage}>{message}</Text>
      {action && onAction ? (
        <Pressable onPress={onAction} style={styles.stateAction}>
          <Text style={styles.stateActionText}>{action}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function readableError(error: unknown): string {
  return error instanceof Error ? error.message : 'Unable to load account activity.';
}

function shortAddress(value: string): string {
  if (value.length <= 22) {
    return value;
  }
  return `${value.slice(0, 9)}…${value.slice(-7)}`;
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    minHeight: 60,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '800',
    color: '#000000',
    letterSpacing: -0.6,
  },
  filterButton: {
    width: 30,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0.45,
  },
  filterGlyph: {
    fontSize: 22,
    lineHeight: 25,
    color: '#181D41',
    fontWeight: '700',
    transform: [{rotate: '90deg'}],
  },
  searchBox: {
    height: 42,
    marginHorizontal: 18,
    marginBottom: 6,
    borderRadius: 10,
    backgroundColor: '#F3F6FA',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    gap: 8,
  },
  searchGlyph: {
    fontSize: 20,
    color: '#606885',
  },
  searchInput: {
    flex: 1,
    color: '#000000',
    fontSize: 14,
    paddingVertical: 0,
  },
  listContent: {
    paddingHorizontal: 18,
    paddingBottom: 30,
    flexGrow: 1,
  },
  dateHeader: {
    fontSize: 11,
    lineHeight: 15,
    color: '#606885',
    fontWeight: '700',
    paddingTop: 10,
    paddingBottom: 5,
    backgroundColor: '#FFFFFF',
  },
  activityRow: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  operationIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E7EAF0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  operationIncoming: {
    backgroundColor: 'rgba(0, 202, 138, 0.10)',
  },
  operationOutgoing: {
    backgroundColor: 'rgba(255, 91, 91, 0.09)',
  },
  operationNeutral: {
    backgroundColor: '#F3F6FA',
  },
  operationGlyph: {
    fontSize: 19,
    lineHeight: 22,
    color: '#181D41',
    fontWeight: '800',
  },
  activityIdentity: {
    flex: 1,
    paddingRight: 8,
  },
  activityTitle: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '800',
    color: '#000000',
  },
  activitySecondary: {
    fontSize: 11,
    lineHeight: 14,
    color: '#606885',
    fontWeight: '600',
  },
  activityTime: {
    fontSize: 10,
    lineHeight: 13,
    color: '#ACB1C1',
  },
  activityAmount: {
    maxWidth: '38%',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '700',
    color: '#181D41',
    textAlign: 'right',
    fontVariant: ['tabular-nums'],
  },
  amountIncoming: {
    color: '#00B279',
  },
  amountOutgoing: {
    color: '#FF5B5B',
  },
  statePanel: {
    minHeight: 280,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    gap: 9,
  },
  emptyIcon: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3F6FA',
  },
  emptyGlyph: {
    fontSize: 28,
    color: '#ACB1C1',
  },
  stateTitle: {
    fontSize: 17,
    lineHeight: 21,
    fontWeight: '800',
    color: '#000000',
    textAlign: 'center',
  },
  stateMessage: {
    fontSize: 12,
    lineHeight: 17,
    color: '#606885',
    textAlign: 'center',
  },
  stateAction: {
    paddingHorizontal: 15,
    paddingVertical: 8,
  },
  stateActionText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#00B279',
  },
  loadMoreButton: {
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadMoreText: {
    fontSize: 12,
    color: '#00B279',
    fontWeight: '700',
  },
  loadMoreError: {
    fontSize: 11,
    lineHeight: 15,
    color: '#FF5B5B',
    textAlign: 'center',
    paddingVertical: 8,
  },
  pressed: {
    opacity: 0.68,
  },
});
