import React from 'react';

import type { AccountRecord } from '../../../capabilities/account/types';
import type { AppServices } from '../../createAppServices';
import { HomeStackNavigator } from '../HomeStackNavigator';

jest.mock('@fresnica/ui-native', () => ({ Button: () => null, StateView: () => null }));
jest.mock('@ui/components', () => ({ Screen: () => null, StateView: () => null }));
jest.mock('@features/accounts/AddAccountScreen', () => ({ AddAccountScreen: () => null }));
jest.mock('@features/trustlines/AddAssetSheet', () => ({ AddAssetSheet: () => null }));
jest.mock('@features/home/AssetDetailsSheet', () => ({ AssetDetailsSheet: () => null }));
jest.mock('@features/home/AssetDetailsScreen', () => ({ AssetDetailsScreen: () => null }));
jest.mock('@features/home/HomeScreen', () => ({ HomeScreen: () => null }));
jest.mock('@features/send/SendFlowScreen', () => ({ SendFlowScreen: () => null }));
jest.mock('@features/request/RequestFlowScreen', () => ({ RequestFlowScreen: () => null }));
jest.mock('@features/trustlines/ManageAssetsScreen', () => ({ ManageAssetsScreen: () => null }));
jest.mock('@features/swap/SwapPreviewScreen', () => ({
  SwapPreviewScreen: () => null,
  SwapUnavailableScreen: () => null,
}));
jest.mock('@platform/system/RequestQrScannerView', () => ({ ReactNativeRequestQrScannerView: () => null }));

jest.mock('react', () => {
  const actual = jest.requireActual('react') as typeof import('react');
  return {
    ...actual,
    useState: (initial: unknown) => [initial, jest.fn()],
    useCallback: (fn: unknown) => fn,
    useRef: (initial: unknown) => ({ current: initial }),
    useSyncExternalStore: (_subscribe: unknown, snapshot: () => unknown) => snapshot(),
  };
});

jest.mock('@react-navigation/native', () => ({ useFocusEffect: jest.fn(), useIsFocused: () => true }));

jest.mock('@react-navigation/native-stack', () => ({
  createNativeStackNavigator: () => ({ Navigator: 'TestNavigator', Screen: 'TestScreen' }),
}));

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

function renderHomeEntry(swapEnabled: boolean, watchOnly = false, selectedAccount = account) {
  const navigate = jest.fn();
  const services = {
    onboarding: { repository: { isWatchOnly: () => watchOnly } },
    ledgerReadRuntime: { subscribe: jest.fn(), getSnapshot: () => ({ foreground: true }) },
    ledgerReadInvalidation: { subscribe: jest.fn(), getRevision: () => 0 },
  } as unknown as AppServices;
  const root = HomeStackNavigator({
    accounts: selectedAccount === account ? [account] : [account, selectedAccount],
    selectedAccountId: selectedAccount.id,
    selectableAccounts: selectedAccount === account ? [account] : [account, selectedAccount],
    swapEnabled,
    services,
    onAccountsChanged: jest.fn(),
    onCreatedAccountReady: jest.fn(),
    onSelectAccount: jest.fn(),
    getCurrentSwapSelection: jest.fn(),
    subscribeToSwapSelection: jest.fn(),
  });
  type HomeEntry = Readonly<{
    name: string;
    children: (props: {
      navigation: { navigate: typeof navigate };
    }) => React.ReactElement<{ children?: React.ReactNode; onSwap?: () => void }>;
  }>;
  const home = React.Children.toArray(root.props.children)
    .filter((child): child is React.ReactElement<HomeEntry> => React.isValidElement<HomeEntry>(child))
    .find(child => child.props.name === 'home');
  expect(home).toBeDefined();
  const screen = home?.props.children({ navigation: { navigate } });
  const homeScreen = React.Children.toArray(screen?.props.children).find(
    (child): child is React.ReactElement<{ onSwap?: () => void }> => React.isValidElement(child),
  );
  return { navigate, onSwap: homeScreen?.props.onSwap };
}

describe('Home Swap entry wiring', () => {
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
