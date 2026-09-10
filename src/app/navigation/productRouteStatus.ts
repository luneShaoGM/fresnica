import type {ProductRoute} from './productRoutes';

export type ProductRouteReadiness =
  | 'implemented'
  | 'structure-only'
  | 'capability-ready'
  | 'blocked';

export type ProductRouteStatus = Readonly<{
  readiness: ProductRouteReadiness;
  note: string;
}>;

export const PRODUCT_ROUTE_STATUS: Readonly<Record<ProductRoute, ProductRouteStatus>> = {
  home: {
    readiness: 'structure-only',
    note: 'The Stellar-style Home product surface is live on the Balance read model with focus revalidation and asset-detail navigation; Request, Swap and later portfolio metadata remain separate deferred capabilities.',
  },
  'account-details': {
    readiness: 'structure-only',
    note: 'The account surface is registered in the Settings native stack so Accounts → Detail preserves local back history; signer/access presenter behavior remains deferred.',
  },
  'add-account': {
    readiness: 'implemented',
    note: 'Existing-wallet Add Account reuses the same watch-only screen from Home and Settings while each entry keeps its own native-stack back history.',
  },
  'asset-details': {
    readiness: 'implemented',
    note: 'Home opens a live asset detail route using only stable accountId + BalanceAsset identity; the destination reloads the current Balance capability snapshot and keeps metadata/TOML deferred.',
  },
  'send-form': {
    readiness: 'implemented',
    note: 'Send validates destination, exact decimal amount, selected balance asset and text memo before building an unsigned payment.',
  },
  'send-review': {
    readiness: 'implemented',
    note: 'Send review is local flow state rendered from PaymentReview derived from exact unsigned XDR; no XDR is placed in navigation params.',
  },
  'send-result': {
    readiness: 'implemented',
    note: 'Send renders submitted, deterministic rejected, uncertain, authorization-blocked, unsupported signer, watch-only and unsupported-multisig outcomes without collapsing them.',
  },
  request: {
    readiness: 'structure-only',
    note: 'Request is part of the Stellar product route inventory, but no Fresnica Request/share/QR product flow is wired yet.',
  },
  exchange: {
    readiness: 'blocked',
    note: 'Exchange presentation is planned, but authoritative Swap behavior remains blocked on the shared Fresnica Path Payment/Swap Application Capability contract.',
  },
  'manage-assets': {
    readiness: 'implemented',
    note: 'Manage Assets supports Add, Set Limit and Remove through the shared Trustline exact-XDR review/sign/submit pipeline, including pre-sign ledger-state revalidation.',
  },
  activity: {
    readiness: 'implemented',
    note: 'Activity uses the History capability with localized states, search, real category filters, paging, duplicate suppression, focus revalidation and a live operation-detail route.',
  },
  'operation-details': {
    readiness: 'implemented',
    note: 'Detail navigation carries only accountId + operationId. History reloads the single Horizon operation, verifies account association, distinguishes 404 from gateway failure, and projects only stable domain fields.',
  },
  dapps: {
    readiness: 'structure-only',
    note: 'The current dApps preview is only scaffolding. F4 must port the Stellar-owned catalog, Recent, browser, Freighter bridge, permissions and data exchange into Fresnica layers.',
  },
  'settings-home': {
    readiness: 'implemented',
    note: 'Settings is a live bottom-tab root backed by a native stack for Accounts, Security, Network, Language and About destinations.',
  },
  'accounts-settings': {
    readiness: 'structure-only',
    note: 'Account list/details surfaces are live, use durable Account records only, and follow the Stellar visual hierarchy; deeper signer/access presentation remains deferred.',
  },
  'security-settings': {
    readiness: 'implemented',
    note: 'System Auth status/enable/repair/disable is routed through the Stellar-style security surface; app session lock remains upstream-blocked.',
  },
  'network-settings': {
    readiness: 'structure-only',
    note: 'The Settings native stack reaches a read-only network destination. The development build remains on Testnet while release policy is Mainnet-default with Testnet/custom endpoints behind authenticated Developer Mode.',
  },
  'language-settings': {
    readiness: 'implemented',
    note: 'The app exposes the full Stellar locale inventory, persists the selected locale independently of wallet secrets, and falls back to English for Fresnica dictionaries not yet migrated.',
  },
  about: {
    readiness: 'structure-only',
    note: 'The Settings native stack reaches the visually aligned About destination and displays application information.',
  },
};
