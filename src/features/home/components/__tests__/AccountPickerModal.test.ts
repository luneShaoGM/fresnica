import React, { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

import type { AccountRecord } from '@capabilities/account/types';

import { AccountPickerModal } from '../AccountPickerModal';

jest.mock('react', () => {
  const actual = jest.requireActual('react') as typeof import('react');
  return {
    ...actual,
    useEffect: jest.fn(),
    useState: jest.fn(),
  };
});

jest.mock('@ui/theme', () => {
  const actual = jest.requireActual('@ui/theme') as typeof import('@ui/theme');
  return {
    ...actual,
    useThemedStyles: (factory: (theme: typeof actual.defaultTheme) => unknown) => factory(actual.defaultTheme),
  };
});

jest.mock('../../../../locale', () => ({
  useLocalization: () => ({
    t: (key: string) =>
      ({
        'accounts.select.title': 'Select account',
        'accounts.select.description': 'Choose an account.',
        'accounts.select.current': 'Current',
        'accounts.select.error': 'Unable to save the default account.',
      })[key] ?? key,
  }),
}));

const mockedUseEffect = useEffect as unknown as jest.Mock;
const mockedUseState = useState as unknown as jest.Mock;

function account(id: string, sortOrder: number): AccountRecord {
  const now = new Date('2026-09-14T00:00:00.000Z');
  return {
    id,
    address: `G${id}`,
    identityKind: 'classic',
    networkId: 'stellar-testnet',
    label: id,
    sortOrder,
    hidden: false,
    createdAt: now,
    updatedAt: now,
  };
}

type TestElementProps = Readonly<{
  accessibilityLabel?: string;
  accessibilityState?: Readonly<{ disabled?: boolean; selected?: boolean }>;
  children?: React.ReactNode;
  onPress?: unknown;
}>;

function findByLabel(root: React.ReactNode, label: string): React.ReactElement<TestElementProps> {
  let match: React.ReactElement<TestElementProps> | undefined;
  visit(root, element => {
    if (element.props.accessibilityLabel === label) match = element;
  });
  if (!match) throw new Error(`missing element: ${label}`);
  return match;
}

function visit(node: React.ReactNode, callback: (element: React.ReactElement<TestElementProps>) => void): void {
  if (!React.isValidElement<TestElementProps>(node)) return;
  callback(node);
  React.Children.forEach(node.props.children, child => visit(child, callback));
}

describe('AccountPickerModal', () => {
  beforeEach(() => {
    mockedUseEffect.mockReset();
    mockedUseEffect.mockImplementation(() => undefined);
    mockedUseState.mockReset();
    mockedUseState.mockImplementation((initial: unknown) => [initial, jest.fn()]);
    jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('marks the selected account and allows direct selection of another account', async () => {
    const onSelectAccount = jest.fn().mockResolvedValue(undefined);
    const onRequestClose = jest.fn();
    const root = AccountPickerModal({
      accounts: [account('one', 0), account('two', 1)],
      selectedAccountId: 'one',
      visible: true,
      onRequestClose,
      onSelectAccount,
    });

    expect(findByLabel(root, 'one').props.accessibilityState).toMatchObject({ selected: true });
    const second = findByLabel(root, 'two');
    expect(second.props.accessibilityState).toMatchObject({ selected: false });

    await (second.props.onPress as () => Promise<void>)();

    expect(onSelectAccount).toHaveBeenCalledWith('two');
    expect(onRequestClose).toHaveBeenCalledTimes(1);
  });

  it('retries default persistence when the already-current account is selected explicitly', async () => {
    const onSelectAccount = jest.fn().mockRejectedValue(new Error('write-failed'));
    const onRequestClose = jest.fn();
    const root = AccountPickerModal({
      accounts: [account('one', 0), account('two', 1)],
      selectedAccountId: 'one',
      visible: true,
      onRequestClose,
      onSelectAccount,
    });

    await (findByLabel(root, 'one').props.onPress as () => Promise<void>)();

    expect(onSelectAccount).toHaveBeenCalledWith('one');
    expect(onRequestClose).not.toHaveBeenCalled();
    expect(AccessibilityInfo.announceForAccessibility).toHaveBeenCalledWith('Unable to save the default account.');
  });

  it('keeps the picker open and announces when default persistence fails', async () => {
    const onSelectAccount = jest.fn().mockRejectedValue(new Error('write-failed'));
    const onRequestClose = jest.fn();
    const root = AccountPickerModal({
      accounts: [account('one', 0), account('two', 1)],
      selectedAccountId: 'one',
      visible: true,
      onRequestClose,
      onSelectAccount,
    });

    await (findByLabel(root, 'two').props.onPress as () => Promise<void>)();

    expect(onRequestClose).not.toHaveBeenCalled();
    expect(AccessibilityInfo.announceForAccessibility).toHaveBeenCalledWith('Unable to save the default account.');
  });
});
