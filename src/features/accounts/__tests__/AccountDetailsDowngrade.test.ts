import React from 'react';
import { defaultTheme } from '@ui/theme';
import { Button } from '@ui/components';
import { AccountDetailsScreen } from '../AccountDetailsScreen';
import type { AccountRecord } from '../../../capabilities/account/types';

jest.mock('react', () => {
  const actual = jest.requireActual('react') as typeof import('react');
  return {
    ...actual,
    useState: (value: unknown) => [value, jest.fn()],
    useRef: (value: unknown) => ({ current: value }),
    useEffect: () => undefined,
  };
});
jest.mock('@ui/theme', () => {
  const actual = jest.requireActual('@ui/theme') as typeof import('@ui/theme');
  return {
    ...actual,
    useThemedStyles: (factory: (theme: typeof defaultTheme) => unknown) => factory(actual.defaultTheme),
  };
});
jest.mock('../../../locale', () => ({ useLocalization: () => ({ t: (key: string) => key }) }));

const account: AccountRecord = {
  id: 'a',
  address: 'Ga',
  identityKind: 'classic',
  networkId: 'stellar-testnet',
  label: 'Keep',
  sortOrder: 0,
  hidden: false,
  createdAt: new Date('2026-11-24'),
  updatedAt: new Date('2026-11-24'),
};

function labels(node: React.ReactNode): string[] {
  if (!React.isValidElement<{ children?: React.ReactNode; label?: string }>(node)) return [];
  return [
    node.type === Button ? (node.props.label ?? '') : '',
    ...React.Children.toArray(node.props.children).flatMap(labels),
  ];
}

it('offers the downgrade on Full Access and removes signing actions after read-only refresh', () => {
  const props = {
    account,
    canHide: true,
    active: true,
    onSend: jest.fn(),
    onManageAssets: jest.fn(),
    onRename: jest.fn(),
    onToggleHidden: jest.fn(),
    onDelete: jest.fn(),
    onDowngrade: jest.fn(),
    copyPublicText: jest.fn(),
    onBack: jest.fn(),
  };
  const full = AccountDetailsScreen({ ...props, canDowngrade: true, readOnly: false });
  expect(labels(full)).toContain('accounts.downgrade.open');
  const readOnly = AccountDetailsScreen({ ...props, canDowngrade: false, readOnly: true });
  expect(labels(readOnly)).not.toContain('accounts.downgrade.open');
  expect(JSON.stringify(readOnly)).not.toContain('Manage assets');
});
