import React from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { BalanceAsset, BalanceLine } from '../../../capabilities/balance/types';
import type { AccountRecord } from '../../../capabilities/account/types';
import type { BalanceProductDependencies } from '../../../capabilities/balance/BalanceCacheHydration';
import { InMemoryBalanceCacheRepository } from '../../../platform/persistence/memory/InMemoryBalanceCacheRepository';
import { AssetDetailsSheet } from '../AssetDetailsSheet';
import { CreditFiatEstimate } from '@features/valuation/CreditFiatEstimate';

jest.mock('@fresnica/ui-native', () => ({ Button: () => null, StateView: () => null }));
jest.mock('react', () => {
  const actual = jest.requireActual('react') as typeof import('react');
  return {
    ...actual,
    useState: (initial: unknown) => [typeof initial === 'number' ? mockBodyHeight : initial, jest.fn()],
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
let mockBodyHeight = 0;
let mockBalanceKind = 'ready';
let mockBalanceAsset: BalanceAsset = { kind: 'native', code: 'XLM' };
let mockBalanceFields: Partial<BalanceLine> = {};

jest.mock('../useBalanceDisplay', () => ({
  useBalanceDisplay: () => ({
    state:
      mockBalanceKind === 'ready'
        ? {
            kind: 'ready',
            stale: false,
            refreshing: false,
            refreshFailed: false,
            snapshot: {
              status: 'active',
              address: 'GACCOUNT',
              balances: [{ asset: mockBalanceAsset, balance: '10.0000000', ...mockBalanceFields }],
              hiddenLiquidityPoolShareCount: 0,
            },
          }
        : { kind: mockBalanceKind, message: 'fixture read error' },
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

type NodeProps = {
  children?: React.ReactNode;
  onPress?: () => void;
  nestedScrollEnabled?: boolean;
  style?: StyleProp<TextStyle | ViewStyle>;
  accessibilityRole?: string;
  accessibilityHint?: string;
  disabled?: boolean;
  label?: string;
  value?: string;
};
function nodes(root: React.ReactNode): React.ReactElement<NodeProps>[] {
  if (!React.isValidElement<NodeProps>(root)) return [];
  return [root, ...React.Children.toArray(root.props.children).flatMap(nodes)];
}

describe('native asset sheet content', () => {
  beforeEach(() => {
    mockBalanceKind = 'ready';
    mockBalanceAsset = { kind: 'native', code: 'XLM' };
    mockBalanceFields = {};
  });
  it.each(['android', 'ios'] as const)('keeps short content scroll handoff available on %s', os => {
    const originalOS = Platform.OS;
    try {
      Object.defineProperty(Platform, 'OS', { configurable: true, value: os });
      mockBodyHeight = 480;
      const result = AssetDetailsSheet({
        asset: { kind: 'credit', code: 'USDC', issuer: 'GISSUER' },
        account,
        balanceDependencies,
        active: true,
        invalidationRevision: 0,
        canSign: false,
        onClose: jest.fn(),
        copyPublicText: jest.fn(async () => undefined),
        onSend: jest.fn(),
        onRemove: jest.fn(),
      });
      const scroll = result.props.children;
      expect(StyleSheet.flatten(scroll.props.contentContainerStyle).minHeight).toBe(os === 'android' ? 481 : undefined);
      expect(typeof scroll.props.onLayout).toBe(os === 'android' ? 'function' : 'undefined');
    } finally {
      mockBodyHeight = 0;
      Object.defineProperty(Platform, 'OS', { configurable: true, value: originalOS });
    }
  });
  it('keeps full issuer and Copy inside a bounded, wrapped field rather than expanding the sheet', () => {
    const issuer = 'G' + 'A'.repeat(55);
    const asset: BalanceAsset = { kind: 'credit', code: 'USDC', issuer };
    mockBalanceAsset = asset;
    const result = AssetDetailsSheet({
      asset,
      account,
      balanceDependencies,
      active: true,
      invalidationRevision: 0,
      canSign: false,
      onClose: jest.fn(),
      copyPublicText: jest.fn(async () => undefined),
      onSend: jest.fn(),
      onRemove: jest.fn(),
    });
    const body = React.Children.toArray(result.props.children.props.children).at(-1) as React.ReactElement;
    const renderBody = body.type as (props: unknown) => React.ReactElement;
    const content = renderBody(body.props);
    const issuerRow = nodes(content).find(
      node =>
        node.type === View &&
        React.Children.toArray(node.props.children).some(
          child =>
            React.isValidElement<{ children?: React.ReactNode }>(child) &&
            child.type === Text &&
            child.props.children === 'home.asset.issuer',
        ),
    );
    expect(StyleSheet.flatten(issuerRow?.props.style)).toMatchObject({ flexDirection: 'column', minWidth: 0 });
    const copyButton = nodes(issuerRow).find(node => node.type === Pressable);
    expect(copyButton?.props.accessibilityRole).toBe('button');
    expect(StyleSheet.flatten(copyButton?.props.style)).toMatchObject({ width: '100%', minWidth: 0 });
    const textNodes = nodes(copyButton).filter(node => node.type === Text);
    const fullAddress = textNodes.find(node => node.props.children === issuer);
    expect(fullAddress).toBeDefined();
    expect(StyleSheet.flatten(fullAddress?.props.style)).toMatchObject({ width: '100%', flexShrink: 1 });
    expect(textNodes.some(node => node.props.children === 'home.asset.copyIssuer')).toBe(true);
  });

  it.each(['loading', 'error'])('retains the first-descendant native scroll container during %s', kind => {
    mockBalanceKind = kind;
    const result = AssetDetailsSheet({
      asset: { kind: 'native', code: 'XLM' },
      account,
      balanceDependencies,
      active: true,
      invalidationRevision: 0,
      canSign: false,
      onClose: jest.fn(),
      copyPublicText: jest.fn(async () => undefined),
      onSend: jest.fn(),
      onRemove: jest.fn(),
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

describe('credit asset availability', () => {
  function renderCredit(fields: Partial<BalanceLine> = {}) {
    mockBalanceKind = 'ready';
    const asset = { kind: 'credit', code: 'USD', issuer: 'GISSUER' } as const;
    mockBalanceAsset = asset;
    mockBalanceFields = fields;
    const onSend = jest.fn();
    const onRemove = jest.fn();
    const result = AssetDetailsSheet({
      asset, account, balanceDependencies, active: true, invalidationRevision: 0,
      canSign: true, onClose: jest.fn(), copyPublicText: jest.fn(async () => undefined), onSend, onRemove,
    });
    const body = React.Children.toArray(result.props.children.props.children).at(-1) as React.ReactElement;
    const renderBody = body.type as (props: unknown) => React.ReactElement;
    const all = nodes(renderBody(body.props));
    const action = (key: string) => all.find(node => node.type === Pressable &&
      nodes(node).some(child => child.type === Text && child.props.children === key));
    const value = (label: string) => all.find(node => node.props.label === label)?.props.value;
    return { all, action, value, onSend, onRemove, asset };
  }

  it('shows exact available/capacity, authorization and independent clawback information', () => {
    const h = renderCredit({
      balance: '10.0000001', limit: '20', buyingLiabilities: '3', sellingLiabilities: '2',
      isAuthorized: true, isAuthorizedToMaintainLiabilities: false, isClawbackEnabled: true,
    });
    expect(h.value('assets.availability.available')).toBe('8.0000001');
    expect(h.value('assets.availability.receivingCapacity')).toBe('6.9999999');
    expect(h.value('assets.availability.buyingLiabilities')).toBe('3.0000000');
    expect(h.value('assets.availability.sellingLiabilities')).toBe('2.0000000');
    expect(h.value('assets.availability.authorization')).toBe('assets.availability.authorization.authorized');
    expect(h.value('assets.availability.clawback')).toBe('assets.availability.enabled');
    expect(h.action('home.asset.send')?.props.disabled).toBe(false);
    h.action('home.asset.send')?.props.onPress?.();
    expect(h.onSend).toHaveBeenCalledWith(h.asset);
  });

  it.each([
    [{}, 'unknown'],
    [{ isAuthorized: false, isAuthorizedToMaintainLiabilities: true, sellingLiabilities: '0' }, 'maintain-liabilities'],
    [{ isAuthorized: false, sellingLiabilities: '0' }, 'unauthorized'],
    [{ isAuthorized: true, sellingLiabilities: '10' }, 'no-available-balance'],
  ] as const)('explains and enforces disabled send for %s', (fields, reason) => {
    const h = renderCredit(fields);
    const send = h.action('home.asset.send');
    expect(send?.props.disabled).toBe(true);
    expect(send?.props.accessibilityHint).toBe(`assets.availability.send.${reason}`);
    expect(h.all.some(node => node.type === Text && node.props.children === `assets.availability.send.${reason}`)).toBe(true);
    send?.props.onPress?.();
    expect(h.onSend).not.toHaveBeenCalled();
    if (reason === 'unknown') {
      expect(h.value('assets.availability.available')).toBe('assets.availability.unknown');
      expect(h.value('assets.availability.buyingLiabilities')).toBe('assets.availability.unknown');
      expect(h.value('assets.availability.clawback')).toBe('assets.availability.unknown');
    }
  });

  it.each([
    [{ balance: '0' }, 'unknown'],
    [{ balance: '0', buyingLiabilities: '0.0000001', sellingLiabilities: '0' }, 'liabilities'],
    [{ balance: '1', buyingLiabilities: '0', sellingLiabilities: '0' }, 'balance-not-zero'],
  ] as const)('explains and enforces disabled removal for %s', (fields, reason) => {
    const h = renderCredit(fields);
    const remove = h.action('home.asset.remove');
    expect(remove?.props.disabled).toBe(true);
    expect(remove?.props.accessibilityHint).toBe(`assets.availability.remove.${reason}`);
    remove?.props.onPress?.();
    expect(h.onRemove).not.toHaveBeenCalled();
  });

  it('allows removal of a known empty line even when ordinary transfers are not authorized', () => {
    const h = renderCredit({ balance: '0', buyingLiabilities: '0', sellingLiabilities: '0', isAuthorized: false });
    expect(h.action('home.asset.remove')?.props.disabled).toBe(false);
    h.action('home.asset.remove')?.props.onPress?.();
    expect(h.onRemove).toHaveBeenCalledWith(h.asset);
  });
});

it.each(['stellar-mainnet', 'stellar-testnet'])('wires the exact detail asset to valuation only on %s', networkId => {
  const asset = { kind: 'credit', code: 'USD', issuer: 'GISSUER' } as const;
  mockBalanceKind = 'ready';
  mockBalanceAsset = asset;
  mockBalanceFields = {};
  const quotes = { load: jest.fn() };
  const result = AssetDetailsSheet({
    asset, account: { ...account, networkId }, balanceDependencies, creditFiatQuotes: quotes,
    active: true, invalidationRevision: 0, canSign: false, onClose: jest.fn(),
    copyPublicText: jest.fn(async () => undefined), onSend: jest.fn(), onRemove: jest.fn(),
  });
  const body = React.Children.toArray(result.props.children.props.children).at(-1) as React.ReactElement;
  const renderBody = body.type as (props: unknown) => React.ReactElement;
  const estimate = nodes(renderBody(body.props)).find(node => node.type === CreditFiatEstimate);
  if (networkId === 'stellar-mainnet') expect(estimate?.props).toMatchObject({ asset, quotes, balance: '10.0000000', active: true });
  else expect(estimate).toBeUndefined();
});
