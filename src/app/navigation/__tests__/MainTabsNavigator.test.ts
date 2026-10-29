import React from 'react';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import type { MainTabBarProps } from '../MainTabBar';

import type { AccountRecord } from '@capabilities/account/types';

import type { AppServices } from '../../createAppServices';
import { MainTabsNavigator } from '../MainTabsNavigator';
import { StateView } from '@ui/components';
import { MainTabBar } from '../MainTabBar';
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

jest.mock('@ui/components', () => ({ Screen: 'Screen', StateView: 'StateView' }));
jest.mock('../../../locale', () => ({
  useLocalization: () => jest.requireActual('../../../locale/localization').createLocalization('en'),
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

type RenderedScreenProps = {
  children?: React.ReactNode;
  accounts?: readonly AccountRecord[];
  onAccountsChanged?: () => void;
  description?: string;
};
type TabTreeProps = {
  children: React.ReactNode;
  tabBar: (props: BottomTabBarProps) => React.ReactElement<MainTabBarProps>;
};
type RouteProps = {
  name: string;
  children: (context: { navigation: { navigate: jest.Mock } }) => React.ReactElement<RenderedScreenProps>;
};
function emptyShell(accounts: AccountRecord[]) {
  const onAccountsChanged = jest.fn();
  const services = {
    onboarding: { networkId: 'stellar-testnet' },
    networkProfile: { isMainnet: false },
  } as AppServices;
  const result = MainTabsNavigator({ accounts, services, onAccountsChanged });
  const render = result.type as (props: typeof result.props) => React.ReactElement<TabTreeProps>;
  const tree = render(result.props);
  const screens = React.Children.toArray(tree.props.children).filter((n): n is React.ReactElement<RouteProps> =>
    React.isValidElement<RouteProps>(n),
  );
  const navigation = { navigate: jest.fn() };
  const screen = (name: string) => screens.find(n => n.props.name === name)!.props.children({ navigation });
  return { result, tree, screens, screen, navigation, onAccountsChanged };
}

describe('MainTabsNavigator empty-network recovery', () => {
  it.each([{ currentAccounts: [] }, { currentAccounts: [account('hidden-testnet', true, 'stellar-testnet')] }])(
    'keeps all tab roots for an empty or all-hidden partition without borrowing a foreign account',
    ({ currentAccounts }) => {
      const shell = emptyShell([account('visible-mainnet', false, 'stellar-mainnet'), ...currentAccounts]);
      expect(shell.screens.map(n => n.props.name)).toEqual(['home', 'activity', 'dapps', 'settings']);
      const settings = shell.screen('settings');
      expect(settings.type).toBe(SettingsStackNavigator);
      expect(settings.props.accounts).toEqual(currentAccounts);
      expect(settings.props.onAccountsChanged).toBe(shell.onAccountsChanged);
      const bar = shell.tree.props.tabBar({} as BottomTabBarProps);
      expect(bar.type).toBe(MainTabBar);
      expect(bar.props.selectedAccountId).toBeUndefined();
      expect(bar.props.actionAvailability).toEqual({ send: false, swap: false, request: false });
      for (const tab of ['home', 'activity']) {
        const screen = shell.screen(tab);
        expect(screen.props.description).toBe('Stellar Testnet');
        const state = React.Children.only(screen.props.children) as React.ReactElement<{
          onAction: () => void;
          kind: string;
        }>;
        expect(state.type).toBe(StateView);
        expect(state.props.kind).toBe('empty');
        state.props.onAction();
        expect(shell.navigation.navigate).toHaveBeenLastCalledWith('settings', { screen: 'accounts-settings' });
      }
    },
  );
  it('returns to the existing selected-account shell when the current partition gains a visible account', () => {
    const current = account('testnet', false, 'stellar-testnet');
    const foreign = account('mainnet', false, 'stellar-mainnet');
    const services = { onboarding: { networkId: 'stellar-testnet' } } as AppServices;
    const result = MainTabsNavigator({ accounts: [current, foreign], services, onAccountsChanged: jest.fn() });
    expect(result.props.selectableAccounts).toEqual([current]);
    expect(result.props.networkId).toBe('stellar-testnet');
  });
});
