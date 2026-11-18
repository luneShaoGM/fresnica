import React from 'react';
import { Pressable, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { BalanceAsset } from '../../../capabilities/balance/types';
import type { AccountRecord } from '../../../capabilities/account/types';
import type { BalanceProductDependencies } from '../../../capabilities/balance/BalanceCacheHydration';
import { InMemoryBalanceCacheRepository } from '../../../platform/persistence/memory/InMemoryBalanceCacheRepository';
import { AssetDetailsSheet } from '../AssetDetailsSheet';

jest.mock('@fresnica/ui-native', () => ({ Button: () => null, StateView: () => null }));
jest.mock('react', () => {
  const actual = jest.requireActual('react') as typeof import('react');
  return {
    ...actual,
    useState: (initial: unknown) => [initial, jest.fn()],
    useRef: (initial: unknown) => ({ current: initial }),
    useCallback: (callback: unknown) => callback,
    useMemo: (factory: () => unknown) => factory(),
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
let mockBalanceKind = 'ready';
let mockBalanceAsset: BalanceAsset = { kind: 'native', code: 'XLM' };

jest.mock('../useBalanceDisplay', () => ({
  useBalanceDisplay: () => ({
    state: mockBalanceKind === 'ready' ? {
      kind: 'ready',
      stale: false,
      refreshing: false,
      refreshFailed: false,
      snapshot: {
        status: 'active',
        address: 'GACCOUNT',
        balances: [{ asset: mockBalanceAsset, balance: '10.0000000' }],
        hiddenLiquidityPoolShareCount: 0,
      },
    } : {kind: mockBalanceKind, message: 'fixture read error'},
    refresh: jest.fn(),
  }),
}));
jest.mock('../useNativeBalanceBreakdown', () => ({
  useNativeBalanceBreakdown: () => undefined,
  matchingNativeBalance: () => undefined,
}));

const account: AccountRecord = {
  id: 'account-a',
  address: 'GACCOUNT',
  networkId: 'stellar-mainnet',
  identityKind: 'classic',
  label: 'Account A',
  sortOrder: 0,
  hidden: false,
  createdAt: new Date(0),
  updatedAt: new Date(0),
};
const balanceDependencies: BalanceProductDependencies = {
  networkId: account.networkId,
  gateway: { loadAccountBalances: jest.fn() },
  cache: new InMemoryBalanceCacheRepository(),
  now: () => new Date(0),
};

type NodeProps = { children?: React.ReactNode; onPress?: () => void; nestedScrollEnabled?: boolean };
function nodes(root: React.ReactNode): React.ReactElement<NodeProps>[] {
  if (!React.isValidElement<NodeProps>(root)) return [];
  return [root, ...React.Children.toArray(root.props.children).flatMap(nodes)];
}

describe('native asset sheet content', () => {
  beforeEach(() => { mockBalanceKind = 'ready'; });
  it.each(['loading', 'error'])('retains the first-descendant native scroll container during %s', kind => {
    mockBalanceKind = kind;
    const result = AssetDetailsSheet({
      asset: {kind:'native',code:'XLM'}, account, balanceDependencies, active:true,
      invalidationRevision:0, canSign:false, onClose:jest.fn(),
      copyPublicText:jest.fn(async () => undefined),onSend:jest.fn(),onRemove:jest.fn(),
    });
    expect(result.type).toBe(SafeAreaView);
    expect(result.props.children.type).toBe(ScrollView);
    expect(result.props.children.props.nestedScrollEnabled).toBe(true);
  });
  it.each([
    { kind: 'native' as const, code: 'XLM' as const },
    { kind: 'credit' as const, code: 'USDC', issuer: 'GISSUER' },
  ])('keeps one nested ScrollView mounted around the $code content and Close control', asset => {
    mockBalanceAsset = asset;
    const onClose = jest.fn();
    const result = AssetDetailsSheet({
      asset,
      account,
      balanceDependencies,
      active: true,
      invalidationRevision: 0,
      canSign: false,
      onClose,
      copyPublicText: jest.fn(async () => undefined),
      onSend: jest.fn(),
      onRemove: jest.fn(),
    });
    expect(result.type).toBe(SafeAreaView);
    const scroll = result.props.children;
    expect(scroll.type).toBe(ScrollView);
    expect(scroll.props.nestedScrollEnabled).toBe(true);
    expect(scroll.props.stickyHeaderIndices).toEqual([0]);
    const header = React.Children.toArray(scroll.props.children)[0];
    nodes(header)
      .find(node => node.type === Pressable)
      ?.props.onPress?.();
    expect(onClose).toHaveBeenCalledTimes(1);
    const body = React.Children.toArray(scroll.props.children).at(-1) as React.ReactElement;
    const renderBody = body.type as (props: unknown) => React.ReactElement;
    expect(nodes(renderBody(body.props)).some(node => node.type === ScrollView)).toBe(false);
    expect(result.props.onAccessibilityEscape).toBe(onClose);
  });
});
