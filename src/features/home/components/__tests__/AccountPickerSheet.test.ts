import React, { useEffect, useState } from 'react';
import { AccessibilityInfo, ScrollView } from 'react-native';

import type { AccountRecord } from '@capabilities/account/types';
import { BottomSheet } from '@ui/components/BottomSheet';
import { NativeButton } from '@ui/components/NativeButton';

import { AccountPickerSheet } from '../AccountPickerSheet';

jest.mock('react', () => {
  const actual = jest.requireActual('react') as typeof import('react');
  return {
    ...actual,
    useEffect: jest.fn(),
    useRef: (initial: unknown) => ({ current: initial }),
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
  useLocalization: () => jest.requireActual('../../../../locale/localization').createLocalization('en'),
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

function renderPicker(overrides: Partial<React.ComponentProps<typeof AccountPickerSheet>> = {}) {
  const props: React.ComponentProps<typeof AccountPickerSheet> = {
    accounts: [account('one', 0), account('two', 1)],
    selectedAccountId: 'one',
    visible: true,
    isWatchOnlyAccount: id => id === 'two',
    onRequestClose: jest.fn(),
    onSelectAccount: jest.fn(),
    onAddAccount: jest.fn(),
    ...overrides,
  };
  return { root: AccountPickerSheet(props), ...props };
}

function addButton(root: React.ReactNode): React.ReactElement<React.ComponentProps<typeof NativeButton>> {
  let match: React.ReactElement<TestElementProps> | undefined;
  visit(root, element => {
    if (element.type === NativeButton) match = element;
  });
  if (!match) throw new Error('missing add account button');
  return match as React.ReactElement<React.ComponentProps<typeof NativeButton>>;
}

const selectionError = 'Unable to save the default account. Your current account was not changed.';

describe('AccountPickerSheet', () => {
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
    const { root, onRequestClose, onSelectAccount } = renderPicker();

    expect(root.type).toBe(BottomSheet);
    expect(findByLabel(root, 'one, Classic account').props.accessibilityState).toMatchObject({ selected: true });
    const second = findByLabel(root, 'two, Watch-only account');
    expect(second.props.accessibilityState).toMatchObject({ selected: false });

    await (second.props.onPress as () => Promise<void>)();

    expect(onSelectAccount).toHaveBeenCalledWith('two');
    expect(onRequestClose).toHaveBeenCalledTimes(1);
  });

  it('retries default persistence when the already-current account is selected explicitly', async () => {
    const onSelectAccount = jest.fn().mockRejectedValue(new Error('write-failed'));
    const { root, onRequestClose } = renderPicker({ onSelectAccount });

    await (findByLabel(root, 'one, Classic account').props.onPress as () => Promise<void>)();

    expect(onSelectAccount).toHaveBeenCalledWith('one');
    expect(onRequestClose).not.toHaveBeenCalled();
    expect(AccessibilityInfo.announceForAccessibility).toHaveBeenCalledWith(selectionError);
  });

  it('keeps the sheet open after a failed save and allows a retry', async () => {
    const onSelectAccount = jest.fn().mockRejectedValueOnce(new Error('write-failed')).mockResolvedValueOnce(undefined);
    const { root, onRequestClose } = renderPicker({ onSelectAccount });

    const select = findByLabel(root, 'two, Watch-only account').props.onPress as () => Promise<void>;
    await select();

    expect(onRequestClose).not.toHaveBeenCalled();
    expect(AccessibilityInfo.announceForAccessibility).toHaveBeenCalledWith(selectionError);
    await select();
    expect(onRequestClose).toHaveBeenCalledTimes(1);
  });

  it('shows the localized count and add action above the list of typed accounts', () => {
    const contract = { ...account('three', 2), address: 'CTHREE', identityKind: 'contract' } as const;
    const { root } = renderPicker({ accounts: [account('one', 0), account('two', 1), contract] });
    const button = addButton(root);
    const scroller = React.Children.toArray(root.props.children.props.children).find(
      element => React.isValidElement(element) && element.type === ScrollView,
    );
    const content: React.ReactNode[] = [];
    visit(root, element => content.push(element.props.children));
    expect(content).toEqual(expect.arrayContaining(['3 accounts']));
    expect(button.props.label).toBe('Add account');
    expect(scroller).toBeDefined();
    visit(scroller, element => expect(element.type).not.toBe(NativeButton));
    for (const [label, kind] of [
      ['one', 'Classic account'],
      ['two', 'Watch-only account'],
      ['three', 'Contract account'],
    ]) {
      const row = findByLabel(root, `${label}, ${kind}`);
      const rowContent: React.ReactNode[] = [];
      visit(row, element => rowContent.push(element.props.children));
      expect(rowContent).toContain(kind);
    }
  });

  it('dismisses before opening Add account and handles a repeated press once', () => {
    const calls: string[] = [];
    const { root, onSelectAccount } = renderPicker({
      onRequestClose: () => calls.push('close'),
      onAddAccount: () => calls.push('add'),
    });
    const add = addButton(root).props.onPress as () => void;
    add();
    add();
    expect(calls).toEqual(['close', 'add']);
    expect(onSelectAccount).not.toHaveBeenCalled();
  });

  it('ignores another selection, add action, and dismissal while saving', async () => {
    let finishSaving!: () => void;
    const saving = new Promise<void>(resolve => {
      finishSaving = resolve;
    });
    const { root, onSelectAccount, onRequestClose, onAddAccount } = renderPicker({
      onSelectAccount: jest.fn(() => saving),
    });
    const pending = (findByLabel(root, 'two, Watch-only account').props.onPress as () => Promise<void>)();
    await (findByLabel(root, 'one, Classic account').props.onPress as () => Promise<void>)();
    (addButton(root).props.onPress as () => void)();
    root.props.onClose();
    expect(onRequestClose).not.toHaveBeenCalled();
    expect(onAddAccount).not.toHaveBeenCalled();
    expect(onSelectAccount).toHaveBeenCalledTimes(1);
    finishSaving();
    await pending;
    expect(onRequestClose).toHaveBeenCalledTimes(1);
  });
});
