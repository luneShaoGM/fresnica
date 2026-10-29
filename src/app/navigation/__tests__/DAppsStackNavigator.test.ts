import React from 'react';
import { Platform } from 'react-native';

import type { DappCatalogPort } from '../../../capabilities/dapp-catalog/catalog';
import type { LedgerReadRuntime } from '../../readModels/LedgerReadRuntime';

jest.mock('@react-navigation/native-stack', () => ({
  createNativeStackNavigator: () => ({ Navigator: 'StackNavigator', Screen: 'StackScreen' }),
}));
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: jest.fn() }),
  useIsFocused: () => true,
}));
jest.mock('@features/dapps/screens/DAppsScreen', () => ({ DAppsScreen: () => null }));
jest.mock('@features/dapps/screens/DappBrowserScreen/DappBrowserScreen', () => ({ DappBrowserScreen: () => null }));
jest.mock('../../../platform/dapp-browser/SecureDappWebView', () => ({ SecureDappWebView: () => null }));
jest.mock('../../../platform/dapp-browser/secureNonce', () => ({ createDappBridgeNonce: () => 'a'.repeat(64) }));

const react = jest.requireActual<typeof import('react')>('react');
jest
  .spyOn(react, 'useSyncExternalStore')
  .mockImplementation(((_subscribe: unknown, get: () => unknown) => get()) as typeof react.useSyncExternalStore);

const { DAppsStackNavigator } = require('../DAppsStackNavigator') as typeof import('../DAppsStackNavigator');

const originalOS = Platform.OS;
afterEach(() => Object.defineProperty(Platform, 'OS', { value: originalOS, configurable: true }));
afterAll(() => jest.restoreAllMocks());

function screens() {
  const stack = DAppsStackNavigator({
    catalog: { load: async () => ({ kind: 'unavailable' }) } as DappCatalogPort,
    openExternalUrl: async () => undefined,
    runtime: {
      subscribe: () => () => undefined,
      getSnapshot: () => ({ foreground: true, connectivity: 'online' }),
    } as unknown as LedgerReadRuntime,
    currentSelection: () => undefined,
    subscribeSelection: () => () => undefined,
    signTransaction: async () => ({ status: 'invalid' }),
    permissions: {
      has: () => false,
      grant: () => undefined,
      revoke: () => undefined,
      list: () => [],
      subscribe: () => () => undefined,
      getRevision: () => 0,
    },
  });
  return React.Children.toArray(stack.props.children)
    .filter(React.isValidElement)
    .map(child => (child as React.ReactElement<{ name: string }>).props.name);
}

describe('dApps navigation availability by platform', () => {
  it('does not register an Android embedded browser route', () => {
    Object.defineProperty(Platform, 'OS', { value: 'android', configurable: true });
    expect(screens()).toEqual(['dapps']);
  });

  it('keeps the iOS browser route', () => {
    Object.defineProperty(Platform, 'OS', { value: 'ios', configurable: true });
    expect(screens()).toEqual(['dapps', 'dapp-browser']);
  });
});
