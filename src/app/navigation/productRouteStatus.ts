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
    note: 'The Stellar-style Home product surface is rebuilt around the current Balance read model; asset-detail navigation and other deferred product capabilities remain intentionally unavailable.',
  },
  'account-details': {
    readiness: 'structure-only',
    note: 'The account surface is routed through the runtime shell and now follows the Stellar visual hierarchy; signer/access presenter behavior remains deferred.',
  },
  'add-account': {
    readiness: 'implemented',
    note: 'Existing-wallet Add Account is routed through the runtime shell and currently supports watch-only only.',
  },
  'asset-details': {
    readiness: 'blocked',
    note: 'Keep the destination in product structure, but do not finalize route params until the Home/Asset identity read model exists.',
  },
  'send-form': {
    readiness: 'implemented',
    note: 'Runtime Send validates destination, exact decimal amount, selected balance asset and text memo before building an unsigned payment.',
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
    note: 'Manage Assets is connected to the current Trustline capability and its product presentation has been aligned to the Stellar visual language.',
  },
  activity: {
    readiness: 'structure-only',
    note: 'The current Activity scaffold reads through the History capability, but the full product surface still needs the F4 list, filtering, paging and detail rebuild.',
  },
  'operation-details': {
    readiness: 'structure-only',
    note: 'Detail route remains reserved for stable accountId + operationId navigation; raw operation objects do not enter navigation and no unavailable Horizon detail data is fabricated.',
  },
  dapps: {
    readiness: 'structure-only',
    note: 'The current dApps preview is only scaffolding. F4 must port the Stellar-owned catalog, Recent, browser, Freighter bridge, permissions and data exchange into Fresnica layers.',
  },
  'settings-home': {
    readiness: 'implemented',
    note: 'Settings is a live runtime tab with the grouped information architecture routing Accounts, Security, Network, Language and About destinations.',
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
    note: 'Runtime destination is reachable and visually aligned to the migrated Settings hierarchy; Testnet configuration is display-only and Mainnet switching is intentionally unavailable.',
  },
  'language-settings': {
    readiness: 'implemented',
    note: 'The runtime exposes the full Stellar locale inventory, persists the selected locale independently of wallet secrets, and falls back to English for Fresnica dictionaries not yet migrated.',
  },
  about: {
    readiness: 'structure-only',
    note: 'Runtime destination is reachable, visually aligned to the migrated Settings hierarchy, and displays application information.',
  },
};
