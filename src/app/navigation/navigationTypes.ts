import type { NavigatorScreenParams } from '@react-navigation/native';

import type { ProductRouteParams } from './productRoutes';

export type RootStackParamList = {
  bootstrap: undefined;
  'network-setup': undefined;
  onboarding: undefined;
  locked: undefined;
  main: undefined;
  'request-deep-link': undefined;
};

export type HomeStackParamList = {
  home: ProductRouteParams['home'];
  'add-account': ProductRouteParams['add-account'];
  'asset-details': ProductRouteParams['asset-details'];
  'send-form': ProductRouteParams['send-form'];
  swap: ProductRouteParams['swap'];
  request: ProductRouteParams['request'];
  'manage-assets': ProductRouteParams['manage-assets'];
};

export type ActivityStackParamList = {
  activity: ProductRouteParams['activity'];
  'operation-details': ProductRouteParams['operation-details'];
};

export type DAppsStackParamList = {
  dapps: ProductRouteParams['dapps'];
  'dapp-browser': { url: string };
};

export type SettingsStackParamList = {
  'settings-home': ProductRouteParams['settings-home'];
  'accounts-settings': ProductRouteParams['accounts-settings'];
  'account-details': ProductRouteParams['account-details'];
  'add-account': ProductRouteParams['add-account'];
  'security-settings': ProductRouteParams['security-settings'];
  'connected-dapps': undefined;
  'network-settings': ProductRouteParams['network-settings'];
  'language-settings': ProductRouteParams['language-settings'];
  about: ProductRouteParams['about'];
};

export type MainTabParamList = {
  home: NavigatorScreenParams<HomeStackParamList> | undefined;
  activity: NavigatorScreenParams<ActivityStackParamList> | undefined;
  dapps: NavigatorScreenParams<DAppsStackParamList> | undefined;
  settings: NavigatorScreenParams<SettingsStackParamList> | undefined;
};
