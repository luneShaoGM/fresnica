import React from 'react';
import { defaultTheme } from '@ui/theme';
import type { AppServices } from '../../createAppServices';
import { SettingsStackNavigator } from '../SettingsStackNavigator';
import { SettingsHomeScreen } from '@features/settings/SettingsHomeScreen';
import { PrivacySettingsScreen } from '@features/settings/PrivacySettingsScreen';
import { AdvancedSettingsScreen } from '@features/settings/AdvancedSettingsScreen';
import { NetworkSettingsScreen } from '@features/settings/NetworkSettingsScreen';
import { reactNativeRequestIngress } from '@platform/system/requestIngress';

jest.mock('@react-navigation/native-stack', () => ({
  createNativeStackNavigator: () => ({ Navigator: 'Navigator', Screen: 'Screen' }),
}));
jest.mock('@react-navigation/native', () => ({ useFocusEffect: jest.fn() }));
jest.mock('@platform/system/RequestQrScannerView', () => ({ ReactNativeRequestQrScannerView: () => null }));
jest.mock('@platform/system/requestIngress', () => ({
  reactNativeRequestIngress: {
    checkCameraPermission: jest.fn(),
    requestCameraPermission: jest.fn(),
    openCameraSettings: jest.fn(),
  },
}));
jest.mock('@fresnica/ui-native', () => ({ Button: () => null, Screen: () => null }));
jest.mock('@features/accounts/AccountDetailsScreen', () => ({ AccountDetailsScreen: () => null }));
jest.mock('@features/accounts/AccountsScreen', () => ({ AccountsScreen: () => null }));
jest.mock('@features/accounts/AddAccountScreen', () => ({ AddAccountScreen: () => null }));
jest.mock('@features/security/SecuritySettingsScreen', () => ({ SecuritySettingsScreen: () => null }));
jest.mock('@features/settings/LanguageSettingsScreen', () => ({ LanguageSettingsScreen: () => null }));
type ScreenProps = {
  onOpenGeneral?: () => void;
  onOpenPrivacy?: () => void;
  onOpenAdvanced?: () => void;
  onOpenLanguage?: () => void;
  onOpenNetwork?: () => void;
  onBack?: () => void;
  settings?: unknown;
  monitor?: unknown;
  network?: unknown;
  book?: unknown;
  scanner?: unknown;
};
it('wires Settings→General→Language and Settings→Advanced→Network with the live session and back history', () => {
  const navigation = { navigate: jest.fn(), goBack: jest.fn() };
  const services = {
    diagnostics: { sessionId: 'test-session' },
    networkSettings: {},
    nodeReadSession: {},
    contacts: { network: { id: 'stellar-mainnet' } },
    networkProfile: { id: 'stellar-mainnet', horizonUrl: 'https://chosen.example', isMainnet: true },
  } as unknown as AppServices;
  const root = SettingsStackNavigator({
    accounts: [],
    services,
    onAccountsChanged: jest.fn(),
    onCreatedAccountReady: jest.fn(),
    onSend: jest.fn(),
    onManageAssets: jest.fn(),
  });
  type RouteProps = {
    name: string;
    children: (context: { navigation: typeof navigation }) => React.ReactElement<ScreenProps>;
  };
  const screens = React.Children.toArray(root.props.children).filter((node): node is React.ReactElement<RouteProps> =>
    React.isValidElement<RouteProps>(node),
  );
  const screen = (name: string) => {
    const route = screens.find(node => node.props.name === name);
    if (!route) throw new Error('missing route: ' + name);
    return route.props.children({ navigation });
  };
  const addressBook = screen('address-book');
  expect(addressBook.props.book).toBe(services.contacts);
  expect(addressBook.props.scanner).toMatchObject({
    ScannerView: expect.any(Function),
    ingress: reactNativeRequestIngress,
  });
  const home = screen('settings-home');
  expect(home.type).toBe(SettingsHomeScreen);
  home.props.onOpenPrivacy?.();
  expect(navigation.navigate).toHaveBeenLastCalledWith('privacy-settings');
  const privacy = screen('privacy-settings');
  expect(privacy.type).toBe(PrivacySettingsScreen);
  expect(privacy.props.settings).toBe(services.networkSettings);
  home.props.onOpenGeneral?.();
  expect(navigation.navigate).toHaveBeenLastCalledWith('general-settings');
  const general = screen('general-settings');
  expect(general.type).toEqual(expect.any(Function));
  general.props.onOpenLanguage?.();
  expect(navigation.navigate).toHaveBeenLastCalledWith('language-settings');
  general.props.onBack?.();
  expect(navigation.goBack).toHaveBeenCalledTimes(1);
  home.props.onOpenAdvanced?.();
  expect(navigation.navigate).toHaveBeenLastCalledWith('advanced-settings');
  const advanced = screen('advanced-settings');
  expect(advanced.type).toBe(AdvancedSettingsScreen);
  expect(advanced.props.settings).toBe(services.networkSettings);
  advanced.props.onOpenNetwork?.();
  expect(navigation.navigate).toHaveBeenLastCalledWith('network-settings');
  const network = screen('network-settings');
  expect(network.type).toBe(NetworkSettingsScreen);
  expect(network.props).toMatchObject({
    settings: services.networkSettings,
    monitor: services.nodeReadSession,
    network: services.networkProfile,
  });
  network.props.onBack?.();
  expect(navigation.goBack).toHaveBeenCalledTimes(2);
});

it.each(['native-back', 'background-gate'] as const)(
  'handles pending selection on %s without relying on blur',
  async removal => {
    const { createThemeImageSelection } =
      require('@capabilities/preferences/createThemeImageSelection') as typeof import('@capabilities/preferences/createThemeImageSelection');
    const { createGeneralPreferences } =
      require('@capabilities/preferences/generalPreferences') as typeof import('@capabilities/preferences/generalPreferences');
    const save = jest.fn(),
      cancelPalette = jest.fn();
    const preferences = createGeneralPreferences({ load: () => undefined, save });
    let foreground = true;
    let accessChanged = () => {};
    let finish!: (palette: { primary: string; secondary: string }) => void;
    const selection = createThemeImageSelection({
      preferences,
      pickPalette: () =>
        new Promise(resolve => {
          finish = resolve;
        }),
      cancelPalette,
      getAccess: () => ({ foreground, locked: false }),
      subscribeAccess: listener => {
        accessChanged = listener;
        return () => {};
      },
      assertOpen: () => {},
    });
    const root = SettingsStackNavigator({
      accounts: [],
      services: { diagnostics: { sessionId: 'fixture' }, themeImageSelection: selection } as unknown as AppServices,
      onAccountsChanged: jest.fn(),
      onCreatedAccountReady: jest.fn(),
      onSend: jest.fn(),
      onManageAssets: jest.fn(),
    });
    type Route = { name: string; listeners?: { beforeRemove(): void } };
    const route = React.Children.toArray(root.props.children).find(
      node => React.isValidElement<Route>(node) && node.props.name === 'theme-settings',
    ) as React.ReactElement<Route>;
    const pending = selection.start();
    // Native-stack removal emits beforeRemove even when the screen never receives blur.
    // Gate teardown removes the navigation tree without a navigation removal action.
    if (removal === 'native-back') route.props.listeners!.beforeRemove();
    else {
      foreground = false;
      accessChanged();
    }
    finish({ primary: defaultTheme.colors.primary, secondary: defaultTheme.colors.secondary });
    await pending;
    expect(save).not.toHaveBeenCalled();
    if (removal === 'background-gate') {
      expect(cancelPalette).not.toHaveBeenCalled();
      foreground = true;
      accessChanged();
      expect(save).toHaveBeenCalledTimes(1);
      expect(preferences.getSnapshot().theme).toBe('image');
    } else {
      expect(cancelPalette).toHaveBeenCalledTimes(1);
      expect(preferences.getSnapshot().theme).toBe('system');
      expect(selection.getSnapshot().busy).toBe(false);
    }
    selection.close();
  },
);
