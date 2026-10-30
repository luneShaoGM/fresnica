import React from 'react';
import { RefreshControl } from 'react-native';
import { Button } from '@ui/components';
import { HomeScreen } from '../HomeScreen';
import { InactiveAccountPanel } from '../components/InactiveAccountPanel';
import { BalanceFreshnessNotice } from '../components/BalanceFreshnessNotice';
import type { AccountRecord } from '@capabilities/account/types';
import type { StellarAccountBalanceResult } from '@capabilities/stellar/types';
import { InMemoryBalanceCacheRepository } from '../../../platform/persistence/memory/InMemoryBalanceCacheRepository';
import {
  balancePartition,
  balanceSnapshot,
} from '../../../platform/persistence/__tests__/balanceCacheRepositoryContract';
import { useBalanceDisplay } from '../useBalanceDisplay';

type Slot = { value?: unknown; deps?: readonly unknown[]; cleanup?: () => void };
let mockSlots: Slot[] = [];
let mockCursor = 0;
let mockEffects: Array<() => void> = [];
const mockSameDeps = (a: readonly unknown[] | undefined, b: readonly unknown[]) =>
  a !== undefined && a.length === b.length && a.every((value, i) => Object.is(value, b[i]));
jest.mock('react', () => ({
  ...jest.requireActual('react'),
  useMemo: (factory: () => unknown) => factory(),
  useState: (initial: unknown) => {
    const index = mockCursor++;
    if (!mockSlots[index]) mockSlots[index] = { value: initial };
    return [
      mockSlots[index].value,
      (next: unknown) => {
        mockSlots[index].value = typeof next === 'function' ? next(mockSlots[index].value) : next;
      },
    ];
  },
  useRef: (value: unknown) => {
    const index = mockCursor++;
    if (!mockSlots[index]) mockSlots[index] = { value: { current: value } };
    return mockSlots[index].value;
  },
  useCallback: (callback: unknown, deps: readonly unknown[]) => {
    const index = mockCursor++;
    if (!mockSameDeps(mockSlots[index]?.deps, deps)) mockSlots[index] = { value: callback, deps };
    return mockSlots[index].value;
  },
  useEffect: (effect: () => (() => void) | undefined, deps: readonly unknown[]) => {
    const index = mockCursor++;
    if (mockSameDeps(mockSlots[index]?.deps, deps)) return;
    const previous = mockSlots[index]?.cleanup;
    mockSlots[index] = { deps };
    mockEffects.push(() => {
      previous?.();
      mockSlots[index].cleanup = effect();
    });
  },
}));

jest.mock('@fresnica/ui-native', () => ({ StateView: () => null, Button: () => null }));

jest.mock('@ui/theme', () => {
  const actual = jest.requireActual('@ui/theme') as typeof import('@ui/theme');
  return {
    ...actual,
    useAppTheme: () => actual.defaultTheme,
    useThemedStyles: (factory: (theme: typeof actual.defaultTheme) => unknown) => factory(actual.defaultTheme),
  };
});
jest.mock('../../../locale', () => ({ useLocalization: () => ({ t: (key: string) => key }) }));

const accountA: AccountRecord = {
  id: 'a',
  networkId: 'stellar-testnet',
  address: 'GA',
  identityKind: 'classic',
  label: 'A',
  sortOrder: 0,
  hidden: false,
  createdAt: new Date(0),
  updatedAt: new Date(0),
};
const active = (address = 'GA'): StellarAccountBalanceResult => ({
  status: 'active',
  address,
  balances: [{ kind: 'native', balance: '2.0000000' }],
});
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => {
    resolve = done;
  });
  return { promise, resolve };
}
async function settle() {
  for (let i = 0; i < 12; i++) await Promise.resolve();
}
function setup(silentInactiveRevalidation = false) {
  const cache = new InMemoryBalanceCacheRepository();
  const gateway = { loadAccountBalances: jest.fn(async (address: string) => active(address)) };
  const deps = { cache, gateway, networkId: 'stellar-testnet', now: () => new Date('2026-10-26T01:00:00Z') };
  const useRender = (account = accountA, activeScreen = true, revision = 0) => {
    mockCursor = 0;
    return useBalanceDisplay(account, deps, activeScreen, revision, silentInactiveRevalidation);
  };
  const effects = () => {
    const pending = mockEffects;
    mockEffects = [];
    pending.forEach(effect => effect());
  };
  const dispose = () => mockSlots.forEach(slot => slot.cleanup?.());
  return { cache, gateway, deps, render: useRender, effects, dispose };
}

beforeEach(() => {
  mockSlots = [];
  mockCursor = 0;
  mockEffects = [];
});
describe('Balance display product lifecycle', () => {
  it('restores cache while loading and replaces it only with an accepted live snapshot', async () => {
    const current = setup();
    const response = deferred<StellarAccountBalanceResult>();
    current.cache.replaceSnapshot(balancePartition, balanceSnapshot());
    current.gateway.loadAccountBalances.mockReturnValueOnce(response.promise);
    current.render();
    current.effects();
    expect(current.render().state).toMatchObject({
      kind: 'ready',
      stale: true,
      refreshing: true,
      snapshot: balanceSnapshot().balance,
    });
    await settle();
    response.resolve(active());
    await settle();
    expect(current.render().state).toMatchObject({
      kind: 'ready',
      stale: false,
      refreshing: false,
      refreshFailed: false,
    });
    expect(current.cache.getSnapshot(balancePartition)?.balance).toMatchObject({
      balances: [{ balance: '2.0000000' }],
    });
  });
  it('retains previous data/time on refresh failure, then retries through the same live loader', async () => {
    const current = setup();
    current.cache.replaceSnapshot(balancePartition, balanceSnapshot());
    current.gateway.loadAccountBalances.mockRejectedValueOnce(new Error('offline'));
    current.render();
    current.effects();
    await settle();
    const failed = current.render();
    expect(failed.state).toMatchObject({
      kind: 'ready',
      stale: true,
      refreshFailed: true,
      lastSuccessfulUpdateAt: balanceSnapshot().lastSuccessfulUpdateAt,
      snapshot: balanceSnapshot().balance,
    });
    failed.refresh();
    await settle();
    expect(current.render().state).toMatchObject({ kind: 'ready', stale: false, refreshFailed: false });
    expect(current.gateway.loadAccountBalances).toHaveBeenCalledTimes(2);
  });
  it('shows an error when no matching successful snapshot exists', async () => {
    const current = setup();
    current.gateway.loadAccountBalances.mockRejectedValueOnce(new Error('offline'));
    current.render();
    current.effects();
    await settle();
    expect(current.render().state).toMatchObject({ kind: 'error' });
    expect(current.cache.getSnapshot(balancePartition)).toBeUndefined();
  });
  it('does not present or write a previous account response after switching accounts', async () => {
    const current = setup();
    current.cache.replaceSnapshot(balancePartition, balanceSnapshot());
    const old = deferred<StellarAccountBalanceResult>();
    current.gateway.loadAccountBalances.mockReturnValueOnce(old.promise);
    current.render();
    current.effects();
    await settle();
    const accountB = { ...accountA, id: 'b', address: 'GB' };
    expect(current.render(accountB).state).toEqual({ kind: 'loading' });
    current.effects();
    await settle();
    old.resolve(active());
    await settle();
    expect(current.render(accountB).state).toMatchObject({ kind: 'ready', snapshot: { address: 'GB' } });
    expect(current.cache.getSnapshot(balancePartition)).toEqual(balanceSnapshot());
  });
  it('does not write after disposal or restart from a retained callback', async () => {
    const current = setup();
    const response = deferred<StellarAccountBalanceResult>();
    current.gateway.loadAccountBalances.mockReturnValueOnce(response.promise);
    const screen = current.render();
    current.effects();
    await settle();
    current.dispose();
    response.resolve(active());
    await settle();
    screen.refresh();
    await settle();
    expect(current.cache.getSnapshot(balancePartition)).toBeUndefined();
    expect(current.gateway.loadAccountBalances).toHaveBeenCalledTimes(1);
  });
  it('keeps a successful online result when cache writing fails', async () => {
    const current = setup();
    current.cache.replaceSnapshot = () => {
      throw new Error('disk-full');
    };
    current.render();
    current.effects();
    await settle();
    expect(current.render().state).toMatchObject({ kind: 'ready', stale: false, snapshot: { status: 'active' } });
  });
  it('replaces a previously active cache with an authoritative inactive result', async () => {
    const current = setup();
    current.cache.replaceSnapshot(balancePartition, balanceSnapshot());
    current.gateway.loadAccountBalances.mockResolvedValueOnce({ status: 'inactive', address: 'GA' });
    current.render();
    current.effects();
    await settle();
    expect(current.render().state).toMatchObject({ kind: 'ready', stale: false, snapshot: { status: 'inactive' } });
    expect(current.cache.getSnapshot(balancePartition)?.balance).toEqual({ status: 'inactive', address: 'GA' });
  });
  it('marks a successful display stale when invalidated and rejects the older pending refresh', async () => {
    const current = setup();
    current.render();
    current.effects();
    await settle();
    const response = deferred<StellarAccountBalanceResult>();
    current.gateway.loadAccountBalances.mockReturnValueOnce(response.promise);
    current.render(accountA, true, 1);
    current.effects();
    await settle();
    expect(current.render(accountA, true, 1).state).toMatchObject({ kind: 'ready', stale: true, refreshing: true });
    current.render(accountA, true, 2);
    current.effects();
    await settle();
    response.resolve({ status: 'inactive', address: 'GA' });
    await settle();
    expect(current.render(accountA, true, 2).state).toMatchObject({
      kind: 'ready',
      stale: false,
      snapshot: { status: 'active' },
    });
  });
});

type ElementProps = {
  children?: React.ReactNode;
  refreshControl?: React.ReactNode;
  label?: string;
  disabled?: boolean;
  refreshing?: boolean;
  onPress?: () => void | Promise<void>;
};
function elements(node: React.ReactNode): React.ReactElement<ElementProps>[] {
  if (!React.isValidElement<ElementProps>(node)) return [];
  return [node, ...React.Children.toArray(node.props.children).flatMap(elements)];
}
function homeFrame(current: ReturnType<typeof setup>, revision = 0) {
  mockCursor = 0;
  const fundAccount = jest.fn();
  const root = HomeScreen({
    account: accountA,
    accountCount: 1,
    selectableAccounts: [accountA],
    balanceDependencies: current.deps,
    friendbotDependencies: { networkId: 'stellar-testnet', gateway: { fundAccount } },
    canSign: true,
    onSelectAccount: jest.fn(),
    onAddAccount: jest.fn(),
    onSend: jest.fn(),
    onManageAssets: jest.fn(),
    onOpenAsset: jest.fn(),
    onManualRefresh: async () => undefined,
    invalidationRevision: revision,
    active: true,
  });
  const panel = elements(root).find(node => node.type === InactiveAccountPanel);
  const content = panel ? InactiveAccountPanel(panel.props as React.ComponentProps<typeof InactiveAccountPanel>) : null;
  const controls = elements(root).flatMap(node => elements(node.props.refreshControl));
  return {
    fundAccount,
    state: mockSlots[0].value,
    buttons: elements(content).filter(node => node.type === Button),
    text: JSON.stringify(content),
    notice: elements(root).find(node => node.type === BalanceFreshnessNotice),
    refreshing: controls.find(node => node.type === RefreshControl)?.props.refreshing,
  };
}

it('keeps the real Home Friendbot button mounted through background revalidation, failure and retry', async () => {
  const current = setup();
  current.gateway.loadAccountBalances.mockResolvedValue({ status: 'inactive', address: 'GA' });
  homeFrame(current);
  current.effects();
  await settle();
  const ready = homeFrame(current);
  expect(ready.buttons.map(button => button.props.label)).toContain('home.friendbot.action');
  expect(ready.buttons[0].props.disabled).toBe(false);
  const response = deferred<StellarAccountBalanceResult>();
  current.gateway.loadAccountBalances.mockReturnValueOnce(response.promise);
  homeFrame(current, 1);
  current.effects();
  await settle();
  const checking = homeFrame(current, 1);
  expect(checking.buttons.map(button => button.props.label)).toEqual(ready.buttons.map(button => button.props.label));
  expect(checking.text).toEqual(ready.text);
  expect(mockSlots[0].value).toBe(ready.state);
  expect(checking.refreshing).toBe(false);
  expect(checking.notice).toBeUndefined();
  response.resolve({ status: 'inactive', address: 'GA' });
  await settle();
  expect(homeFrame(current, 1).text).toEqual(ready.text);
  expect(homeFrame(current, 1).state).toBe(ready.state);
  current.gateway.loadAccountBalances.mockRejectedValueOnce(new Error('offline'));
  homeFrame(current, 2);
  current.effects();
  await settle();
  const failed = homeFrame(current, 2);
  expect(failed.buttons.map(button => button.props.label)).toEqual(ready.buttons.map(button => button.props.label));
  expect(failed.buttons[0].props.disabled).toBe(true);
  expect(failed.notice).toBeDefined();
  const retry = deferred<StellarAccountBalanceResult>();
  current.gateway.loadAccountBalances.mockReturnValueOnce(retry.promise);
  homeFrame(current, 3);
  current.effects();
  await settle();
  expect(homeFrame(current, 3).notice).toBeDefined();
  retry.resolve({ status: 'inactive', address: 'GA' });
  await settle();
  expect(homeFrame(current, 3).notice).toBeUndefined();
  expect(homeFrame(current, 3).text).toEqual(ready.text);
});

it('keeps the identical inactive display state across repeated checks while tracking freshness separately', async () => {
  const current = setup(true);
  current.gateway.loadAccountBalances.mockResolvedValue({ status: 'inactive', address: 'GA' });
  current.render();
  current.effects();
  await settle();
  const ready = current.render();
  expect(ready.hasFreshInactiveSnapshot()).toBe(true);
  for (let revision = 1; revision <= 3; revision++) {
    const pending = deferred<StellarAccountBalanceResult>();
    current.gateway.loadAccountBalances.mockReturnValueOnce(pending.promise);
    current.render(accountA, true, revision);
    current.effects();
    await settle();
    const checking = current.render(accountA, true, revision);
    expect(checking.state).toBe(ready.state);
    expect(checking.hasFreshInactiveSnapshot()).toBe(false);
    pending.resolve({ status: 'inactive', address: 'GA' });
    await settle();
    expect(current.render(accountA, true, revision).state).toBe(ready.state);
    expect(checking.hasFreshInactiveSnapshot()).toBe(true);
  }
  current.dispose();
  expect(ready.hasFreshInactiveSnapshot()).toBe(false);
});

it('keeps manual refresh visible and publishes activation instead of suppressing new data', async () => {
  const current = setup(true);
  current.gateway.loadAccountBalances.mockResolvedValueOnce({ status: 'inactive', address: 'GA' });
  current.render();
  current.effects();
  await settle();
  const ready = current.render();
  const pending = deferred<StellarAccountBalanceResult>();
  current.gateway.loadAccountBalances.mockReturnValueOnce(pending.promise);
  const refreshing = ready.refresh();
  expect(current.render().state).toMatchObject({ stale: true, refreshing: true });
  expect(ready.hasFreshInactiveSnapshot()).toBe(false);
  pending.resolve(active());
  await refreshing;
  expect(current.render().state).toMatchObject({ stale: false, snapshot: { status: 'active' } });
  expect(ready.hasFreshInactiveSnapshot()).toBe(false);
});

it('does not let inactive verification cross account partitions or trust cache-only inactive data', async () => {
  const current = setup(true);
  current.cache.replaceSnapshot(balancePartition, {
    ...balanceSnapshot(),
    balance: { status: 'inactive', address: 'GA' },
  });
  const pending = deferred<StellarAccountBalanceResult>();
  current.gateway.loadAccountBalances.mockReturnValueOnce(pending.promise);
  current.render();
  current.effects();
  await settle();
  expect(current.render().state).toMatchObject({ stale: true, refreshing: true });
  expect(current.render().hasFreshInactiveSnapshot()).toBe(false);
  pending.resolve({ status: 'inactive', address: 'GA' });
  await settle();
  const ready = current.render();
  const accountB = { ...accountA, id: 'b', address: 'GB' };
  expect(current.render(accountB).hasFreshInactiveSnapshot()).toBe(false);
  current.effects();
  await settle();
  expect(ready.hasFreshInactiveSnapshot()).toBe(false);
});

it('revalidates before funding during a silent check and refuses funding when the account has activated', async () => {
  const current = setup();
  current.gateway.loadAccountBalances.mockResolvedValueOnce({ status: 'inactive', address: 'GA' });
  homeFrame(current);
  current.effects();
  await settle();
  const old = deferred<StellarAccountBalanceResult>();
  current.gateway.loadAccountBalances.mockReturnValueOnce(old.promise);
  homeFrame(current, 1);
  current.effects();
  await settle();
  const checking = homeFrame(current, 1);
  current.gateway.loadAccountBalances.mockResolvedValueOnce(active());
  await checking.buttons[0].props.onPress?.();
  expect(checking.fundAccount).not.toHaveBeenCalled();
  expect(homeFrame(current, 1).buttons).toHaveLength(0);
  old.resolve({ status: 'inactive', address: 'GA' });
  await settle();
  expect(homeFrame(current, 1).buttons).toHaveLength(0);
});
