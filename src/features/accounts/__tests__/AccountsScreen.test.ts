import React, { useState } from 'react';
import { AccessibilityInfo, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';

import { defaultTheme } from '@ui/theme';
import { NativeButton } from '@ui/components/NativeButton';

import type { AccountRecord } from '../../../capabilities/account/types';
import { AccountsScreen } from '../AccountsScreen';
import { createStyles } from '../styles';

jest.mock('@fresnica/ui-native', () => ({ Button: () => null }));

jest.mock('react', () => {
  const actual = jest.requireActual('react') as typeof import('react');
  return { ...actual, useState: jest.fn() };
});

jest.mock('@ui/theme', () => {
  const actual = jest.requireActual('@ui/theme') as typeof import('@ui/theme');
  return {
    ...actual,
    useThemedStyles: (factory: (theme: typeof actual.defaultTheme) => unknown) => factory(actual.defaultTheme),
  };
});

jest.mock('../../../locale', () => ({
  useLocalization: () => ({
    t: (key: string) =>
      ({
        'accounts.sort.moveUp': 'Move up',
        'accounts.sort.moveDown': 'Move down',
        'accounts.sort.error': 'Unable to reorder accounts.',
      })[key] ?? key,
  }),
}));

const mockedUseState = useState as unknown as jest.Mock;

function account(id: string): AccountRecord {
  const now = new Date('2026-09-11T00:00:00.000Z');
  return {
    id,
    address: `G${id}`,
    identityKind: 'classic',
    networkId: 'stellar-testnet',
    label: id,
    sortOrder: 0,
    hidden: false,
    createdAt: now,
    updatedAt: now,
  };
}

type TestElementProps = Readonly<{
  accessibilityLabel?: string;
  accessibilityLiveRegion?: string;
  label?: string;
  size?: string;
  variant?: string;
  icon?: React.ReactNode;
  accessibilityState?: Readonly<{ disabled?: boolean }>;
  children?: React.ReactNode;
  disabled?: boolean;
  onPress?: unknown;
  style?: unknown;
  showsVerticalScrollIndicator?: boolean;
}>;

function elementsWithLabel(root: React.ReactNode, label: string): React.ReactElement<TestElementProps>[] {
  const matches: React.ReactElement<TestElementProps>[] = [];
  visit(root, element => {
    if (element.props.accessibilityLabel === label) matches.push(element);
  });
  return matches;
}

function visit(node: React.ReactNode, callback: (element: React.ReactElement<TestElementProps>) => void): void {
  if (!React.isValidElement<TestElementProps>(node)) return;

  callback(node);
  React.Children.forEach(node.props.children, child => visit(child, callback));
}

describe('AccountsScreen sort controls', () => {
  beforeEach(() => {
    mockedUseState.mockReset();
    mockedUseState.mockImplementation((initial: unknown) => [initial, jest.fn()]);
    jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('keeps Accounts Back wired to onBack and centers the title between identical flexible header sides', () => {
    const onBack = jest.fn();
    const onOpenAccount = jest.fn();
    const onAddAccount = jest.fn();
    const onMoveAccount = jest.fn();
    const styles = createStyles(defaultTheme);

    for (const accounts of [[], [account('visible'), { ...account('hidden'), hidden: true }]]) {
      const root = AccountsScreen({ accounts, onBack, onOpenAccount, onAddAccount, onMoveAccount });
      const header = React.Children.toArray(root.props.children).find(
        (child): child is React.ReactElement<TestElementProps> =>
          React.isValidElement<TestElementProps>(child) && child.type === View,
      );
      expect(header?.props.style).toEqual(styles.header);

      const columns = React.Children.toArray(header?.props.children).filter(
        (child): child is React.ReactElement<TestElementProps> => React.isValidElement<TestElementProps>(child),
      );
      expect(columns).toHaveLength(3);
      const [left, title, right] = columns;
      expect(left?.type).toBe(View);
      expect(title?.type).toBe(Text);
      expect(title?.props.children).toBe('Accounts');
      expect(right?.type).toBe(View);
      expect(left?.props.style).toEqual(styles.headerSide);
      expect(right?.props.style).toEqual(styles.headerSide);
      expect(styles.headerSide).toMatchObject({ flex: 1, alignItems: 'flex-start' });
      expect(styles.header).not.toHaveProperty('justifyContent', 'space-between');
      expect(styles.header.minHeight).toBe(58);

      const nativeBack = React.Children.toArray(left?.props.children).filter(
        (child): child is React.ReactElement<TestElementProps> =>
          React.isValidElement<TestElementProps>(child) && child.type === NativeButton,
      );
      expect(nativeBack).toHaveLength(1);
      expect(nativeBack[0]?.props).toMatchObject({ label: 'Back', size: 'sm', variant: 'quiet', onPress: onBack });
      expect(elementsWithLabel(root, 'Back')).toHaveLength(0);

      const nativeButtons: string[] = [];
      let accountsScroller: React.ReactElement<TestElementProps> | undefined;
      visit(root, element => {
        if (element.type === NativeButton && element.props.label) nativeButtons.push(element.props.label);
        if (element.type === ScrollView) accountsScroller = element;
      });
      expect(nativeButtons).toEqual(['Back', 'Add account']);
      expect(accountsScroller?.props.showsVerticalScrollIndicator).toBe(false);
      (nativeBack[0]?.props.onPress as () => void)();
    }

    expect(onBack).toHaveBeenCalledTimes(2);
    expect(onOpenAccount).not.toHaveBeenCalled();
    expect(onAddAccount).not.toHaveBeenCalled();
    expect(onMoveAccount).not.toHaveBeenCalled();
  });

  it('keeps Add account available as a large native primary button for empty and hidden account lists', () => {
    const onAddAccount = jest.fn();
    const onOpenAccount = jest.fn();
    const onMoveAccount = jest.fn();
    const onBack = jest.fn();

    for (const accounts of [[], [account('visible'), { ...account('hidden'), hidden: true }]]) {
      const root = AccountsScreen({ accounts, onOpenAccount, onAddAccount, onMoveAccount, onBack });
      let add: React.ReactElement<TestElementProps> | undefined;
      visit(root, element => {
        if (element.type === NativeButton) add = element;
      });

      expect(add?.props).toMatchObject({
        label: 'Add account',
        size: 'lg',
        variant: 'primary',
        onPress: onAddAccount,
      });
      const icon = add?.props.icon;
      expect(React.isValidElement(icon)).toBe(true);
      if (React.isValidElement<{ children?: React.ReactNode }>(icon)) {
        expect(icon.props.children).toBe('＋');
      }

      const parentElements: React.ReactElement<TestElementProps>[] = [];
      visit(root, element => {
        if (
          React.Children.toArray(element.props.children).some(
            child =>
              React.isValidElement<{ label?: string }>(child) &&
              child.type === NativeButton &&
              child.props.label === 'Add account',
          )
        )
          parentElements.push(element);
      });
      expect(parentElements).toHaveLength(1);
      expect(StyleSheet.flatten(parentElements[0]?.props.style as StyleProp<ViewStyle>)).toMatchObject({
        marginHorizontal: 20,
        marginTop: 4,
      });

      (add?.props.onPress as () => void)();
    }

    expect(onAddAccount).toHaveBeenCalledTimes(2);
    expect(onOpenAccount).not.toHaveBeenCalled();
    expect(onMoveAccount).not.toHaveBeenCalled();
    expect(onBack).not.toHaveBeenCalled();
  });

  it('exposes disabled move boundaries to assistive technology and visually dims them', () => {
    const root = AccountsScreen({
      accounts: [account('a'), account('b')],
      onOpenAccount: jest.fn(),
      onAddAccount: jest.fn(),
      onMoveAccount: jest.fn(),
      onBack: jest.fn(),
    });
    const [firstMoveUp, secondMoveUp] = elementsWithLabel(root, 'Move up');
    const [, lastMoveDown] = elementsWithLabel(root, 'Move down');

    expect(firstMoveUp.props).toMatchObject({ disabled: true, accessibilityState: { disabled: true } });
    expect(secondMoveUp.props).toMatchObject({ disabled: false, accessibilityState: { disabled: false } });
    expect(lastMoveDown.props).toMatchObject({ disabled: true, accessibilityState: { disabled: true } });

    const style = firstMoveUp.props.style as (state: { pressed: boolean }) => StyleProp<ViewStyle>;
    expect(StyleSheet.flatten(style({ pressed: false }))).toMatchObject({
      opacity: 0.45,
      backgroundColor: defaultTheme.colors.surfaceMuted,
    });
  });

  it('keeps the rendered reorder error passive to avoid a second TalkBack announcement', () => {
    mockedUseState.mockReset();
    mockedUseState.mockReturnValueOnce([undefined, jest.fn()]).mockReturnValueOnce([true, jest.fn()]);

    const root = AccountsScreen({
      accounts: [account('a'), account('b')],
      onOpenAccount: jest.fn(),
      onAddAccount: jest.fn(),
      onMoveAccount: jest.fn(),
      onBack: jest.fn(),
    });
    let errorElement: React.ReactElement<TestElementProps> | undefined;
    visit(root, element => {
      if (element.props.children === 'Unable to reorder accounts.') errorElement = element;
    });

    expect(errorElement).toBeDefined();
    expect(errorElement?.props.accessibilityLiveRegion).toBeUndefined();
  });

  it('announces an asynchronous reorder failure', async () => {
    const onMoveAccount = jest.fn().mockRejectedValue(new Error('write-failed'));
    const root = AccountsScreen({
      accounts: [account('a'), account('b')],
      onOpenAccount: jest.fn(),
      onAddAccount: jest.fn(),
      onMoveAccount,
      onBack: jest.fn(),
    });
    const [firstMoveDown] = elementsWithLabel(root, 'Move down');
    const onPress = firstMoveDown.props.onPress as () => Promise<void>;

    await onPress();

    expect(onMoveAccount).toHaveBeenCalledWith('a', 'down');
    expect(AccessibilityInfo.announceForAccessibility).toHaveBeenCalledWith('Unable to reorder accounts.');
  });
});
