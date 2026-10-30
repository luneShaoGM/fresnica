import React from 'react';
import { Platform } from 'react-native';

import type { DappCatalogEntry, DappCatalogPort } from '../../../capabilities/dapp-catalog/catalog';
import type { LedgerReadRuntime } from '../../readModels/LedgerReadRuntime';

const mockNavigate = jest.fn();

jest.mock('@react-navigation/native-stack', () => ({
  createNativeStackNavigator: () => ({ Navigator: 'StackNavigator', Screen: 'StackScreen' }),
}));
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
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

jest.spyOn(react, 'useRef').mockImplementation(((initial: unknown) => ({ current: initial })) as typeof react.useRef);

const { DAppsStackNavigator } = require('../DAppsStackNavigator') as typeof import('../DAppsStackNavigator');

const { DAppsScreen } =
  require('@features/dapps/screens/DAppsScreen') as typeof import('@features/dapps/screens/DAppsScreen');
const { DappBrowserScreen } =
  require('@features/dapps/screens/DappBrowserScreen/DappBrowserScreen') as typeof import('@features/dapps/screens/DappBrowserScreen/DappBrowserScreen');

const entry: DappCatalogEntry = {
  id: 'curated',
  title: 'Curated',
  description: 'A curated dApp',
  category: 'Finance',
  websiteUrl: 'https://dex.example.org/app',
};
const current = {
  accountId: 'walletA',
  address: 'GWALLET',
  networkId: 'stellar-testnet',
  networkPassphrase: 'Test SDF Network ; September 2015',
  networkUrl: 'https://horizon-testnet.stellar.org',
  revision: 3,
};

function captureCatalogRoute(trusted: boolean, identity = current) {
  const catalog: DappCatalogPort = {
    load: async () => ({ kind: 'ready', entries: [entry] }),
    isTrustedLiveEntry: () => trusted,
  };
  const stack = DAppsStackNavigator({
    catalog,
    openExternalUrl: async () => undefined,
    runtime: {
      subscribe: () => () => undefined,
      getSnapshot: () => ({ foreground: true, connectivity: 'online' }),
    } as unknown as LedgerReadRuntime,
    currentSelection: () => identity,
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
  const pages = React.Children.toArray(stack.props.children).filter(React.isValidElement) as React.ReactElement<{
    name: string;
    children: (props: unknown) => React.ReactElement;
  }>[];
  const catalogScreen = pages.find(screen => screen.props.name === 'dapps');
  const dappScreen = pages.find(screen => screen.props.name === 'dapp-browser');
  if (!catalogScreen || !dappScreen) throw new Error('ios-route-missing');
  const catalogRoute = catalogScreen.props.children({});
  const catalogSurface = (catalogRoute.type as (props: Record<string, unknown>) => React.ReactElement)(
    catalogRoute.props as Record<string, unknown>,
  );
  expect(catalogSurface.type).toBe(DAppsScreen);
  const browserRoute = dappScreen.props.children({
    route: { params: { url: entry.websiteUrl } },
    navigation: { goBack: () => undefined },
  });
  const getBrowser = () =>
    (browserRoute.type as (props: Record<string, unknown>) => React.ReactElement<{ trustedCatalogOrigin?: string }>)(
      browserRoute.props as Record<string, unknown>,
    );
  return { catalogSurface, getBrowser };
}

const originalOS = Platform.OS;
afterEach(() => {
  Object.defineProperty(Platform, 'OS', { value: originalOS, configurable: true });
  mockNavigate.mockReset();
});
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

  it('wires exact real-time catalog navigation to a one-use trusted browser route', () => {
    Object.defineProperty(Platform, 'OS', { value: 'ios', configurable: true });
    const { catalogSurface, getBrowser } = captureCatalogRoute(true);
    const open = (catalogSurface.props as { openCatalogInApp?: (entry: DappCatalogEntry, fresh: boolean) => void })
      .openCatalogInApp;
    expect(open).toBeDefined();
    open?.(entry, true);
    expect(mockNavigate).toHaveBeenCalledWith('dapp-browser', { url: entry.websiteUrl });
    const browser = getBrowser();
    expect(browser.type).toBe(DappBrowserScreen);
    expect(browser.props.trustedCatalogOrigin).toBe('https://dex.example.org');
  });

  it('does not trust a stale or unverifiable listing and never embeds trust in navigation params', () => {
    Object.defineProperty(Platform, 'OS', { value: 'ios', configurable: true });
    const { catalogSurface, getBrowser } = captureCatalogRoute(false);
    const open = (catalogSurface.props as { openCatalogInApp: (entry: DappCatalogEntry, fresh: boolean) => void })
      .openCatalogInApp;
    open(entry, true);
    expect(mockNavigate).toHaveBeenCalledWith('dapp-browser', { url: entry.websiteUrl });
    expect(getBrowser().props.trustedCatalogOrigin).toBeUndefined();
  });

  it('keeps the iOS browser route', () => {
    Object.defineProperty(Platform, 'OS', { value: 'ios', configurable: true });
    expect(screens()).toEqual(['dapps', 'dapp-browser']);
  });
});
