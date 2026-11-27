import React from 'react';
import {
  createDappRecentHistory,
  type DappRecentHistory,
} from '../../../capabilities/dapp-interaction/dappRecentHistory';
import { NativeModules, Platform } from 'react-native';

import type { DappCatalogEntry, DappCatalogPort } from '../../../capabilities/dapp-catalog/catalog';
import type { DappPublicSelection } from '../../../capabilities/dapp-interaction/freighterSession';
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

const liveEntry: DappCatalogEntry = {
  id: 'directory-dex',
  title: 'Listed Dex',
  description: 'Public listing',
  category: 'Finance',
  websiteUrl: 'https://dex.example.org/app',
};
const selectedWallet: DappPublicSelection = {
  accountId: 'wallet-A',
  address: 'GSOURCE',
  networkId: 'stellar-testnet',
  networkPassphrase: 'Test SDF Network ; September 2015',
  networkUrl: 'https://horizon-testnet.stellar.org',
  revision: 4,
};

function catalogRoute(
  verified: boolean,
  getSelection: () => DappPublicSelection | undefined = () => selectedWallet,
  recentHistory?: DappRecentHistory,
) {
  const catalog: DappCatalogPort = {
    load: async () => ({ kind: 'ready', entries: [liveEntry] }),
    isTrustedLiveEntry: () => verified,
  };
  const stack = DAppsStackNavigator({
    catalog,
    recentHistory,
    openExternalUrl: async () => undefined,
    runtime: {
      subscribe: () => () => undefined,
      getSnapshot: () => ({ foreground: true, connectivity: 'online' }),
    } as unknown as LedgerReadRuntime,
    currentSelection: getSelection,
    subscribeSelection: () => () => undefined,
    signTransaction: async () => ({ status: 'invalid' }),
    permissions: {
      has: () => false,
      grant: () => undefined,
      revoke: () => undefined,
      revokeAccount: () => undefined,
      list: () => [],
      subscribe: () => () => undefined,
      getRevision: () => 0,
    },
  });
  const pages = React.Children.toArray(stack.props.children).filter(React.isValidElement) as React.ReactElement<{
    name: string;
    children: (input: unknown) => React.ReactElement;
  }>[];
  const listing = pages.find(screen => screen.props.name === 'dapps');
  const browser = pages.find(screen => screen.props.name === 'dapp-browser');
  if (!listing || !browser) throw new Error('browser-route-unavailable');
  const listingRoute = listing.props.children({});
  const listingSurface = (
    listingRoute.type as (props: Record<string, unknown>) => React.ReactElement<{
      openCatalogInApp?: (entry: DappCatalogEntry, fresh: boolean) => void;
      openInApp?: (url: string) => void;
      recentHistory?: DappRecentHistory;
    }>
  )(listingRoute.props as Record<string, unknown>);
  const browserRoute = browser.props.children({
    route: { params: { url: liveEntry.websiteUrl } },
    navigation: { goBack: jest.fn() },
  });
  const browserSurface = () =>
    (
      browserRoute.type as (props: Record<string, unknown>) => React.ReactElement<{
        trustedCatalogOrigin?: string;
        onVisit?: (url: string) => void;
        url: string;
      }>
    )(browserRoute.props as Record<string, unknown>);
  return { listingSurface, browserSurface };
}

const originalOS = Platform.OS;
afterEach(() => {
  Object.defineProperty(Platform, 'OS', { value: originalOS, configurable: true });
  mockNavigate.mockClear();
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
      revokeAccount: () => undefined,
      list: () => [],
      subscribe: () => () => undefined,
      getRevision: () => 0,
    },
  });
  return React.Children.toArray(stack.props.children).filter(React.isValidElement) as React.ReactElement<{
    name: string;
    children: (input: unknown) => React.ReactElement;
  }>[];
}

describe('dApps navigation availability by platform', () => {
  it('does not register an Android browser without native protection', () => {
    Object.defineProperty(Platform, 'OS', { value: 'android', configurable: true });
    const original = NativeModules.DappNetworkGuard;
    NativeModules.DappNetworkGuard = undefined;
    expect(screens().map(screen => screen.props.name)).toEqual(['dapps']);
    NativeModules.DappNetworkGuard = original;
  });

  it('keeps only the listing route when Android cannot confirm same-document navigation', () => {
    Object.defineProperty(Platform, 'OS', { value: 'android', configurable: true });
    const original = NativeModules.DappNetworkGuard;
    NativeModules.DappNetworkGuard = { available: true, sameDocumentNavigation: false };
    try {
      const pages = screens();
      expect(pages.map(screen => screen.props.name)).toEqual(['dapps']);
      const listing = pages[0].props.children({});
      const surface = (listing.type as (props: unknown) => React.ReactElement)(listing.props);
      expect(surface.props).toMatchObject({
        inAppUnavailable: true,
        openInApp: undefined,
        openCatalogInApp: undefined,
        openExternalUrl: expect.any(Function),
      });
    } finally {
      NativeModules.DappNetworkGuard = original;
    }
  });

  it('registers the Android browser with native protection and navigation support', () => {
    Object.defineProperty(Platform, 'OS', { value: 'android', configurable: true });
    const original = NativeModules.DappNetworkGuard;
    NativeModules.DappNetworkGuard = { available: true, sameDocumentNavigation: true };
    expect(screens().map(screen => screen.props.name)).toEqual(['dapps', 'dapp-browser']);
    NativeModules.DappNetworkGuard = original;
  });

  it('converts only an explicitly tapped fresh API directory row into a one-use browser proof', () => {
    Object.defineProperty(Platform, 'OS', { value: 'ios', configurable: true });
    const { listingSurface, browserSurface } = catalogRoute(true);
    listingSurface.props.openCatalogInApp?.(liveEntry, true);
    expect(mockNavigate).toHaveBeenCalledWith('dapp-browser', { url: liveEntry.websiteUrl });
    const browser = browserSurface();
    expect(browser.props.url).toBe(liveEntry.websiteUrl);
    expect(browser.props.trustedCatalogOrigin).toBe('https://dex.example.org');
    expect(mockNavigate.mock.calls[0][1]).toEqual({ url: liveEntry.websiteUrl });
  });

  it('never auto-connects stale, unsupported, mismatched or manually opened links', () => {
    Object.defineProperty(Platform, 'OS', { value: 'ios', configurable: true });
    for (const [verified, fresh] of [
      [false, true],
      [true, false],
    ] as const) {
      const route = catalogRoute(verified);
      route.listingSurface.props.openCatalogInApp?.(liveEntry, fresh);
      expect(route.browserSurface().props.trustedCatalogOrigin).toBeUndefined();
    }
    const manual = catalogRoute(true);
    manual.listingSurface.props.openInApp?.(liveEntry.websiteUrl);
    expect(manual.browserSurface().props.trustedCatalogOrigin).toBeUndefined();

    const superseded = catalogRoute(true);
    superseded.listingSurface.props.openCatalogInApp?.(liveEntry, true);
    superseded.listingSurface.props.openInApp?.(liveEntry.websiteUrl);
    expect(superseded.browserSurface().props.trustedCatalogOrigin).toBeUndefined();

    let selected = selectedWallet;
    const changed = catalogRoute(true, () => selected);
    changed.listingSurface.props.openCatalogInApp?.(liveEntry, true);
    selected = { ...selectedWallet, revision: selectedWallet.revision + 1 };
    expect(changed.browserSurface().props.trustedCatalogOrigin).toBeUndefined();
  });
  it('keeps the iOS browser route', () => {
    Object.defineProperty(Platform, 'OS', { value: 'ios', configurable: true });
    expect(screens().map(screen => screen.props.name)).toEqual(['dapps', 'dapp-browser']);
  });
});

it('wires one shared history to directory and real browser visits without conferring curated trust', () => {
  Object.defineProperty(Platform, 'OS', { value: 'ios', configurable: true });
  const history = createDappRecentHistory({ read: () => [], replace: () => {} }, 'stellar-testnet');
  const { listingSurface, browserSurface } = catalogRoute(false, () => selectedWallet, history);
  expect(listingSurface.props.recentHistory).toBe(history);
  listingSurface.props.openInApp?.(liveEntry.websiteUrl);
  expect(history.getSnapshot().origins).toEqual([]);
  const browser = browserSurface();
  expect(browser.props.trustedCatalogOrigin).toBeUndefined();
  browser.props.onVisit?.(liveEntry.websiteUrl);
  expect(history.getSnapshot().origins).toEqual(['https://dex.example.org']);
});
