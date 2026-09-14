import React, { useState } from 'react';
import { AccessibilityInfo, StyleSheet } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';

import { defaultTheme } from '@ui/theme';

import type { AccountRecord } from '../../../capabilities/account/types';
import { AccountsScreen } from '../AccountsScreen';

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
  accessibilityState?: Readonly<{ disabled?: boolean }>;
  children?: React.ReactNode;
  disabled?: boolean;
  onPress?: unknown;
  style?: unknown;
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
