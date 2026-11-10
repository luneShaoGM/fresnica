import React, { useState } from 'react';
import { Switch } from 'react-native';
import { BottomSheet } from '@ui/components';
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
  accessibilityState?: { selected?: boolean; checked?: boolean };
  onPress?: () => void;
  onClose?: () => void;
  onValueChange?: (value: boolean) => void;
  value?: boolean;
  presentation?: string;
};
function find(
  root: React.ReactNode,
  test: (node: React.ReactElement<Props>) => boolean,
): React.ReactElement<Props> | undefined {
  if (!React.isValidElement<Props>(root)) return undefined;
  if (test(root)) return root;
  for (const child of React.Children.toArray(root.props.children)) {
    const found = find(child, test);
    if (found) return found;
  }
  return undefined;
}
it('keeps edits draft until Apply; cancel/back preserve filters and image privacy is set elsewhere', () => {
  const identity = JSON.stringify(['USD', 'GISSUER']);
  const initial: ActivityDisplayFilters = {
    type: 'all',
    showHidden: false,
    showFailed: false,
    hiddenAssets: new Set(),
    quantity: {},
  };
  let draft = initial;
  (useState as jest.Mock).mockImplementation(() => [
    draft,
    (value: ActivityDisplayFilters | ((previous: ActivityDisplayFilters) => ActivityDisplayFilters)) => {
      draft = typeof value === 'function' ? value(draft) : value;
    },
  ]);
  const onApply = jest.fn();
  const onClose = jest.fn();
  const props = {
    initial,
    assets: ['native:XLM', identity],
    onClose,
    onApply,
    onRefresh: jest.fn(),
  };
  let root = ActivityFiltersSheet(props);
  find(
    root,
    node => node.type === Switch && node.props.accessibilityLabel === 'Show hidden activity',
  )?.props.onValueChange?.(true);
  find(root, node => node.props.accessibilityLabel === `Hide USD · GISSUER`)?.props.onPress?.();
  expect(initial.hiddenAssets.size).toBe(0);
  expect(initial.showHidden).toBe(false);
  expect(onApply).not.toHaveBeenCalled();
  find(root, node => node.type === BottomSheet)?.props.onClose?.();
  expect(onClose).toHaveBeenCalledTimes(1);
  expect(onApply).not.toHaveBeenCalled();
  root = ActivityFiltersSheet(props);
  expect(find(root, node => node.type === NativeButton && node.props.onPress === props.onRefresh)).toBeDefined();
  find(root, node => node.type === NativeButton && node.props.label === 'Apply')?.props.onPress?.();
  expect(onApply).toHaveBeenCalledWith(
    expect.objectContaining({ showHidden: true, hiddenAssets: new Set([identity]) }),
  );
  expect(find(root, node => node.props.accessibilityLabel === 'Hide XLM · ')).toBeUndefined();
});
it('applies independent inclusive quantity controls and permits deselection without selecting another item', () => {
  let draft: ActivityDisplayFilters = {
    type: 'all',
    showHidden: false,
    showFailed: false,
    hiddenAssets: new Set(),
    quantity: { comparison: 'at-most', amount: '25' },
  };
  (useState as jest.Mock).mockImplementation(() => [
    draft,
    (value: (previous: ActivityDisplayFilters) => ActivityDisplayFilters) => {
      draft = value(draft);
    },
  ]);
  const props = {
    initial: draft,
    assets: [],
    onClose: jest.fn(),
    onApply: jest.fn(),
    onRefresh: jest.fn(),
  };
  const root = ActivityFiltersSheet(props);
  const amount = find(
    root,
    node =>
      node.props.accessibilityState?.selected === true &&
      Boolean(node.props.children) &&
      React.Children.toArray(node.props.children).some(
        child => React.isValidElement<Props>(child) && child.props.children === '25',
      ),
  );
  expect(amount).toBeDefined();
  amount?.props.onPress?.();
  expect(draft.quantity).toEqual({ comparison: 'at-most', amount: undefined });
});
