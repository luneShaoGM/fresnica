export type RootFlow =
  | 'bootstrap'
  | 'onboarding'
  | 'locked'
  | 'main';

export type MainTab =
  | 'wallet'
  | 'activity'
  | 'settings';

export type ProductRoute =
  | 'wallet-home'
  | 'account-details'
  | 'add-account'
  | 'asset-details'
  | 'send-form'
  | 'send-review'
  | 'send-result'
  | 'manage-assets'
  | 'history'
  | 'operation-details'
  | 'settings-home'
  | 'accounts-settings'
  | 'security-settings'
  | 'network-settings'
  | 'about';

export type OnboardingRoute =
  | 'welcome'
  | 'create-wallet'
  | 'import-mnemonic'
  | 'import-secret'
  | 'watch-only'
  | 'set-app-passphrase'
  | 'backup-mnemonic'
  | 'confirm-backup'
  | 'resume-pending-backup';

export type ProductRouteParams = Readonly<{
  'wallet-home': undefined;
  'account-details': Readonly<{accountId: string}>;
  'add-account': undefined;
  'asset-details': Readonly<{accountId: string; assetKey: string}>;
  'send-form': Readonly<{accountId: string}>;
  'send-review': undefined;
  'send-result': undefined;
  'manage-assets': Readonly<{accountId: string}>;
  history: undefined;
  'operation-details': Readonly<{accountId: string; operationId: string}>;
  'settings-home': undefined;
  'accounts-settings': undefined;
  'security-settings': undefined;
  'network-settings': undefined;
  about: undefined;
}>;

export const MAIN_TABS: readonly MainTab[] = [
  'wallet',
  'activity',
  'settings',
];

export const PRODUCT_ROUTES: Readonly<Record<MainTab, readonly ProductRoute[]>> = {
  wallet: [
    'wallet-home',
    'account-details',
    'add-account',
    'asset-details',
    'send-form',
    'send-review',
    'send-result',
    'manage-assets',
  ],
  activity: ['history', 'operation-details'],
  settings: [
    'settings-home',
    'accounts-settings',
    'security-settings',
    'network-settings',
    'about',
  ],
};
