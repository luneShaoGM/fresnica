import React from 'react';

import type { AccountRecord } from '@capabilities/account/types';

import type { AppServices } from '../../createAppServices';
import { MainTabsNavigator } from '../MainTabsNavigator';
import { SettingsStackNavigator } from '../SettingsStackNavigator';

jest.mock('react', () => {
  const actual = jest.requireActual('react') as typeof import('react');
  return {
    ...actual,
    useMemo: (factory: () => unknown) => factory(),
  };
});

jest.mock('@react-navigation/bottom-tabs', () => ({
  createBottomTabNavigator: () => ({ Navigator: () => null, Screen: () => null }),
}));

jest.mock('../ActivityStackNavigator', () => ({ ActivityStackNavigator: () => null }));
jest.mock('../DAppsStackNavigator', () => ({ DAppsStackNavigator: () => null }));
jest.mock('../HomeStackNavigator', () => ({ HomeStackNavigator: () => null }));
jest.mock('../MainTabBar', () => ({ MainTabBar: () => null }));
jest.mock('../SettingsStackNavigator', () => ({ SettingsStackNavigator: () => null }));

function account(id: string, hidden: boolean, networkId: string): AccountRecord {
  const now = new Date('2026-09-15T00:00:00.000Z');
  return {
    id,
    address: `G${id}`,
    identityKind: 'classic',
    networkId,
    label: id,
    sortOrder: 0,
    hidden,
    createdAt: now,
    updatedAt: now,
  };
}

describe('MainTabsNavigator empty-network recovery', () => {
  it('renders current-network account settings instead of resolving a missing selection', () => {
    const hiddenTestnet = account('hidden-testnet', true, 'stellar-testnet');
    const visibleMainnet = account('visible-mainnet', false, 'stellar-mainnet');
    const onAccountsChanged = jest.fn();
    const services = {
      onboarding: { networkId: 'stellar-testnet' },
    } as AppServices;

    const result = MainTabsNavigator({
      accounts: [visibleMainnet, hiddenTestnet],
      services,
      onAccountsChanged,
    });

    expect(React.isValidElement(result)).toBe(true);
    expect(result.type).toBe(SettingsStackNavigator);
    expect(result.props.accounts).toEqual([hiddenTestnet]);
    expect(result.props.onAccountsChanged).toBe(onAccountsChanged);
  });
});
