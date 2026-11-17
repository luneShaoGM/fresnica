import React from 'react';
import { Pressable, ScrollView } from 'react-native';
import type { BalanceAsset } from '../../../capabilities/balance/types';
import { AppModal } from '@ui/components';
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
let mockBalanceAsset: BalanceAsset = { kind: 'native', code: 'XLM' };

jest.mock('../useBalanceDisplay', () => ({
  useBalanceDisplay: () => ({
    state: {
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
    },
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

describe('XLM details shared swipeable modal', () => {
  beforeEach(() => {
    mockBalanceAsset = { kind: 'native', code: 'XLM' };
  });

  it('uses the network sheet AppModal with swipe/backdrop close and retains XLM body', () => {
    const onClose = jest.fn();
    const result = AssetDetailsSheet({
      visible: true,
      asset: { kind: 'native', code: 'XLM' },
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
    expect(result.type).toBe(AppModal);
    expect(result.props).toMatchObject({
      visible: true,
      presentation: 'sheet',
      swipeToDismiss: true,
    });
    result.props.onRequestClose();
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(React.Children.count(result.props.children)).toBe(1);
    const header = result.props.swipeHeader;
    const headerChildren = React.isValidElement<{ children?: React.ReactNode }>(header)
      ? React.Children.toArray(header.props.children)
      : [];
    expect(headerChildren.some(child => React.isValidElement(child) && child.type === Pressable)).toBe(true);
    expect(result.props.scrollContentAtTop?.()).toBe(true);

    const sheetBody = result.props.children as React.ReactElement<{ children: React.ReactNode }>;
    const content = React.Children.toArray(sheetBody.props.children);
    const scrollContent = content.find(
      node => React.isValidElement<{ onScroll?: unknown }>(node) && typeof node.props.onScroll === 'function',
    );
    if (!React.isValidElement<{ onScroll: (event: unknown) => void }>(scrollContent)) {
      throw new Error('Expected native asset scroll body');
    }
    scrollContent.props.onScroll({ nativeEvent: { contentOffset: { y: 70 } } });
    expect(result.props.scrollContentAtTop?.()).toBe(false);
    scrollContent.props.onScroll({ nativeEvent: { contentOffset: { y: 0 } } });
    expect(result.props.scrollContentAtTop?.()).toBe(true);
  });

  it('forwards issued-asset scrolling to the same top-only dismissal gate', () => {
    const asset = { kind: 'credit' as const, code: 'USDC', issuer: 'GISSUER' };
    mockBalanceAsset = asset;
    const onClose = jest.fn();
    const result = AssetDetailsSheet({
      visible: true,
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
    const sheet = result.props.children as React.ReactElement<{ children: React.ReactNode }>;
    const issuedBody = React.Children.toArray(sheet.props.children).find(
      child => React.isValidElement<{ onScroll?: unknown }>(child) && typeof child.props.onScroll === 'function',
    );
    if (
      !React.isValidElement<{ onScroll: (event: unknown) => void }>(issuedBody) ||
      typeof issuedBody.type !== 'function'
    ) {
      throw new Error('Expected issued-asset scroll body');
    }
    const renderIssuedBody = issuedBody.type as (props: { onScroll: (event: unknown) => void }) => React.ReactElement<{
      onScroll: unknown;
      scrollEventThrottle: number;
    }>;
    const scrollView = renderIssuedBody(issuedBody.props);
    expect(scrollView.type).toBe(ScrollView);
    expect(scrollView.props.onScroll).toBe(issuedBody.props.onScroll);
    expect(scrollView.props.scrollEventThrottle).toBe(16);

    issuedBody.props.onScroll({ nativeEvent: { contentOffset: { y: 90 } } });
    expect(result.props.scrollContentAtTop?.()).toBe(false);
    issuedBody.props.onScroll({ nativeEvent: { contentOffset: { y: 0 } } });
    expect(result.props.scrollContentAtTop?.()).toBe(true);
    expect(onClose).not.toHaveBeenCalled();
  });
});
