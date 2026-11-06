import React from 'react';
import { AppModal } from '@ui/components';
import type { AccountRecord } from '../../../capabilities/account/types';
import type { BalanceProductDependencies } from '../../../capabilities/balance/BalanceCacheHydration';
import { InMemoryBalanceCacheRepository } from '../../../platform/persistence/memory/InMemoryBalanceCacheRepository';
import { AssetDetailsSheet } from '../AssetDetailsSheet';

jest.mock('@fresnica/ui-native', () => ({ Button: () => null, StateView: () => null }));
jest.mock('react', () => {
  const actual = jest.requireActual('react') as typeof import('react');
  return { ...actual, useState: (initial: unknown) => [initial, jest.fn()] };
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
        balances: [{ asset: { kind: 'native', code: 'XLM' }, balance: '10.0000000' }],
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
  });
});
