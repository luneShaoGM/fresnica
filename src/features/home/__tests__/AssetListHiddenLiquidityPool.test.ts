import React from 'react';
import { Pressable, Text } from 'react-native';
import { AssetList, PinnedNativeAssetRow } from '../components/AssetList';
import { projectNativeBalanceBreakdown } from '../../../capabilities/balance/nativeBalanceBreakdown';

jest.mock('@ui/theme', () => {
  const actual = jest.requireActual('@ui/theme') as typeof import('@ui/theme');
  return {
    ...actual,
    useThemedStyles: (factory: (theme: typeof actual.defaultTheme) => unknown) => factory(actual.defaultTheme),
  };
});

it('presents available XLM and reserve separately, falls back honestly, and opens the exact native asset', () => {
  const breakdown = projectNativeBalanceBreakdown({
    address: 'GACCOUNT', subentryCount: 0, numSponsoring: 0, numSponsored: 0,
    flags: { authRequired: false, authClawbackEnabled: false },
    balances: [{ kind: 'native', balance: native.balance, sellingLiabilities: '0' }],
  }, { baseReserveStroops: 5000000, baseFeeStroops: 100 });
  const onOpenAsset = jest.fn();
  const render = (value?: typeof breakdown) => PinnedNativeAssetRow({ line: native, breakdown: value, onOpenAsset, t: key => key });
  const ready = render(breakdown);
  expect(texts(ready)).toEqual(['XLM', 'home.asset.available', '11.0000000', 'home.asset.reserved', '1.0000000 XLM']);
  const row = elements(ready, Pressable)[0].props as { onPress: () => void; accessibilityLabel: string };
  expect(row.accessibilityLabel).toBe('XLM home.asset.available 11.0000000');
  row.onPress();
  expect(onOpenAsset).toHaveBeenCalledWith(native.asset);
  expect(texts(render())).toContain('home.asset.accountBalance');
  expect(texts(render())).toContain(native.balance);
  expect(texts(render())).toContain('— XLM');
});
jest.mock('../../assets/TokenAssetIcon', () => ({ TokenAssetIcon: () => null }));

function elements(root: React.ReactNode, type: unknown): React.ReactElement<{ children?: React.ReactNode }>[] {
  const result: React.ReactElement<{ children?: React.ReactNode }>[] = [];
  const visit = (node: React.ReactNode) => {
    if (!React.isValidElement<{ children?: React.ReactNode }>(node)) return;
    if (node.type === type) result.push(node);
    React.Children.forEach(node.props.children, visit);
  };
  visit(root);
  return result;
}

function texts(root: React.ReactNode): string[] {
  return elements(root, Text).map(element => React.Children.toArray(element.props.children).join(''));
}

const native = { asset: { kind: 'native' as const, code: 'XLM' as const }, balance: '12.0000000' };
const credit = {
  asset: { kind: 'credit' as const, code: 'USD', issuer: 'GISSUER' },
  balance: '3.0000000',
};

describe('Home hidden liquidity-pool positions', () => {
  const onOpenAsset = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows the LP count even if XLM is the only directly rendered asset', () => {
    const root = AssetList({
      balances: [native],
      hiddenLiquidityPoolShareCount: 2,
      onOpenAsset,
    });
    const labels = texts(root);
    expect(labels).toContain('No other assets.');
    expect(labels).toContain('2 liquidity-pool position(s) are not shown by the current Home balance contract.');
    expect(elements(root, Pressable)).toHaveLength(0);
    expect(labels).not.toContain('Refresh balances');
  });

  it('does not show a phantom LP notice if the account only has XLM', () => {
    const root = AssetList({
      balances: [native],
      hiddenLiquidityPoolShareCount: 0,
      onOpenAsset,
    });
    expect(texts(root).some(text => text.includes('liquidity-pool position(s)'))).toBe(false);
    expect(texts(root)).toContain('No other assets.');
  });

  it('preserves the existing LP count below a visible credit token', () => {
    const root = AssetList({
      balances: [native, credit],
      hiddenLiquidityPoolShareCount: 1,
      onOpenAsset,
    });
    const labels = texts(root);
    expect(labels).toContain('USD');
    expect(labels).toContain('1 liquidity-pool position(s) are not shown by the current Home balance contract.');
    expect(labels).not.toContain('No other assets.');
    expect(labels).not.toContain('Refresh balances');
    expect(elements(root, Pressable)).toHaveLength(1);
    (elements(root, Pressable)[0].props as { onPress: () => void }).onPress();
    expect(onOpenAsset).toHaveBeenCalledWith(credit.asset);
  });
});
