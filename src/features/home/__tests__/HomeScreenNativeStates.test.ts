import { NetworkStatus } from '../components/NetworkStatus';
import { InMemoryBalanceCacheRepository } from '../../../platform/persistence/memory/InMemoryBalanceCacheRepository';
import React, { useEffect, useState } from 'react';
import { StateView } from '@fresnica/ui-native';

import { NativeButton } from '@ui/components/NativeButton';
import { NativeStateView } from '@ui/components/NativeStateView';

import type { AccountRecord } from '../../../capabilities/account/types';
import { loadBalanceSnapshot } from '../../../capabilities/balance/loadBalanceSnapshot';
import type { BalanceProductDependencies } from '../../../capabilities/balance/BalanceCacheHydration';
import type { FriendbotDependencies } from '../../../capabilities/network/fundTestnetAccountWithFriendbot';
import { HomeScreen } from '../HomeScreen';
import { AssetList, PinnedNativeAssetRow } from '../components/AssetList';
import { Pressable, ScrollView, View } from 'react-native';
import { AppBrandMark } from '@ui/components/AppBrandMark';
import { InactiveAccountPanel } from '../components/InactiveAccountPanel';
import type { HomeBalanceState } from '../homeViewModel';

jest.mock('@fresnica/ui-native', () => ({
  StateView: () => null,
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

jest.mock('@ui/theme', () => {
  const actual = jest.requireActual('@ui/theme') as typeof import('@ui/theme');
  return {
    ...actual,
    useAppTheme: () => actual.defaultTheme,
    useThemedStyles: (factory: (theme: typeof actual.defaultTheme) => unknown) => factory(actual.defaultTheme),
  };
});

jest.mock('../../../locale', () => ({
  useLocalization: () => ({ t: (key: string) => key }),
}));

jest.mock('../../../capabilities/balance/loadBalanceSnapshot', () => ({
  loadBalanceSnapshot: jest.fn(),
}));

jest.mock('../../../capabilities/network/fundTestnetAccountWithFriendbot', () => ({
  fundTestnetAccountWithFriendbot: jest.fn(),
  isFriendbotFundingAvailable: () => false,
}));

type NodeProps = Readonly<{
  children?: React.ReactNode;
  title?: string;
  description?: string;
  action?: React.ReactNode;
  line?: unknown;
  tone?: string;
  label?: string;
  variant?: string;
  size?: string;
  onPress?: () => void;
  accessibilityLabel?: string;
  hiddenLiquidityPoolShareCount?: number;
  refreshControl?: React.ReactElement<{ onRefresh: () => void }>;
}>;

function findElement(
  node: React.ReactNode,
  predicate: (element: React.ReactElement<NodeProps>) => boolean,
): React.ReactElement<NodeProps> | undefined {
  if (!React.isValidElement<NodeProps>(node)) return undefined;
  if (predicate(node)) return node;
  let result: React.ReactElement<NodeProps> | undefined;
  React.Children.forEach(node.props.children, child => {
    if (result === undefined) result = findElement(child, predicate);
  });
  return result;
}

const now = new Date('2026-10-19T00:00:00Z');
const account: AccountRecord = {
  id: 'account-a',
  address: 'GACCOUNT-A',
  identityKind: 'classic',
  networkId: 'stellar-testnet',
  label: 'Account A',
  sortOrder: 0,
  hidden: false,
  createdAt: now,
  updatedAt: now,
};

const balanceDependencies: BalanceProductDependencies = {
  networkId: 'stellar-testnet',
  now: () => new Date(0),
  cache: new InMemoryBalanceCacheRepository(),
  gateway: { loadAccountBalances: jest.fn() },
};
const friendbotDependencies = {} as FriendbotDependencies;
const mockedUseState = useState as unknown as jest.Mock;
const mockedUseEffect = useEffect as unknown as jest.Mock;
const mockedLoadBalanceSnapshot = loadBalanceSnapshot as jest.MockedFunction<typeof loadBalanceSnapshot>;

function renderHome(
  state: HomeBalanceState,
  currentAccount: AccountRecord = account,
  categoryOptions: Pick<
    React.ComponentProps<typeof HomeScreen>,
    'assetCategory' | 'claimableContent' | 'onClaimablePullRefresh' | 'onOpenAssetCategory'
  > = {},
) {
  const setBalanceState = jest.fn();
  const onSelectAccount = jest.fn();
  const onManualRefresh = jest.fn(async () => undefined);
  const onSend = jest.fn();
  const onSwitchNetwork = jest.fn();
  let stateIndex = 0;
  mockedUseState.mockImplementation(() => {
    const index = stateIndex;
    stateIndex += 1;
    if (index === 0) return [state, setBalanceState];
    if (index === 1 || index === 2) return [false, jest.fn()];
    return [{}, jest.fn()];
  });

  const root = HomeScreen({
    account: currentAccount,
    accountCount: 1,
    selectableAccounts: [currentAccount],
    balanceDependencies,
    friendbotDependencies,
    canSign: currentAccount.identityKind === 'classic',
    onSelectAccount,
    onAddAccount: jest.fn(),
    onSend,
    onSwitchNetwork,
    onManageAssets: jest.fn(),
    onOpenAsset: jest.fn(),
    onManualRefresh,
    invalidationRevision: 0,
    active: true,
    ...categoryOptions,
  });
  return { root, setBalanceState, onSelectAccount, onManualRefresh, onSend, onSwitchNetwork };
}

describe('Home native balance-state presentation', () => {
  it('connects the Home network button to the chooser callback', () => {
    const { root, onSwitchNetwork } = renderHome({ kind: 'loading' });
    findElement(root, node => node.type === NetworkStatus)?.props.onPress?.();
    expect(onSwitchNetwork).toHaveBeenCalledTimes(1);
  });
  beforeEach(() => {
    jest.clearAllMocks();
    mockedUseState.mockReset();
    mockedUseEffect.mockReset();
  });

  it('keeps the gateway failure message and retries with the same account and dependencies', async () => {
    mockedLoadBalanceSnapshot.mockResolvedValue({
      status: 'active',
      address: account.address,
      balances: [],
      hiddenLiquidityPoolShareCount: 0,
    });
    const { root, setBalanceState, onSelectAccount, onManualRefresh, onSend } = renderHome({
      kind: 'error',
      message: 'Timeout reading Horizon for account A',
    });
    const state = findElement(root, element => element.type === NativeStateView);
    expect(state?.props).toMatchObject({
      title: 'Balances unavailable',
      tone: 'error',
      description: 'Timeout reading Horizon for account A',
    });

    const retry = React.isValidElement<NodeProps>(state?.props.action) ? state.props.action : undefined;
    expect(retry?.type).toBe(NativeButton);
    expect(retry?.props).toMatchObject({ label: 'Try again', size: 'sm', variant: 'secondary' });
    retry?.props.onPress?.();
    await Promise.resolve();
    await Promise.resolve();

    expect(setBalanceState.mock.calls[0][0]({ kind: 'error', message: 'Previous error' })).toEqual({
      kind: 'error',
      message: 'Previous error',
    });
    expect(mockedLoadBalanceSnapshot).toHaveBeenCalledWith(balanceDependencies, account);
    expect(onSelectAccount).not.toHaveBeenCalled();
    expect(onManualRefresh).not.toHaveBeenCalled();
    expect(onSend).not.toHaveBeenCalled();
  });

  it('explains unsupported contract balances without offering a classic-account retry', () => {
    const contractAccount: AccountRecord = { ...account, identityKind: 'contract', address: 'CCONTRACT-A' };
    const { root } = renderHome(
      {
        kind: 'ready',
        stale: false,
        refreshing: false,
        refreshFailed: false,
        snapshot: { status: 'unsupported-account', address: contractAccount.address },
      },
      contractAccount,
    );
    const state = findElement(root, element => element.type === NativeStateView);

    expect(state?.props).toMatchObject({
      title: 'Assets unavailable',
      description: 'Classic Horizon balance semantics are not applied to contract accounts.',
    });
    expect(state?.props.action).toBeUndefined();
    expect(mockedLoadBalanceSnapshot).not.toHaveBeenCalled();
  });

  it('leaves loading, inactive account funding and active balance rows on their existing paths', () => {
    const loading = renderHome({ kind: 'loading' }).root;
    const inactive = renderHome({
      kind: 'ready',
      stale: false,
      refreshing: false,
      refreshFailed: false,
      snapshot: { status: 'inactive', address: account.address },
    }).root;
    const active = renderHome({
      kind: 'ready',
      stale: false,
      refreshing: false,
      refreshFailed: false,
      snapshot: {
        status: 'active',
        address: account.address,
        balances: [],
        hiddenLiquidityPoolShareCount: 0,
      },
    }).root;

    expect(findElement(loading, element => element.type === NativeStateView)).toBeUndefined();
    expect(findElement(inactive, element => element.type === InactiveAccountPanel)).toBeDefined();
    expect(findElement(active, element => element.type === AssetList)).toBeDefined();
    expect(findElement(inactive, element => element.type === NativeStateView)).toBeUndefined();
    expect(findElement(active, element => element.type === NativeStateView)).toBeUndefined();
  });

  it.each([true, false])('forwards inactive snapshot freshness to the panel (stale=%s)', stale => {
    const { root } = renderHome({
      kind: 'ready',
      stale,
      refreshing: stale,
      refreshFailed: false,
      snapshot: { status: 'inactive', address: account.address },
    });
    const panel = findElement(root, element => element.type === InactiveAccountPanel);
    expect(panel?.props).toMatchObject({ stale, address: account.address });
  });

  it('renders native XLM outside both independently scrollable header and issued Token lists', () => {
    const { root } = renderHome({
      kind: 'ready',
      stale: false,
      refreshing: false,
      refreshFailed: false,
      snapshot: {
        status: 'active',
        address: account.address,
        balances: [
          { asset: { kind: 'native', code: 'XLM' }, balance: '100.0000000' },
          { asset: { kind: 'credit', code: 'USD', issuer: 'GISSUER' }, balance: '7' },
        ],
        hiddenLiquidityPoolShareCount: 0,
      },
    });
    const screenChildren = React.Children.toArray(root.props.children) as React.ReactElement<NodeProps>[];
    const layout = screenChildren[0];
    expect(layout.type).toBe(View);
    const regions = React.Children.toArray(layout.props.children) as React.ReactElement<NodeProps>[];
    expect(regions.map(region => region.type)).toEqual([ScrollView, View, ScrollView]);
    expect(findElement(regions[0], element => element.type === PinnedNativeAssetRow)).toBeUndefined();
    expect(findElement(regions[1], element => element.type === PinnedNativeAssetRow)?.props.line).toMatchObject({
      asset: { kind: 'native', code: 'XLM' },
    });
    expect(findElement(regions[2], element => element.type === AssetList)).toBeDefined();
    expect(findElement(regions[2], element => element.type === PinnedNativeAssetRow)).toBeUndefined();
  });

  it('combines pinned XLM, the brand header and in-place Claimable without swapping the scroll regions', () => {
    const state: HomeBalanceState = {
      kind: 'ready',
      stale: false,
      refreshing: false,
      refreshFailed: false,
      snapshot: {
        status: 'active',
        address: account.address,
        balances: [{ asset: { kind: 'native', code: 'XLM' }, balance: '10.0000000' }],
        hiddenLiquidityPoolShareCount: 2,
      },
    };
    const openCategory = jest.fn();
    const refreshClaimable = jest.fn();
    const content = React.createElement(View, { testID: 'embedded-claimable' });

    const tokens = renderHome(state, account, {
      assetCategory: 'tokens',
      onOpenAssetCategory: openCategory,
    }).root;
    const tokenLayout = React.Children.toArray(tokens.props.children)[0] as React.ReactElement<NodeProps>;
    const tokenRegions = React.Children.toArray(tokenLayout.props.children) as React.ReactElement<NodeProps>[];
    expect(tokenRegions.map(region => region.type)).toEqual([ScrollView, View, ScrollView]);
    expect(findElement(tokenRegions[0], node => node.type === AppBrandMark)).toBeDefined();
    expect(findElement(tokenRegions[1], node => node.type === PinnedNativeAssetRow)).toBeDefined();
    expect(findElement(tokenRegions[2], node => node.type === AssetList)?.props.hiddenLiquidityPoolShareCount).toBe(2);
    findElement(
      tokenRegions[0],
      node => node.type === Pressable && node.props.accessibilityLabel === 'claimable.category.choose',
    )?.props.onPress?.();
    expect(openCategory).toHaveBeenCalledTimes(1);

    const claimable = renderHome(state, account, {
      assetCategory: 'claimable',
      claimableContent: content,
      onClaimablePullRefresh: refreshClaimable,
    }).root;
    const claimableLayout = React.Children.toArray(claimable.props.children)[0] as React.ReactElement<NodeProps>;
    const claimableRegions = React.Children.toArray(claimableLayout.props.children) as React.ReactElement<NodeProps>[];
    expect(claimableRegions.map(region => region.type)).toEqual([ScrollView, ScrollView]);
    expect(findElement(claimableRegions[0], node => node.type === AppBrandMark)).toBeDefined();
    expect(findElement(claimableRegions[1], node => node.type === AssetList)).toBeUndefined();
    expect(findElement(claimableRegions[1], node => node.type === PinnedNativeAssetRow)).toBeUndefined();
    expect(findElement(claimableRegions[1], node => node === content)).toBe(content);
    const refresh = claimableRegions[1].props.refreshControl as React.ReactElement<{ onRefresh: () => void }>;
    refresh.props.onRefresh();
    expect(refreshClaimable).toHaveBeenCalledTimes(1);
  });

  it('forwards optional description and action through the native state facade', () => {
    const action = React.createElement(NativeButton, { label: 'Retry', onPress: jest.fn() });
    const element = NativeStateView({
      title: 'Balance error',
      description: 'Offline',
      tone: 'error',
      action,
    });

    expect(element.type).toBe(StateView);
    expect(element.props).toMatchObject({
      title: 'Balance error',
      description: 'Offline',
      tone: 'error',
      action,
    });
  });
});
