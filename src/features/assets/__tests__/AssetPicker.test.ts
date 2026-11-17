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
function harness() {
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
      return AssetPicker({ balances, selectedAsset: native, label: 'Assets', disabled, onSelect });
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
