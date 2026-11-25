import React, { useEffect, useState } from 'react';
import { FlatList, Pressable, TextInput } from 'react-native';
import { BottomSheet } from '../../../ui/components';
import { AssetPicker } from '../AssetPicker';
import type { BalanceLine } from '../../../capabilities/balance/types';

jest.mock('@fresnica/ui-native', () => ({ Button: () => null }));
jest.mock('react', () => ({ ...jest.requireActual('react'), useState: jest.fn(), useEffect: jest.fn() }));
jest.mock('../../../locale', () => ({ useLocalization: () => ({ t: (key: string) => key }) }));
jest.mock('../../../ui/theme', () => {
  const actual = jest.requireActual('../../../ui/theme');
  return {
    ...actual,
    useAppTheme: () => actual.defaultTheme,
    useThemedStyles: (factory: (theme: unknown) => unknown) => factory(actual.defaultTheme),
  };
});
const native = { kind: 'native', code: 'XLM' } as const;
const usd = { kind: 'credit', code: 'USD', issuer: 'GISSUER' } as const;
const balances: readonly BalanceLine[] = [
  { asset: native, balance: '10' },
  { asset: usd, balance: '0' },
];
function find<P>(root: React.ReactNode, type: unknown): React.ReactElement<P> {
  let match: React.ReactElement<P> | undefined;
  function visit(node: React.ReactNode) {
    if (!React.isValidElement<{ children?: React.ReactNode }>(node)) return;
    if (node.type === type) match = node as React.ReactElement<P>;
    React.Children.forEach(node.props.children, visit);
  }
  visit(root);
  if (!match) throw new Error('missing component');
  return match;
}
function harness(sourceBalances = balances, purpose?: 'send', selectedAsset: BalanceLine['asset'] = native) {
  const slots: unknown[] = [];
  let cursor = 0;
  jest.mocked(useState).mockImplementation((initial?: unknown) => {
    const i = cursor++;
    if (!(i in slots)) slots[i] = initial;
    return [
      slots[i],
      (value: unknown) => {
        slots[i] = value;
      },
    ] as ReturnType<typeof useState>;
  });
  const onSelect = jest.fn();
  return {
    onSelect,
    draw: (disabled = false) => {
      cursor = 0;
      return AssetPicker({ balances: sourceBalances, selectedAsset, label: 'Assets', disabled, onSelect, purpose });
    },
  };
}
it('opens, searches issuer, selects the exact row and closes with cleared search', () => {
  const h = harness();
  let root = h.draw();
  find<React.ComponentProps<typeof Pressable>>(root, Pressable).props.onPress?.({} as never);
  root = h.draw();
  expect(find<React.ComponentProps<typeof BottomSheet>>(root, BottomSheet).props.visible).toBe(true);
  find<React.ComponentProps<typeof TextInput>>(root, TextInput).props.onChangeText?.('gissuer');
  root = h.draw();
  const list = find<React.ComponentProps<typeof FlatList<BalanceLine>>>(root, FlatList).props;
  expect(list.data).toEqual([balances[1]]);
  const row = list.renderItem?.({ item: balances[1], index: 0, separators: {} as never }) as React.ReactElement<
    React.ComponentProps<typeof Pressable>
  >;
  expect(row.props.accessibilityState?.selected).toBe(false);
  row.props.onPress?.({} as never);
  expect(h.onSelect).toHaveBeenCalledWith(usd);
  root = h.draw();
  expect(find<React.ComponentProps<typeof BottomSheet>>(root, BottomSheet).props.visible).toBe(false);
  expect(find<React.ComponentProps<typeof TextInput>>(root, TextInput).props.value).toBe('');
});

it.each([
  [{}, 'unknown'],
  [{ isAuthorized: false, isAuthorizedToMaintainLiabilities: true, sellingLiabilities: '0' }, 'maintain-liabilities'],
  [{ isAuthorized: true, sellingLiabilities: '2' }, 'no-available-balance'],
] as const)('keeps restricted credit visible with an enforced Send reason: %s', (fields, reason) => {
  const credit: BalanceLine = { asset: usd, balance: '2', ...fields };
  const h = harness([balances[0], credit], 'send');
  const root = h.draw();
  const list = find<React.ComponentProps<typeof FlatList<BalanceLine>>>(root, FlatList).props;
  expect(list.data).toContain(credit);
  const row = list.renderItem?.({ item: credit, index: 1, separators: {} as never }) as React.ReactElement<
    React.ComponentProps<typeof Pressable>
  >;
  expect(row.props.disabled).toBe(true);
  expect(row.props.accessibilityHint).toBe(`assets.availability.send.${reason}`);
  row.props.onPress?.({} as never);
  expect(h.onSelect).not.toHaveBeenCalled();
});

it('allows fully authorized credit selection even when clawback is enabled', () => {
  const credit: BalanceLine = { asset: usd, balance: '2', sellingLiabilities: '1.9999999', isAuthorized: true, isClawbackEnabled: true };
  const h = harness([balances[0], credit], 'send');
  const root = h.draw();
  const list = find<React.ComponentProps<typeof FlatList<BalanceLine>>>(root, FlatList).props;
  const row = list.renderItem?.({ item: credit, index: 1, separators: {} as never }) as React.ReactElement<
    React.ComponentProps<typeof Pressable>
  >;
  expect(row.props.disabled).toBe(false);
  row.props.onPress?.({} as never);
  expect(h.onSelect).toHaveBeenCalledWith(usd);
});
it('cancel preserves selection and disabling hides an open picker', () => {
  const h = harness();
  let root = h.draw();
  find<React.ComponentProps<typeof Pressable>>(root, Pressable).props.onPress?.({} as never);
  root = h.draw();
  find<React.ComponentProps<typeof BottomSheet>>(root, BottomSheet).props.onClose();
  expect(h.onSelect).not.toHaveBeenCalled();
  root = h.draw(true);
  expect(find<React.ComponentProps<typeof BottomSheet>>(root, BottomSheet).props.visible).toBe(false);
  expect(find<React.ComponentProps<typeof Pressable>>(root, Pressable).props.disabled).toBe(true);
  jest.mocked(useEffect).mock.lastCall?.[0]();
  expect(find<React.ComponentProps<typeof BottomSheet>>(h.draw(), BottomSheet).props.visible).toBe(false);
});

it.each([
  [{ sellingLiabilities: '10', isAuthorized: true }, '0.0000001'],
  [{}, 'assets.availability.unknown'],
] as const)('includes the selected credit available balance in its Send accessibility label', (fields, available) => {
  const credit: BalanceLine = { asset: usd, balance: '10.0000001', ...fields };
  const h = harness([balances[0], credit], 'send', usd);
  const button = find<React.ComponentProps<typeof Pressable>>(h.draw(), Pressable);
  expect(button.props.accessibilityLabel).toBe(
    `Assets: USD, GISSUER, assets.picker.balance: 10.0000001, assets.availability.available: ${available}`,
  );
});
