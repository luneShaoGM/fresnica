import React from 'react';
import { AssetCategoryDialog } from '../AssetCategoryDialog';

jest.mock('@ui/components', () => ({ AppModal: () => null }));
jest.mock('@ui/theme', () => {
  const actual = jest.requireActual('@ui/theme');
  return { ...actual, useThemedStyles: (factory: (theme: unknown) => unknown) => factory(actual.defaultTheme) };
});
jest.mock('../../../../locale', () => ({ useLocalization: () => ({ t: (key: string) => key }) }));

type Option = React.ReactElement<{
  accessibilityLabel: string;
  accessibilityRole: string;
  accessibilityState: { selected?: boolean };
  onPress: () => void;
}>;
function options(showClaimable: boolean, current: 'tokens' | 'claimable', onSelect = jest.fn()) {
  const root = AssetCategoryDialog({
    visible: true,
    current,
    showClaimable,
    onClose: jest.fn(),
    onSelect,
  });
  const nodes = React.Children.toArray(root.props.children).filter(
    child => React.isValidElement<{ accessibilityRole?: string }>(child) && child.props.accessibilityRole === 'radio',
  ) as Option[];
  return { root, nodes, onSelect };
}

describe('Stellar-style Home asset category chooser', () => {
  it('shows only Assets when the current network/account has never seen Claimable and Developer Mode is off', () => {
    const { root, nodes } = options(false, 'tokens');
    expect(root.props.visible).toBe(true);
    expect(nodes.map(node => node.props.accessibilityLabel)).toEqual(['claimable.category.assets']);
    expect(nodes[0].props.accessibilityState.selected).toBe(true);
  });

  it('selects Claimable in place; never offers unimplemented LP actions', () => {
    const { nodes, onSelect } = options(true, 'tokens');
    expect(nodes.map(node => node.props.accessibilityLabel)).toEqual([
      'claimable.category.assets',
      'claimable.category.claimable',
    ]);
    expect(nodes[1].props.accessibilityState.selected).toBe(false);
    nodes[1].props.onPress();
    expect(onSelect).toHaveBeenCalledWith('claimable');
  });

  it('shows a dismiss control without switching the current category', () => {
    const close = jest.fn();
    const root = AssetCategoryDialog({
      visible: true,
      current: 'claimable',
      showClaimable: true,
      onClose: close,
      onSelect: jest.fn(),
    });
    const heading = React.Children.toArray(root.props.children).find(
      child => React.isValidElement<{ style?: unknown }>(child) && child.props.style !== undefined,
    ) as React.ReactElement<{ children?: React.ReactNode }>;
    const button = React.Children.toArray(heading.props.children).find(
      child =>
        React.isValidElement<{ accessibilityLabel?: string }>(child) &&
        child.props.accessibilityLabel === 'common.close',
    ) as React.ReactElement<{ onPress: () => void }>;
    expect(button).toBeDefined();
    button.props.onPress();
    expect(close).toHaveBeenCalledTimes(1);
  });

  it('returns from Claimable to Assets without navigating to a new page', () => {
    const { nodes, onSelect } = options(true, 'claimable');
    expect(nodes[1].props.accessibilityState.selected).toBe(true);
    nodes[0].props.onPress();
    expect(onSelect).toHaveBeenCalledWith('tokens');
  });
});
