import React from 'react';
import { AppNavigator } from '../AppNavigator';
import type { AppRuntimeState } from '../../runtimeState';
import { selectPersistedAccountAndDefault } from '../accountSelection';
import { NETWORKS } from '@capabilities/network/networkPreferences';

jest.mock('react', () => ({
  ...jest.requireActual('react'),
  useMemo: (fn: () => unknown) => fn(),
  useState: () => [undefined, jest.fn()],
}));
jest.mock('@react-navigation/native', () => ({ NavigationContainer: 'navigation', DefaultTheme: { colors: {} } }));
jest.mock('@react-navigation/native-stack', () => ({
  createNativeStackNavigator: () => ({ Navigator: 'stack', Screen: 'screen' }),
}));
jest.mock('@ui/theme', () => ({
  useAppTheme: () => jest.requireActual('../../../ui/theme/defaultTheme').defaultTheme,
  useThemedStyles: jest.fn(),
}));
jest.mock('../../../locale', () => ({ useLocalization: () => ({ t: (key: string) => key }) }));
jest.mock('@features/onboarding/OnboardingScreen', () => ({ OnboardingScreen: 'onboarding' }));
jest.mock('@features/onboarding/PendingMnemonicBackupScreen', () => ({ PendingMnemonicBackupScreen: 'backup' }));
jest.mock('@features/request/RequestDeepLinkScreen', () => ({ RequestDeepLinkScreen: 'request' }));
jest.mock('@features/send/SendFlowScreen', () => ({ SendFlowScreen: 'send' }));
jest.mock('@features/settings/NetworkSettingsScreen', () => ({ NetworkSettingsScreen: 'network' }));
jest.mock('../MainTabsNavigator', () => ({ MainTabsNavigator: 'main' }));
jest.mock('../accountSelection', () => ({ selectPersistedAccountAndDefault: jest.fn() }));

type Props = {
  children?: React.ReactNode | (() => React.ReactElement);
  name?: string;
  onComplete?: () => void;
  showBack?: boolean;
};
function elements(root: React.ReactNode): React.ReactElement<Props>[] {
  if (!React.isValidElement<Props>(root)) return [];
  return [
    root,
    ...(typeof root.props.children === 'function' ? [] : React.Children.toArray(root.props.children).flatMap(elements)),
  ];
}
function state(confirmed: boolean): AppRuntimeState {
  return {
    kind: 'ready',
    bootstrap: { kind: 'ready', accounts: [] },
    services: {
      networkSettings: { getSnapshot: () => ({ preferences: { selectionConfirmed: confirmed } }) },
      networkProfile: NETWORKS['stellar-mainnet'],
      nodeReadSession: {},
      onboarding: {
        networkId: 'stellar-mainnet',
        repository: { getAccount: () => ({ networkId: 'stellar-testnet' }) },
      },
      accountSelectionPreferences: {},
      security: {},
    },
  } as unknown as AppRuntimeState;
}
describe('legacy-wallet network choice routing', () => {
  it('blocks the wallet and deep-link route until an explicit network choice', () => {
    const root = AppNavigator({
      runtime: state(false),
      onRefreshBootstrap: jest.fn(),
      onDismissDeepLink: jest.fn(),
      deepLink: { kind: 'blocked', reason: 'account-ineligible' },
    });
    const screens = elements(root);
    expect(screens.some(node => node.props.name === 'request-deep-link')).toBe(false);
    const route = screens.find(node => node.props.name === 'network-setup');
    expect(route).toBeDefined();
    const content = route?.props.children;
    expect(typeof content === 'function' ? (content().props as Props).showBack : undefined).toBe(false);
  });
  it('enters the normal wallet after confirmed preferences are loaded', () => {
    const root = AppNavigator({ runtime: state(true), onRefreshBootstrap: jest.fn(), onDismissDeepLink: jest.fn() });
    expect(elements(root).some(node => node.props.name === 'main')).toBe(true);
    expect(elements(root).some(node => node.props.name === 'network-setup')).toBe(false);
  });
  it('completes an existing pending backup against its original account network before setup', () => {
    const runtime = state(false);
    if (runtime.kind !== 'ready') throw new Error('fixture');
    const pending = {
      ...runtime,
      bootstrap: {
        kind: 'pending-mnemonic-backup' as const,
        accountId: 'old-account',
        signerId: 's',
        signerPublicKey: 'GS',
      },
    };
    const refresh = jest.fn();
    const root = AppNavigator({ runtime: pending, onRefreshBootstrap: refresh, onDismissDeepLink: jest.fn() });
    const route = elements(root).find(node => node.props.name === 'onboarding');
    const child = route?.props.children;
    if (typeof child !== 'function') throw new Error('backup-route-missing');
    (child().props as Props).onComplete?.();
    expect(selectPersistedAccountAndDefault).toHaveBeenCalledWith(
      runtime.services.onboarding.repository,
      'old-account',
      'stellar-testnet',
      runtime.services.accountSelectionPreferences,
    );
    expect(refresh).toHaveBeenCalledTimes(1);
  });
});

it('unmounts the native navigation tree during session loading or failure instead of pushing a bootstrap route', () => {
  for (const runtime of [{ kind: 'loading' }, { kind: 'error', message: 'test failure' }] as const) {
    const root = AppNavigator({ runtime, onRefreshBootstrap: jest.fn(), onDismissDeepLink: jest.fn() });
    expect(elements(root).some(n => n.type === ('navigation' as unknown))).toBe(false);
    expect(elements(root).some(n => n.type === ('stack' as unknown))).toBe(false);
    expect(root.props.runtime).toEqual(runtime);
  }
});
