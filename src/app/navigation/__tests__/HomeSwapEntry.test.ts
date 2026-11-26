import React from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import type { AccountRecord } from '../../../capabilities/account/types';
import type { AppServices } from '../../createAppServices';
import { ManageAssetsScreen } from '@features/trustlines/ManageAssetsScreen';
import { HomeStackNavigator } from '../HomeStackNavigator';

jest.mock('@fresnica/ui-native', () => ({ Button: () => null, StateView: () => null }));
jest.mock('@ui/components', () => ({ Screen: () => null, StateView: () => null }));
jest.mock('@ui/theme', () => ({ useAppTheme: () => jest.requireActual('@ui/theme').defaultTheme }));
jest.mock('@features/accounts/AddAccountScreen', () => ({ AddAccountScreen: () => null }));
jest.mock('@features/trustlines/AddAssetSheet', () => ({ AddAssetSheet: () => null }));
jest.mock('@features/home/AssetDetailsSheet', () => ({ AssetDetailsSheet: () => null }));
jest.mock('@features/home/AssetDetailsScreen', () => ({ AssetDetailsScreen: () => null }));
jest.mock('@features/home/HomeScreen', () => ({ HomeScreen: () => null }));
jest.mock('@features/send/SendFlowScreen', () => ({ SendFlowScreen: () => null }));
jest.mock('@features/request/RequestFlowScreen', () => ({ RequestFlowScreen: () => null }));
jest.mock('@features/request/ReceiveSheet', () => ({ ReceiveSheet: () => null }));
jest.mock('@features/trustlines/ManageAssetsScreen', () => ({ ManageAssetsScreen: () => null }));
jest.mock('@features/swap/SwapPreviewScreen', () => ({
  SwapPreviewScreen: () => null,
  SwapUnavailableScreen: () => null,
}));
jest.mock('@platform/system/RequestQrScannerView', () => ({ ReactNativeRequestQrScannerView: () => null }));
jest.mock('@platform/system/requestIngress', () => ({
  reactNativeRequestIngress: {
    checkCameraPermission: jest.fn(),
    requestCameraPermission: jest.fn(),
    openCameraSettings: jest.fn(),
  },
}));

jest.mock('react', () => {
  const actual = jest.requireActual('react') as typeof import('react');
  return {
    ...actual,
    useEffect: (effect: () => void) => {
      mockEffects.push(effect);
    },
    useState: (initial: unknown) => [mockRequestReady ? true : initial, jest.fn()],
    useCallback: (fn: unknown) => fn,
    useRef: (initial: unknown) => ({ current: initial }),
    useSyncExternalStore: (_subscribe: unknown, snapshot: () => unknown) => snapshot(),
  };
});

jest.mock('@react-navigation/native', () => ({ useFocusEffect: jest.fn(), useIsFocused: () => mockFocused }));

jest.mock('@react-navigation/native-stack', () => ({
  createNativeStackNavigator: () => ({ Navigator: 'TestNavigator', Screen: 'TestScreen' }),
}));

const mockEffects: Array<() => void> = [];
let mockFocused = true;
let mockRequestReady = false;

const account: AccountRecord = {
  id: 'testnet-account',
  address: 'GTESTNETACCOUNT',
  identityKind: 'classic',
  networkId: 'stellar-testnet',
  label: 'Test',
  sortOrder: 0,
  hidden: false,
  createdAt: new Date('2026-10-27T00:00:00Z'),
  updatedAt: new Date('2026-10-27T00:00:00Z'),
};

function renderHomeEntry(
  swapEnabled: boolean,
  watchOnly = false,
  selectedAccount = account,
  markets = false,
  otherAccounts: readonly AccountRecord[] = [],
) {
  const navigate = jest.fn();
  const accounts = [...(selectedAccount === account ? [account] : [account, selectedAccount]), ...otherAccounts];
  const services = {
    markets: markets ? { networkId: selectedAccount.networkId } : undefined,
    onboarding: { repository: { isWatchOnly: () => watchOnly } },
    ledgerReadRuntime: { subscribe: jest.fn(), getSnapshot: () => ({ foreground: true }) },
    ledgerReadInvalidation: { subscribe: jest.fn(), getRevision: () => 0 },
    request: {
      network: { id: selectedAccount.networkId, networkPassphrase: 'test' },
      gateway: { isClassicAccountAddress: (address: string) => address.startsWith('G') },
    },
    send: { network: { id: selectedAccount.networkId, networkPassphrase: 'test' } },
    swapPreview: { network: { id: selectedAccount.networkId, networkPassphrase: 'test' } },
    swapExecution: {},
    trustline: { network: { id: selectedAccount.networkId, networkPassphrase: 'test' } },
    copyPublicText: jest.fn(),
    externalUrl: { open: jest.fn() },
  } as unknown as AppServices;
  const root = HomeStackNavigator({
    accounts,
    selectedAccountId: selectedAccount.id,
    selectableAccounts: selectedAccount === account ? [account] : [account, selectedAccount],
    swapEnabled,
    services,
    onAccountsChanged: jest.fn(),
    onCreatedAccountReady: jest.fn(),
    onSelectAccount: jest.fn(),
    getCurrentSwapSelection: () => ({
      selectedAccountId: selectedAccount.id,
      selectionRevision: 1,
      accounts,
      network: { id: selectedAccount.networkId, networkPassphrase: 'test' },
    }),
    subscribeToSwapSelection: jest.fn(),
  });
  type HomeEntry = Readonly<{
    name: string;
    children: (props: {
      navigation: { navigate: typeof navigate };
    }) => React.ReactElement<{ children?: React.ReactNode; onSwap?: () => void; onOrders?: () => void }>;
  }>;
  const home = React.Children.toArray(root.props.children)
    .filter((child): child is React.ReactElement<HomeEntry> => React.isValidElement<HomeEntry>(child))
    .find(child => child.props.name === 'home');
  expect(home).toBeDefined();
  const screen = home?.props.children({ navigation: { navigate } });
  const homeScreen = React.Children.toArray(screen?.props.children).find(
    (child): child is React.ReactElement<{ onSwap?: () => void; onOrders?: () => void }> => React.isValidElement(child),
  );
  return { navigate, onSwap: homeScreen?.props.onSwap, onOrders: homeScreen?.props.onOrders, root };
}

describe('Manage Assets route account', () => {
  const other = { ...account, id: 'other-account', address: 'GOTHER' };
  function openRoute(available: readonly AccountRecord[], requestedAction = false) {
    const { root } = renderHomeEntry(false, false, account, false, available);
    const page = React.Children.toArray(root.props.children).find(
      child => React.isValidElement<{ name: string }>(child) && child.props.name === 'manage-assets',
    ) as React.ReactElement<{
      children: (input: unknown) => React.ReactElement<{
        account?: AccountRecord;
        captureSession: (focused: () => boolean) => () => boolean;
      }>;
    }>;
    return page.props.children({
      navigation: { isFocused: () => true, popToTop: jest.fn(), goBack: jest.fn() },
      route: {
        params: {
          accountId: other.id,
          ...(requestedAction ? { requestedAction: { code: 'USD', issuer: 'GISSUER' } } : {}),
        },
      },
    });
  }

  it('retains Settings navigation to nonselected visible account B without switching to A', () => {
    const screen = openRoute([other]);
    expect(screen.type).toBe(ManageAssetsScreen);
    expect(screen.props.account).toBe(other);
    const current = screen.props.captureSession(() => true);
    expect(current()).toBe(true);
  });

  it.each([
    ['deleted', []],
    ['hidden', [{ ...other, hidden: true }]],
    ['wrong-network', [{ ...other, networkId: 'stellar-mainnet' }]],
  ])('does not substitute A when B is %s', (_reason, available) => {
    expect(openRoute(available).type).not.toBe(ManageAssetsScreen);
  });

  it('keeps Home asset-sheet actions bound to the selected account', () => {
    expect(openRoute([other], true).type).not.toBe(ManageAssetsScreen);
  });
});

describe('Home Swap entry wiring', () => {
  it('keeps camera/photo website sessions available on the actual Actions request route for a contract, but blocks Send', async () => {
    const contract = { ...account, id: 'contract-account', identityKind: 'contract' as const, address: 'CCONTRACT' };
    const { root } = renderHomeEntry(false, true, contract);
    const page = React.Children.toArray(root.props.children).find(
      child => React.isValidElement<{ name: string }>(child) && child.props.name === 'request',
    ) as React.ReactElement<{
      children: (input: unknown) => React.ReactElement;
    }>;
    const navigate = jest.fn();
    const tabs = { navigate: jest.fn() };
    const navigation = { isFocused: () => true, popToTop: jest.fn(), navigate, getParent: () => tabs };
    const route = page.props.children({ route: { params: { accountId: contract.id, initialScan: true } }, navigation });
    const focusSpy = jest.mocked(useFocusEffect).mockImplementation(callback => {
      callback();
    });
    mockRequestReady = true;
    const appStateSpy = jest.spyOn(AppState, 'addEventListener').mockReturnValue({ remove: jest.fn() });
    const renderRoute = route.type as (props: unknown) => React.ReactElement<{
      captureScanSession: (source: 'camera' | 'photo') => () => boolean;
      onScannedWebsite: (url: string, current: () => boolean) => void;
      onContinueSend: (intent: unknown, current: () => boolean) => Promise<void>;
    }>;
    try {
      const screen = renderRoute(route.props);
      for (const source of ['camera', 'photo'] as const) {
        const current = screen.props.captureScanSession(source);
        expect(current()).toBe(true);
        screen.props.onScannedWebsite('https://example.org/' + source, current);
      }
      expect(tabs.navigate).toHaveBeenCalledTimes(2);
      await expect(
        screen.props.onContinueSend(
          { networkId: contract.networkId, networkPassphrase: 'test', asset: { kind: 'native' } },
          () => true,
        ),
      ).rejects.toThrow();
      expect(navigate).not.toHaveBeenCalled();
    } finally {
      focusSpy.mockReset();
      mockRequestReady = false;
      appStateSpy.mockRestore();
    }
  });
  it('opens independent SDEX orders for a read-only Classic account without using the Swap route', () => {
    const { navigate, onOrders, onSwap } = renderHomeEntry(false, true, account, true);
    expect(onSwap).toBeUndefined();
    expect(onOrders).toBeDefined();
    onOrders?.();
    expect(navigate).toHaveBeenCalledWith('orders', { accountId: account.id });
  });
  it('refuses an orders route for another account instead of silently choosing a visible account', () => {
    const { root } = renderHomeEntry(false, false, account, true);
    const route = React.Children.toArray(root.props.children).find(
      child => React.isValidElement<{ name: string }>(child) && child.props.name === 'orders',
    ) as React.ReactElement<{
      children: (context: {
        route: { params: { accountId: string } };
        navigation: { popToTop: () => void };
      }) => React.ReactElement;
    }>;
    const denied = route.props.children({
      route: { params: { accountId: 'other' } },
      navigation: { popToTop: jest.fn() },
    });
    expect(typeof denied.type === 'function' && denied.type.name).toBe('AssetAccountUnavailable');
  });
  it('adds the read-only Actions source gate only for the explicit shortcut route', () => {
    const renderEntry = (selectSource: boolean, watchOnly = false) => {
      const { root } = renderHomeEntry(true, watchOnly);
      const screen = React.Children.toArray(root.props.children).find(
        child => React.isValidElement<{ name: string }>(child) && child.props.name === 'swap',
      ) as React.ReactElement<{ children: (input: unknown) => React.ReactElement }>;
      const route = screen.props.children({
        route: { params: { accountId: account.id, selectSource } },
        navigation: { isFocused: () => true, popToTop: jest.fn() },
      });
      return (route.type as (props: unknown) => React.ReactElement<Record<string, unknown>>)(route.props);
    };
    const focusSpy = jest.mocked(useFocusEffect).mockImplementation(callback => {
      callback();
    });
    mockRequestReady = true;
    try {
      const gated = renderEntry(true);
      expect(typeof gated.type === 'function' && gated.type.name).toBe('ActionsSwapEntry');
      const asset = { kind: 'credit' as const, code: 'usd', issuer: 'GEXACT' };
      const preview = (
        gated.props.children as (value: typeof asset) => React.ReactElement<{ initialSourceAsset: typeof asset }>
      )(asset);
      expect(preview.props.initialSourceAsset).toBe(asset);
      const recovery = (gated.props.renderRecovery as () => React.ReactElement<{ historyOnly: boolean }>)();
      expect(recovery.type).toBe(preview.type);
      expect(recovery.props.historyOnly).toBe(true);
      const regular = renderEntry(false);
      expect(typeof regular.type === 'function' && regular.type.name).toBe('SwapPreviewScreen');
      const denied = renderEntry(true, true);
      expect(typeof denied.type === 'function' && denied.type.name).toBe('SwapUnavailableScreen');
    } finally {
      focusSpy.mockReset();
      mockRequestReady = false;
    }
  });

  it('routes an eligible account to the same swap screen as Actions, using public account identity only', () => {
    const { navigate, onSwap } = renderHomeEntry(true);
    expect(onSwap).toBeDefined();
    onSwap?.();
    expect(navigate).toHaveBeenCalledWith('swap', { accountId: account.id });
  });

  it('routes to the newly selected account rather than the previous account', () => {
    const nextAccount = { ...account, id: 'next-account', address: 'GNEXTACCOUNT' };
    const { navigate, onSwap } = renderHomeEntry(true, false, nextAccount);
    onSwap?.();
    expect(navigate).toHaveBeenCalledWith('swap', { accountId: nextAccount.id });
  });

  it('does not expose a Home Swap callback when the shared action gate is false', () => {
    const { navigate, onSwap } = renderHomeEntry(false, true);
    expect(onSwap).toBeUndefined();
    expect(navigate).not.toHaveBeenCalled();
  });
});

describe('Home native asset details route', () => {
  beforeEach(() => {
    mockEffects.length = 0;
    mockFocused = true;
  });
  function detailsRoute(watchOnly = false) {
    const { root } = renderHomeEntry(false, watchOnly);
    return React.Children.toArray(root.props.children).find(
      child => React.isValidElement<{ name: string }>(child) && child.props.name === 'asset-details',
    ) as React.ReactElement<{
      options: unknown;
      children: (context: {
        route: { params: { accountId: string; networkId: string; asset: { kind: 'native'; code: 'XLM' } } };
        navigation: { goBack: () => void; popToTop: () => void; replace: jest.Mock };
      }) => React.ReactElement<{
        children: React.ReactElement<{ onClose: () => void; onSend: (asset: typeof params.asset) => void }>;
        foreground: boolean;
      }>;
    }>;
  }
  const params = {
    accountId: account.id,
    networkId: account.networkId,
    asset: { kind: 'native' as const, code: 'XLM' as const },
  };
  it('uses the installed native form sheet and replaces it on Send instead of keeping it in Back history', () => {
    const route = detailsRoute();
    expect(route.props.options).toMatchObject({
      presentation: 'formSheet',
      sheetAllowedDetents: [0.88],
      sheetGrabberVisible: true,
    });
    const navigation = { goBack: jest.fn(), popToTop: jest.fn(), replace: jest.fn() };
    const gate = route.props.children({ route: { params }, navigation });
    const content = gate.props.children;
    content.props.onClose();
    expect(navigation.goBack).toHaveBeenCalledTimes(1);
    content.props.onSend(params.asset);
    expect(navigation.replace).toHaveBeenCalledWith('send-form', { accountId: account.id, initialAsset: params.asset });
  });
  it('keeps the watch-only signing gate when opening native asset details', () => {
    const route = detailsRoute(true);
    const navigation = { goBack: jest.fn(), popToTop: jest.fn(), replace: jest.fn() };
    const gate = route.props.children({ route: { params }, navigation });
    gate.props.children.props.onSend(params.asset);
    expect(navigation.replace).not.toHaveBeenCalled();
  });
  it.each([
    { ...params, accountId: 'other-account' },
    { ...params, networkId: 'stellar-mainnet' },
  ])('discards a stale account/network route without rendering asset content', stale => {
    const route = detailsRoute();
    const navigation = { goBack: jest.fn(), popToTop: jest.fn(), replace: jest.fn() };
    const gate = route.props.children({ route: { params: stale }, navigation });
    const renderGate = gate.type as (props: unknown) => React.ReactNode;
    expect(renderGate(gate.props)).toBeNull();
    mockEffects.splice(0).forEach(effect => effect());
    expect(navigation.popToTop).toHaveBeenCalledTimes(1);
  });
  it.each(['background', 'blur'])('discards rather than reviving the selection after %s', reason => {
    const route = detailsRoute();
    const navigation = { goBack: jest.fn(), popToTop: jest.fn(), replace: jest.fn() };
    const gate = route.props.children({ route: { params }, navigation });
    if (reason === 'blur') mockFocused = false;
    const renderGate = gate.type as (props: unknown) => React.ReactNode;
    expect(renderGate({ ...gate.props, foreground: reason !== 'background' })).toBeNull();
    mockEffects.splice(0).forEach(effect => effect());
    expect(navigation.popToTop).toHaveBeenCalledTimes(1);
  });
});
