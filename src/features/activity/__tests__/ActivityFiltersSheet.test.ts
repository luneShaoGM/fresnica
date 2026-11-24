import React, { useState } from 'react';
import { Pressable, Switch } from 'react-native';
import { BottomSheet, SelectField, type SelectFieldProps } from '@ui/components';
import { SelectableChip } from '@ui/components/SelectableChip';
import { NativeButton } from '@ui/components/NativeButton';
import { ActivityFiltersSheet, type ActivityDisplayFilters } from '../ActivityFiltersSheet';

jest.mock('react', () => ({ ...jest.requireActual('react'), useState: jest.fn() }));
jest.mock('../../../ui/theme', () => {
  const actual = jest.requireActual('../../../ui/theme');
  return { ...actual, useThemedStyles: (factory: (theme: unknown) => unknown) => factory(actual.defaultTheme) };
});
jest.mock('../../../locale', () => ({
  useLocalization: () => jest.requireActual('../../../locale/localization').createLocalization('en'),
}));
jest.mock('@fresnica/ui-native', () => ({ Field: () => null, Button: () => null }));

type Props = {
  children?: React.ReactNode;
  label?: string;
  accessibilityLabel?: string;
  onPress?: () => void;
  onClose?: () => void;
  onValueChange?: (value: boolean) => void;
};
function nodes(root: React.ReactNode): React.ReactElement<Props>[] {
  if (!React.isValidElement<Props>(root)) return [];
  return [root, ...React.Children.toArray(root.props.children).flatMap(nodes)];
}
function selectField(root: React.ReactNode, label: string): React.ReactElement<SelectFieldProps<string>> {
  const field = nodes(root).find(node => node.type === SelectField && node.props.label === label);
  if (!React.isValidElement<SelectFieldProps<string>>(field)) throw new Error(`Missing select field: ${label}`);
  return field;
}
const usd = JSON.stringify(['USD', 'GISSUER']);
const otherUsd = JSON.stringify(['USD', 'GOTHERISSUER']);
const defaults: ActivityDisplayFilters = {
  type: 'all',
  showHidden: false,
  hideDust: true,
  showFailed: false,
  hiddenAssets: new Set(),
  quantity: {},
};
function harness(initial: ActivityDisplayFilters = defaults, assets: readonly string[] = ['native:XLM', usd]) {
  const slots: unknown[] = [];
  let cursor = 0;
  jest.mocked(useState).mockImplementation((initialValue?: unknown) => {
    const index = cursor++;
    if (!(index in slots)) slots[index] = initialValue;
    return [
      slots[index],
      (update: unknown) => {
        slots[index] = typeof update === 'function' ? update(slots[index]) : update;
      },
    ] as ReturnType<typeof useState>;
  });
  const props = { initial, assets, onClose: jest.fn(), onApply: jest.fn(), onRefresh: jest.fn() };
  const draw = () => {
    cursor = 0;
    return ActivityFiltersSheet(props);
  };
  return {
    ...props,
    draw,
    draft: () => slots[0] as ActivityDisplayFilters,
    select(label: string, value: string) {
      const field = selectField(draw(), label);
      field.props.onValueChange(value);
    },
  };
}

it('keeps choices compact and cancelling discards draft changes', () => {
  const h = harness();
  let all = nodes(h.draw());
  expect(all.filter(node => node.type === SelectField)).toHaveLength(3);
  expect(all.some(node => node.props.accessibilityLabel === 'Hide USD · GISSUER')).toBe(false);
  h.select('Type', 'payments');
  h.select('Asset', usd);
  all = nodes(h.draw());
  all.find(node => node.type === BottomSheet)?.props.onClose?.();
  expect(h.onClose).toHaveBeenCalledTimes(1);
  expect(h.onApply).not.toHaveBeenCalled();
  expect(h.initial).toEqual(defaults);
});

it('keeps hidden assets as independent draft checkboxes and applies only on Apply', () => {
  const h = harness();
  let all = nodes(h.draw());
  all
    .find(node => node.type === Pressable && node.props.accessibilityLabel === 'Manage hidden assets')
    ?.props.onPress?.();
  all = nodes(h.draw());
  all.find(node => node.props.accessibilityLabel === 'Hide USD · GISSUER')?.props.onPress?.();
  all
    .find(node => node.type === Switch && node.props.accessibilityLabel === 'Show hidden activity')
    ?.props.onValueChange?.(true);
  all.find(node => node.type === Switch && node.props.accessibilityLabel === 'Hide dust')?.props.onValueChange?.(false);
  expect(h.initial.hiddenAssets.size).toBe(0);
  expect(h.onApply).not.toHaveBeenCalled();
  all = nodes(h.draw());
  expect(all.some(node => node.props.accessibilityLabel === 'Hide XLM · ')).toBe(false);
  expect(all.some(node => node.type === NativeButton && node.props.onPress === h.onRefresh)).toBe(true);
  all.find(node => node.type === NativeButton && node.props.label === 'Apply')?.props.onPress?.();
  expect(h.onApply).toHaveBeenCalledWith(
    expect.objectContaining({
      showHidden: true,
      hideDust: false,
      hiddenAssets: new Set([usd]),
      quantity: {},
    }),
  );
});

it('offers explicit all/unset choices while direction and comparison remain independently toggleable', () => {
  const h = harness({
    ...defaults,
    type: 'payments',
    quantity: { direction: 'incoming', asset: usd, comparison: 'at-most', amount: '25' },
  });
  h.select('Type', 'all');
  h.select('Asset', '');
  h.select('Quantity', '');
  expect(h.draft()).toMatchObject({ type: 'all', quantity: { direction: 'incoming', comparison: 'at-most' } });
  expect(h.draft().quantity.asset).toBeUndefined();
  expect(h.draft().quantity.amount).toBeUndefined();
  const all = nodes(h.draw());
  all.find(node => node.type === SelectableChip && node.props.label === 'Received')?.props.onPress?.();
  expect(h.draft().quantity.direction).toBeUndefined();
  expect(h.draft().quantity.comparison).toBe('at-most');
});

it('preserves same-code issuer identity and shows a selected asset even after loaded rows change', () => {
  const h = harness({ ...defaults, quantity: { asset: usd } }, ['native:XLM', otherUsd]);
  const field = selectField(h.draw(), 'Asset');
  expect(field.props.value).toBe(usd);
  expect(field.props.options).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ value: usd, label: 'USD', description: 'GISSUER' }),
      expect.objectContaining({ value: otherUsd, label: 'USD', description: 'GOTHERISSUER' }),
      expect.objectContaining({ value: '' }),
    ]),
  );
  field.props.onValueChange(otherUsd);
  expect(h.draft().quantity.asset).toBe(otherUsd);
});
