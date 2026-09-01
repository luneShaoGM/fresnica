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
    readiness: 'implemented',
    note: 'Public account identity is live and recovery export is exposed only when exactly one complete protected-software signer is attached.',
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
    note: 'Runtime Send validates destination, exact decimal amount, selected balance asset and text memo before preparing the current Normative Payment/CreateAccount transaction.',
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
    readiness: 'implemented',
    note: 'Manage Assets is connected to the current Trustline Add/Remove product flow with exact-XDR review and shared transaction submission.',
  },
  'recovery-export': {
    readiness: 'implemented',
    note: 'Recovery material is revealed only through Fresnica Core with a fresh app passphrase; navigation carries only accountId and revealed material remains screen-local.',
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
