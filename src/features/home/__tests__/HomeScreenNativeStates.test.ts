import React, { useEffect, useState } from 'react';
import { StateView } from '@fresnica/ui-native';

import { NativeButton } from '@ui/components/NativeButton';
import { NativeStateView } from '@ui/components/NativeStateView';

import type { AccountRecord } from '../../../capabilities/account/types';
import { loadBalanceSnapshot, type BalanceDependencies } from '../../../capabilities/balance/loadBalanceSnapshot';
import type { FriendbotDependencies } from '../../../capabilities/network/fundTestnetAccountWithFriendbot';
import { HomeScreen } from '../HomeScreen';
import { AssetList } from '../components/AssetList';
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
  tone?: string;
  label?: string;
  variant?: string;
  size?: string;
  onPress?: () => void;
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

const balanceDependencies = {} as BalanceDependencies;
const friendbotDependencies = {} as FriendbotDependencies;
const mockedUseState = useState as unknown as jest.Mock;
const mockedUseEffect = useEffect as unknown as jest.Mock;
const mockedLoadBalanceSnapshot = loadBalanceSnapshot as jest.MockedFunction<typeof loadBalanceSnapshot>;

function renderHome(state: HomeBalanceState, currentAccount: AccountRecord = account) {
  const setBalanceState = jest.fn();
  const onSelectAccount = jest.fn();
  const onManualRefresh = jest.fn(async () => undefined);
  const onSend = jest.fn();
  let stateIndex = 0;
  mockedUseState.mockImplementation(() => {
    const index = stateIndex;
    stateIndex += 1;
    if (index === 0) return [state, setBalanceState];
    if (index === 1) return [false, jest.fn()];
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
    onManageAssets: jest.fn(),
    onOpenAsset: jest.fn(),
    onManualRefresh,
    invalidationRevision: 0,
    active: true,
  });
  return { root, setBalanceState, onSelectAccount, onManualRefresh, onSend };
}

describe('Home native balance-state presentation', () => {
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

    expect(setBalanceState).toHaveBeenCalledWith({ kind: 'loading' });
    expect(mockedLoadBalanceSnapshot).toHaveBeenCalledWith(balanceDependencies, account);
    expect(onSelectAccount).not.toHaveBeenCalled();
    expect(onManualRefresh).not.toHaveBeenCalled();
    expect(onSend).not.toHaveBeenCalled();
  });

  it('explains unsupported contract balances without offering a classic-account retry', () => {
    const contractAccount: AccountRecord = { ...account, identityKind: 'contract', address: 'CCONTRACT-A' };
    const { root } = renderHome(
      { kind: 'ready', snapshot: { status: 'unsupported-account', address: contractAccount.address } },
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
      snapshot: { status: 'inactive', address: account.address },
    }).root;
    const active = renderHome({
      kind: 'ready',
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
