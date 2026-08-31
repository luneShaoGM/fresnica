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
  'wallet-home': {
    readiness: 'implemented',
    note: 'Runtime Wallet Home is connected to the Balance Capability with loading, inactive, active, error and refresh states.',
  },
  'account-details': {
    readiness: 'structure-only',
    note: 'Public account surface is routed through the runtime shell; signer/access presenter is not connected yet.',
  },
  'add-account': {
    readiness: 'implemented',
    note: 'Existing-wallet Add Account is routed through the runtime shell and currently supports watch-only only.',
  },
  'asset-details': {
    readiness: 'blocked',
    note: 'Keep the destination in product structure, but do not finalize route params until the Portfolio/Asset identity read model exists.',
  },
  'send-form': {
    readiness: 'implemented',
    note: 'Runtime Send validates Stellar G/M destination, exact decimal amount, selected balance asset and 28-byte UTF-8 text memo before building an unsigned payment.',
  },
  'send-review': {
    readiness: 'implemented',
    note: 'Send review is local flow state rendered from PaymentReview derived from exact unsigned XDR; submission re-derives semantics from that XDR and no XDR is placed in navigation params.',
  },
  'send-result': {
    readiness: 'implemented',
    note: 'Send renders submitted, deterministic rejected, uncertain, authorization-blocked, unsupported signer, watch-only and unsupported-multisig outcomes without collapsing them.',
  },
  'manage-assets': {
    readiness: 'structure-only',
    note: 'Destination is reachable from the runtime shell; trustline transaction capability is not connected yet.',
  },
  history: {
    readiness: 'implemented',
    note: 'Activity loads normalized Horizon account-operation pages with loading, inactive, empty, error, refresh and deduplicated load-more states; unknown operations remain explicit unsupported entries.',
  },
  'operation-details': {
    readiness: 'structure-only',
    note: 'Detail route remains reserved for stable accountId + operationId navigation; first History slice does not pass raw operation objects through navigation.',
  },
  'settings-home': {
    readiness: 'implemented',
    note: 'Settings is a live runtime tab routing Accounts, Security, Network and About destinations.',
  },
  'accounts-settings': {
    readiness: 'structure-only',
    note: 'Account list/details shell is live and uses durable Account records only.',
  },
  'security-settings': {
    readiness: 'implemented',
    note: 'System Auth status/enable/repair/disable is routed through the runtime shell; app session lock remains upstream-blocked.',
  },
  'network-settings': {
    readiness: 'structure-only',
    note: 'Runtime destination is reachable; Testnet configuration is display-only and Mainnet switching is intentionally unavailable.',
  },
  about: {
    readiness: 'structure-only',
    note: 'Runtime destination is reachable and displays application information.',
  },
};
