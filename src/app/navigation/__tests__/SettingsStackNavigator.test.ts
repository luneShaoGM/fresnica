import React from 'react';
import type { AppServices } from '../../createAppServices';
import { SettingsStackNavigator } from '../SettingsStackNavigator';
import { SettingsHomeScreen } from '@features/settings/SettingsHomeScreen';
import { GeneralSettingsScreen } from '@features/settings/GeneralSettingsScreen';
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
  expect(general.type).toBe(GeneralSettingsScreen);
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
