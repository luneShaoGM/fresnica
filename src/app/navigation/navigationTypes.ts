import type {NavigatorScreenParams} from '@react-navigation/native';

import type {ProductRouteParams} from './productRoutes';

export type RootStackParamList = {
  bootstrap: undefined;
  onboarding: undefined;
  locked: undefined;
  main: undefined;
};

export type HomeStackParamList = {
  home: ProductRouteParams['home'];
  'account-details': ProductRouteParams['account-details'];
  'add-account': ProductRouteParams['add-account'];
  'send-form': ProductRouteParams['send-form'];
  'manage-assets': ProductRouteParams['manage-assets'];
};

export type ActivityStackParamList = {
  activity: ProductRouteParams['activity'];
  'operation-details': ProductRouteParams['operation-details'];
};

export type DAppsStackParamList = {
  dapps: ProductRouteParams['dapps'];
};

export type SettingsStackParamList = {
  'settings-home': ProductRouteParams['settings-home'];
  'accounts-settings': ProductRouteParams['accounts-settings'];
  'security-settings': ProductRouteParams['security-settings'];
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
