import React, { useEffect, useState } from 'react';
import { Pressable, TextInput } from 'react-native';

import type { AccountRecord } from '../../../capabilities/account/types';
import type { HistoryProductDependencies } from '../../../capabilities/history/HistoryCacheHydration';
import { loadHistoryPage } from '../../../capabilities/history/loadHistoryPage';
import type { HistoryEntry } from '../../../capabilities/history/types';
import { createLocalization } from '../../../locale/localization';
import { defaultTheme } from '../../../ui/theme';
import { ActivityContent, ActivityScreen, StatePanel } from '../ActivityScreen';
import { createActivityReadyState } from '../activityReadModel';
import { createStyles } from '../styles';

jest.mock('react', () => {
  const actual = jest.requireActual('react') as typeof import('react');
  return {
    ...actual,
    useCallback: (callback: unknown) => callback,
    useEffect: jest.fn(),
    useMemo: (factory: () => unknown) => factory(),
    useRef: (initial: unknown) => ({ current: initial }),
    useState: jest.fn(),
  };
});
jest.mock('../../../ui/theme', () => {
  const actual = jest.requireActual('../../../ui/theme') as typeof import('../../../ui/theme');
  return {
    ...actual,
    useAppTheme: () => actual.defaultTheme,
    useThemedStyles: (factory: (theme: typeof actual.defaultTheme) => unknown) => factory(actual.defaultTheme),
  };
});

jest.mock('../../../locale', () => {
  const actual = jest.requireActual('../../../locale/localization') as typeof import('../../../locale/localization');
  return {
    useLocalization: () => actual.createLocalization('en'),
  };
});

jest.mock('../../../capabilities/history/loadHistoryPage', () => ({
  loadHistoryPage: jest.fn(),
}));

const mockedUseState = useState as unknown as jest.Mock;
const mockedUseEffect = useEffect as unknown as jest.Mock;
const mockedLoadHistoryPage = loadHistoryPage as jest.MockedFunction<typeof loadHistoryPage>;
const now = new Date('2026-09-21T00:00:00.000Z');
const account: AccountRecord = {
  id: 'account-a',
  address: 'GACCOUNT-A',
  identityKind: 'classic',
  networkId: 'stellar-testnet',
  label: 'Primary',
  sortOrder: 0,
  hidden: false,
  createdAt: now,
  updatedAt: now,
};
const dependencies = {
  now: () => now,
} as unknown as HistoryProductDependencies;

function unsupported(id: string): HistoryEntry {
  return {
    id,
    pagingToken: id,
    operationType: 'future_operation',
    occurredAt: '2026-09-21T00:00:00Z',
    transactionHash: `tx-${id}`,
    sourceAccount: 'GSOURCE',
    kind: 'unsupported',
    reason: 'operation-type',
  };
}
function trustline(id: string, code = 'USD'): HistoryEntry {
  return {
    id,
    pagingToken: id,
    operationType: 'change_trust',
    occurredAt: '2026-09-21T00:00:00Z',
    transactionHash: `tx-${id}`,
    sourceAccount: 'GTRUSTOR',
    kind: 'change-trust',
    asset: { kind: 'credit', code, issuer: 'GISSUER' },
    limit: '100.0000000',
    participants: [
      { role: 'trustor', identity: 'GTRUSTOR' },
      { role: 'issuer', identity: 'GISSUER' },
    ],
  };
}

type NodeProps = Readonly<{
  accessibilityHint?: string;
  accessibilityLabel?: string;
  accessibilityRole?: string;
  accessibilityState?: Readonly<{ selected?: boolean }>;
  children?: React.ReactNode;
  entries?: readonly HistoryEntry[];
  message?: string;
  onChangeText?: (value: string) => void;
  onPress?: () => void;
  title?: string;
}>;

function visit(node: React.ReactNode, callback: (element: React.ReactElement<NodeProps>) => void): void {
  if (!React.isValidElement<NodeProps>(node)) return;
  callback(node);
  React.Children.forEach(node.props.children, child => visit(child, callback));
}

function findElement(
  root: React.ReactNode,
  predicate: (element: React.ReactElement<NodeProps>) => boolean,
): React.ReactElement<NodeProps> | undefined {
  let match: React.ReactElement<NodeProps> | undefined;
  visit(root, element => {
    if (!match && predicate(element)) match = element;
  });
  return match;
}

function renderScreen(entries: readonly HistoryEntry[], filter = 'all', searchText = '') {
  const setters = [jest.fn(), jest.fn(), jest.fn()];
  const values = [
    { kind: 'ready' as const, ...createActivityReadyState({ entries, nextCursor: 'cursor-1' }) },
    filter,
    searchText,
  ];
  let call = 0;
  mockedUseState.mockImplementation((initial: unknown) => {
    const index = call;
    call += 1;
    return [values[index] ?? initial, setters[index]];
  });

  return {
    root: ActivityScreen({
      account,
      dependencies,
      active: true,
      onOpenOperation: jest.fn(),
      onManualRefresh: jest.fn(async () => undefined),
      invalidationRevision: 0,
    }),
    setters,
  };
}

describe('ActivityScreen filter/search closure', () => {
  beforeEach(() => {
    mockedUseState.mockReset();
    mockedUseEffect.mockReset();
    mockedLoadHistoryPage.mockReset();
  });
  it('exposes accessible search and trustline controls without triggering history I/O', () => {
    const { root, setters } = renderScreen([trustline('trustline-1'), unsupported('other-1')]);
    const search = findElement(root, element => element.type === TextInput);
    const trustlines = findElement(root, element => element.props.accessibilityLabel === 'Trustlines');

    expect(search?.props).toMatchObject({
      accessibilityLabel: 'Search activity',
      accessibilityHint: 'Search only the activity currently loaded on this device.',
    });
    expect(trustlines?.type).toBe(Pressable);
    expect(trustlines?.props).toMatchObject({
      accessibilityRole: 'button',
      accessibilityState: { selected: false },
    });

    search?.props.onChangeText?.('GISSUER');
    trustlines?.props.onPress?.();

    expect(setters[2]).toHaveBeenCalledWith('GISSUER');
    expect(setters[1]).toHaveBeenCalledWith('trustlines');
    expect(mockedLoadHistoryPage).not.toHaveBeenCalled();
  });

  it('filters only the loaded set by the same search and filter state', () => {
    const { root } = renderScreen(
      [trustline('trustline-1', 'USD'), trustline('trustline-2', 'EUR'), unsupported('other-1')],
      'trustlines',
      'usd',
    );
    const content = findElement(root, element => element.type === ActivityContent);

    expect(content?.props.entries?.map(entry => entry.id)).toEqual(['trustline-1']);
  });

  it('resets query state only for account/network partition changes', () => {
    const { setters } = renderScreen([trustline('trustline-1')], 'trustlines', 'usd');
    const resetEffect = mockedUseEffect.mock.calls.find(
      ([, effectDeps]) =>
        Array.isArray(effectDeps) &&
        effectDeps.length === 2 &&
        effectDeps[0] === account.address &&
        effectDeps[1] === account.networkId,
    );

    expect(resetEffect?.[1]).toEqual([account.address, account.networkId]);
    resetEffect?.[0]();

    expect(setters[1]).toHaveBeenCalledWith('all');
    expect(setters[2]).toHaveBeenCalledWith('');
  });

  it('exposes retry actions as independently accessible buttons', () => {
    const onAction = jest.fn();
    const panel = StatePanel({
      title: 'Unable to load activity',
      message: 'Activity could not be loaded.',
      action: 'Try again',
      onAction,
      indicatorColor: defaultTheme.colors.actionPrimaryPressed,
      styles: createStyles(defaultTheme),
    });
    const retry = findElement(panel, element => element.props.accessibilityLabel === 'Try again');

    expect(retry?.type).toBe(Pressable);
    expect(retry?.props.accessibilityRole).toBe('button');
    retry?.props.onPress?.();
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it('distinguishes no-match from empty history and preserves manual load-more', () => {
    const localization = createLocalization('en');
    const styles = createStyles(defaultTheme);
    const onLoadMore = jest.fn();
    const ready = {
      kind: 'ready' as const,
      ...createActivityReadyState({
        entries: [unsupported('loaded-1')],
        nextCursor: 'cursor-1',
      }),
    };
    const common = {
      onRetry: jest.fn(),
      onLoadMore,
      onOpenOperation: jest.fn(),
      t: localization.t,
      formatNumber: localization.formatNumber,
      dateFormatter: new Intl.DateTimeFormat('en-US'),
      timeFormatter: new Intl.DateTimeFormat('en-US', { hour: '2-digit', minute: '2-digit' }),
      indicatorColor: defaultTheme.colors.actionPrimaryPressed,
      styles,
    };
    const noMatch = ActivityContent({ ...common, state: ready, entries: [] });
    const noMatchPanel = findElement(noMatch, element => element.props.title === 'No activity found');
    const loadOlder = findElement(noMatch, element => element.props.accessibilityLabel === 'Load older activity');

    expect(noMatchPanel?.props.message).toBe('No activity matches the current search and filters.');
    expect(loadOlder?.props.accessibilityRole).toBe('button');
    loadOlder?.props.onPress?.();
    expect(onLoadMore).toHaveBeenCalledTimes(1);

    const empty = ActivityContent({
      ...common,
      state: { kind: 'ready', ...createActivityReadyState({ entries: [] }) },
      entries: [],
    });
    expect(findElement(empty, element => element.props.title === 'No activity yet')).toBeDefined();
    expect(findElement(empty, element => element.props.title === 'No activity found')).toBeUndefined();
  });
});
