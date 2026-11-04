import React, { useEffect, useState } from 'react';
import { Pressable, Text } from 'react-native';
import { AccountIdentityCard } from '@ui/components';
import { IdentityAvatar } from '@ui/components/IdentityAvatar';

import { NativeButton } from '@ui/components/NativeButton';
import { NativeField } from '@ui/components/NativeField';

import type { AccountRecord } from '../../../capabilities/account/types';
import type { HistoryProductDependencies } from '../../../capabilities/history/HistoryCacheHydration';
import { loadHistoryPage } from '../../../capabilities/history/loadHistoryPage';
import type { HistoryEntry } from '../../../capabilities/history/types';
import { HISTORY_CACHE_SCHEMA_VERSION } from '../../../capabilities/history/HistoryCacheRepository';
import { createLocalization } from '../../../locale/localization';
import { defaultTheme } from '../../../ui/theme';
import { ActivityContent, ActivityRow, ActivityScreen, StatePanel } from '../ActivityScreen';
import { createActivityReadyState, createCachedActivityReadyState, failActivityRefresh } from '../activityReadModel';
import { createStyles } from '../styles';

jest.mock('@fresnica/ui-native', () => ({
  Field: () => null,
  Button: () => null,
}));

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
  autoCapitalize?: string;
  autoCorrect?: boolean;
  children?: React.ReactNode;
  label?: string;
  size?: string;
  variant?: string;
  value?: string;
  entries?: readonly HistoryEntry[];
  state?: unknown;
  entry?: HistoryEntry;
  source?: string;
  message?: string;
  onChangeText?: (value: string) => void;
  onPress?: () => void;
  title?: string;
  name?: string;
  secondary?: string;
  identity?: string;
  asset?: { kind: string };
  small?: boolean;
  native?: boolean;
  timeFormatter?: Intl.DateTimeFormat;
  onOpen?: () => void;
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

function renderScreen(
  entries: readonly HistoryEntry[],
  filter = 'all',
  searchText = '',
  identityNames?: ReadonlyMap<string, string>,
  showTechnical = true,
  hiddenAssets: ReadonlySet<string> = new Set(),
  showHiddenAssets = false,
  managingAssets = false,
  selectedAccount: AccountRecord = account,
) {
  const setters = Array.from({ length: 8 }, () => jest.fn());
  const values = [
    { kind: 'ready' as const, ...createActivityReadyState({ entries, nextCursor: 'cursor-1' }) },
    filter,
    searchText,
    false,
    showTechnical,
    hiddenAssets,
    showHiddenAssets,
    managingAssets,
  ];
  let call = 0;
  mockedUseState.mockImplementation((initial: unknown) => {
    const index = call;
    call += 1;
    return [values[index] ?? initial, setters[index]];
  });

  return {
    root: ActivityScreen({
      account: selectedAccount,
      identityNames,
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
    const search = findElement(root, element => element.type === NativeField);
    const trustlines = findElement(root, element => element.props.accessibilityLabel === 'Trustlines');

    expect(search?.props).toMatchObject({
      accessibilityLabel: 'Search activity',
      accessibilityHint: 'Search only the activity currently loaded on this device.',
      autoCapitalize: 'none',
      autoCorrect: false,
      label: 'Search activity',
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
    const retry = findElement(panel, element => element.type === NativeButton);

    expect(retry?.props).toMatchObject({ label: 'Try again', size: 'sm', variant: 'secondary' });
    retry?.props.onPress?.();
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it('keeps a retry action while stale cached history remains visible', () => {
    const localization = createLocalization('en');
    const onRetry = jest.fn();
    const entry = trustline('cached-1');
    const cached = createCachedActivityReadyState({
      schemaVersion: HISTORY_CACHE_SCHEMA_VERSION,
      entries: [entry],
      lastSuccessfulHorizonUpdateAt: now,
      details: [],
    });
    const failed = { kind: 'ready' as const, ...failActivityRefresh(cached) };
    const root = ActivityContent({
      state: failed,
      entries: [entry],
      onRetry,
      onLoadMore: jest.fn(),
      onOpenOperation: jest.fn(),
      t: localization.t,
      formatNumber: localization.formatNumber,
      dateFormatter: new Intl.DateTimeFormat('en-US'),
      timeFormatter: new Intl.DateTimeFormat('en-US', { hour: '2-digit', minute: '2-digit' }),
      indicatorColor: defaultTheme.colors.actionPrimaryPressed,
      styles: createStyles(defaultTheme),
    });
    const retry = findElement(root, element => element.type === NativeButton);

    expect(retry?.props).toMatchObject({ label: localization.t('activity.retry'), variant: 'secondary' });
    expect(findElement(root, element => element.props.source === 'cache')).toBeDefined();
    expect(findElement(root, element => element.props.entry?.id === 'cached-1')).toBeDefined();
    retry?.props.onPress?.();
    expect(onRetry).toHaveBeenCalledTimes(1);
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

function textValues(root: React.ReactNode): string[] {
  const values: string[] = [];
  visit(root, element => {
    if (element.type === Text) values.push(React.Children.toArray(element.props.children).join(''));
  });
  return values;
}
const rowProps = () => ({
  formatNumber: createLocalization('en').formatNumber,
  t: createLocalization('en').t,
  timeFormatter: new Intl.DateTimeFormat('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZone: 'UTC',
  }),
  styles: createStyles(defaultTheme),
  onOpen: jest.fn(),
});
const payment: HistoryEntry = {
  ...unsupported('payment'),
  kind: 'payment',
  operationType: 'payment',
  direction: 'incoming',
  amount: '12.3456789',
  asset: { kind: 'native', code: 'XLM' },
  counterparty: 'GCOUNTERPARTY',
  occurredAt: '2026-09-21T12:34:56Z',
  participants: [
    { role: 'sender', identity: 'GCOUNTERPARTY' },
    { role: 'recipient', identity: 'GACCOUNT-A' },
  ],
};
it('renders account subject, operation with local seconds, and separate amount/asset under one accessible action', () => {
  const props = rowProps();
  const root = ActivityRow({ ...props, entry: payment, identityNames: new Map([['GCOUNTERPARTY', 'Alice']]) });
  const card = findElement(root, element => element.type === AccountIdentityCard);
  expect(card?.props.name).toBe('Alice');
  expect(card?.props.secondary).toBe(`Received · ${props.timeFormatter.format(new Date(payment.occurredAt))}`);
  expect(textValues(root)).toEqual(['+12.3456789', 'XLM']);
  const avatar = findElement(root, element => element.type === IdentityAvatar);
  expect(avatar?.props).toMatchObject({ small: true, native: true });
  expect(root.props.accessibilityLabel).toContain('Alice');
  expect(root.props.accessibilityLabel).toContain('12:34:56');
  root.props.onPress?.();
  expect(props.onOpen).toHaveBeenCalledTimes(1);
});
it('shows trustline asset and removal text without a monetary column, and leaves unsupported rows navigable', () => {
  const props = rowProps();
  const trust = trustline('trust');
  const removed = { ...trust, limit: '0.0000000' } as HistoryEntry;
  const root = ActivityRow({ ...props, entry: removed });
  expect(textValues(root)).toEqual(['USD', expect.stringContaining('Trustline removed · ')]);
  expect(findElement(root, element => element.type === AccountIdentityCard)).toBeUndefined();
  const unknown = ActivityRow({ ...props, entry: unsupported('unknown') });
  expect(textValues(unknown)).toEqual([
    '•',
    'Operation: future_operation',
    expect.stringContaining('This operation is recorded'),
  ]);
  unknown.props.onPress?.();
  expect(props.onOpen).toHaveBeenCalledTimes(1);
});
it('updates local-name search without history I/O and uses seconds in the screen formatter', () => {
  const names = new Map([['GCOUNTERPARTY', 'Alice']]);
  let root = renderScreen([payment], 'all', 'Alice', names).root;
  expect(findElement(root, element => element.type === ActivityContent)?.props.entries).toEqual([payment]);
  names.set('GCOUNTERPARTY', 'Bob');
  root = renderScreen([payment], 'all', 'Alice', names).root;
  expect(findElement(root, element => element.type === ActivityContent)?.props.entries).toEqual([]);
  expect(
    findElement(root, element => element.type === ActivityContent)?.props.timeFormatter?.resolvedOptions().second,
  ).toBe('2-digit');
  expect(mockedLoadHistoryPage).not.toHaveBeenCalled();
});
it('keeps concrete calendar dates and opens the exact operation ID from the rendered list row', () => {
  const localization = createLocalization('en');
  const onOpenOperation = jest.fn();
  const formatter = new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  });
  const root = ActivityContent({
    ...rowProps(),
    state: { kind: 'ready', ...createActivityReadyState({ entries: [payment] }) },
    entries: [payment],
    onRetry: jest.fn(),
    onLoadMore: jest.fn(),
    onOpenOperation,
    dateFormatter: formatter,
    indicatorColor: defaultTheme.colors.actionPrimaryPressed,
    t: localization.t,
  });
  expect(textValues(root)).toContain('September 21, 2026');
  findElement(root, element => element.type === ActivityRow)?.props.onOpen?.();
  expect(onOpenOperation).toHaveBeenCalledWith('payment');
});
it('renders a Swap pair with the actual destination leg and retains exact path navigation', () => {
  const path: HistoryEntry = {
    ...unsupported('path-700'),
    kind: 'path-payment',
    successful: true,
    operationType: 'path_payment_strict_send',
    direction: 'self',
    sourceAmount: '5.1234567',
    sourceAsset: { kind: 'native', code: 'XLM' },
    destinationAmount: '7.7654321',
    destinationAsset: { kind: 'credit', code: 'USD', issuer: 'GISSUER' },
    counterparty: 'GACCOUNT-A',
    participants: [
      { role: 'sender', identity: 'GACCOUNT-A' },
      { role: 'recipient', identity: 'GACCOUNT-A' },
    ],
  };
  const props = rowProps();
  const row = ActivityRow({ ...props, entry: path });
  expect(textValues(row)).toContain('+7.7654321');
  expect(textValues(row)).toContain('USD');
  expect(textValues(row)).toContain('Swap');
  expect(findElement(row, element => element.type === IdentityAvatar)?.props.identity).toContain('GISSUER');
  row.props.onPress?.();
  expect(props.onOpen).toHaveBeenCalledTimes(1);
  const onOpenOperation = jest.fn();
  const content = ActivityContent({
    ...props,
    state: { kind: 'ready', ...createActivityReadyState({ entries: [path] }) },
    entries: [path],
    onRetry: jest.fn(),
    onLoadMore: jest.fn(),
    onOpenOperation,
    dateFormatter: new Intl.DateTimeFormat('en-US'),
    indicatorColor: defaultTheme.colors.actionPrimaryPressed,
  });
  findElement(content, element => element.type === ActivityRow)?.props.onOpen?.();
  expect(onOpenOperation).toHaveBeenCalledWith('path-700');
});

it.each(['manage_buy_offer', 'manage_sell_offer', 'create_passive_sell_offer'])(
  'renders %s as a pair with no monetary column',
  operationType => {
    const entry: HistoryEntry = {
      ...unsupported('offer'),
      kind: 'offer',
      successful: true,
      operationType,
      buyingAsset: { kind: 'credit', code: 'USD', issuer: 'GISSUER' },
      sellingAsset: { kind: 'native', code: 'XLM' },
      amount: '999999.9999999',
      price: { n: 1, d: 2 },
      offerId: '0',
      cancellation: false,
    };
    const props = rowProps();
    const row = ActivityRow({ ...props, entry });
    expect(textValues(row)).toContain('XLM → USD');
    expect(textValues(row).join(' ')).not.toContain(entry.amount);
    expect(findElement(row, element => element.type === IdentityAvatar)?.props.identity).toContain('GISSUER');
    row.props.onPress?.();
    expect(props.onOpen).toHaveBeenCalledTimes(1);
  },
);
it.each(['liquidity_pool_deposit', 'liquidity_pool_withdraw'])(
  'renders both separately signed actual %s legs in its accessible row',
  operationType => {
    const entry: HistoryEntry = {
      ...unsupported('pool'),
      kind: 'liquidity-pool',
      successful: true,
      operationType,
      poolId: 'a'.repeat(64),
      shares: '7',
      reserves: [
        { asset: { kind: 'native', code: 'XLM' }, amount: '0' },
        { asset: { kind: 'credit', code: 'USD', issuer: 'GISSUER' }, amount: '922337203685.4775807' },
      ],
    };
    const props = rowProps();
    const row = ActivityRow({ ...props, entry });
    const sign = operationType === 'liquidity_pool_deposit' ? '−' : '+';
    expect(textValues(row)).toEqual(
      expect.arrayContaining(['XLM / USD', `${sign}0`, `${sign}922,337,203,685.4775807`, 'XLM', 'USD']),
    );
    expect(row.props.accessibilityLabel).toContain(`${sign}0 XLM`);
    expect(row.props.accessibilityLabel).toContain(`${sign}922,337,203,685.4775807 USD`);
    row.props.onPress?.();
    expect(props.onOpen).toHaveBeenCalledTimes(1);
  },
);

it('hides technical records reversibly without losing loaded rows, cursor or issuing I/O', () => {
  const technical = { ...unsupported('technical'), operationType: 'manage_data' };
  const ordinary = unsupported('ordinary');
  const hidden = renderScreen([technical, ordinary], 'all', '', undefined, false);
  const content = findElement(hidden.root, element => element.type === ActivityContent);
  expect(content?.props.entries?.map(entry => entry.id)).toEqual(['ordinary']);
  const toggle = findElement(
    hidden.root,
    element => element.type === NativeButton && element.props.label === 'Show technical records',
  );
  toggle?.props.onPress?.();
  expect(hidden.setters[4]).toHaveBeenCalled();
  const restored = renderScreen([technical, ordinary], 'all', '', undefined, true);
  expect(findElement(restored.root, element => element.type === ActivityContent)?.props.entries?.length).toBe(2);
  expect(mockedLoadHistoryPage).not.toHaveBeenCalled();
});

it('hides only user-marked issued assets, preserves raw cursor and offers reversible restore', () => {
  const exact = JSON.stringify(['USD', 'GISSUER']);
  const { root, setters } = renderScreen(
    [trustline('hidden-trust'), trustline('other-trust', 'OTHER'), unsupported('unknown')],
    'all',
    '',
    undefined,
    true,
    new Set([exact]),
    false,
    true,
  );
  const content = findElement(root, element => element.type === ActivityContent);
  expect(content?.props.entries?.map(entry => entry.id)).toEqual(['other-trust', 'unknown']);
  expect(content?.props.state).toMatchObject({ kind: 'ready', nextCursor: 'cursor-1' });
  const restore = findElement(root, element => Boolean(element.props.label?.startsWith('Restore USD')));
  expect(restore).toBeDefined();
  restore?.props.onPress?.();
  expect(setters[5]).toHaveBeenCalledWith(expect.any(Function));
  expect(mockedLoadHistoryPage).not.toHaveBeenCalled();
  const revealed = renderScreen([trustline('hidden-trust')], 'all', '', undefined, true, new Set([exact]), true);
  expect(
    findElement(revealed.root, element => element.type === ActivityContent)?.props.entries?.map(entry => entry.id),
  ).toEqual(['hidden-trust']);
});

it('keeps exact local identity icons instead of presenting unavailable remote images', () => {
  const row = ActivityRow({
    ...rowProps(),
    entry: {
      ...unsupported('swap-icons'),
      kind: 'path-payment',
      operationType: 'path_payment_strict_send',
      successful: true,
      direction: 'self',
      sourceAsset: { kind: 'native', code: 'XLM' },
      destinationAsset: { kind: 'credit', code: 'USD', issuer: 'GISSUER' },
      sourceAmount: '1',
      destinationAmount: '2',
      counterparty: 'GACCOUNT-A',
      participants: [
        { role: 'sender', identity: 'GACCOUNT-A' },
        { role: 'recipient', identity: 'GACCOUNT-A' },
      ],
    },
  });
  expect(findElement(row, element => element.type === IdentityAvatar)?.props.identity).toContain('GISSUER');
  expect(row.props.accessibilityLabel).toContain('2');
  const { root } = renderScreen([trustline('example')], 'all', '', undefined, true, new Set(), false, false, {
    ...account,
    networkId: 'stellar-mainnet',
  });
  expect(findElement(root, element => element.props.label?.includes('public asset images') === true)).toBeUndefined();
  expect(mockedLoadHistoryPage).not.toHaveBeenCalled();
});
