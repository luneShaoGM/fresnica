export type RootFlow =
  | 'bootstrap'
  | 'onboarding'
  | 'locked'
  | 'main';

export type MainTab =
  | 'home'
  | 'events'
  | 'xapps'
  | 'settings';

export type ProductAction =
  | 'send'
  | 'swap'
  | 'request';

export type ProductRoute =
  | 'home'
  | 'account-details'
  | 'add-account'
  | 'asset-details'
  | 'send-form'
  | 'send-review'
  | 'send-result'
  | 'request'
  | 'exchange'
  | 'manage-assets'
  | 'events'
  | 'operation-details'
  | 'xapps'
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
  home: undefined;
  'account-details': Readonly<{accountId: string}>;
  'add-account': undefined;
  // Asset identity is intentionally unresolved until the Home/Trustline read
  // model defines a stable public asset key.
  'asset-details': undefined;
  'send-form': Readonly<{accountId: string}>;
  // Review/result state stays in the Send flow. Exact XDR and reviewed
  // transaction data must not be transported as navigation parameters.
  'send-review': undefined;
  'send-result': undefined;
  request: Readonly<{accountId: string}>;
  exchange: Readonly<{accountId: string}>;
  'manage-assets': Readonly<{accountId: string}>;
  events: undefined;
  'operation-details': Readonly<{accountId: string; operationId: string}>;
  xapps: undefined;
  'settings-home': undefined;
  'accounts-settings': undefined;
  'security-settings': undefined;
  'network-settings': undefined;
  about: undefined;
}>;

export const MAIN_TABS: readonly MainTab[] = [
  'home',
  'events',
  'xapps',
  'settings',
];

export const PRODUCT_ACTIONS: readonly ProductAction[] = [
  'send',
  'swap',
  'request',
];

export const PRODUCT_ROUTES: Readonly<Record<MainTab, readonly ProductRoute[]>> = {
  home: [
    'home',
    'account-details',
    'add-account',
    'asset-details',
    'send-form',
    'send-review',
    'send-result',
    'request',
    'exchange',
    'manage-assets',
  ],
  events: ['events', 'operation-details'],
  xapps: ['xapps'],
  settings: [
    'settings-home',
    'accounts-settings',
    'security-settings',
    'network-settings',
    'about',
  ],
};
