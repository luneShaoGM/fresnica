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
    readiness: 'structure-only',
    note: 'Product surface exists; Portfolio/Horizon read state is not connected yet.',
  },
  'account-details': {
    readiness: 'structure-only',
    note: 'Public account surface exists; signer/access presenter is not connected yet.',
  },
  'add-account': {
    readiness: 'implemented',
    note: 'Existing-wallet Add Account currently supports watch-only only.',
  },
  'asset-details': {
    readiness: 'blocked',
    note: 'Keep the destination in product structure, but do not finalize route params until the Portfolio/Asset identity read model exists.',
  },
  'send-form': {
    readiness: 'capability-ready',
    note: 'Payment/transaction foundations exist; product form orchestration is not wired yet.',
  },
  'send-review': {
    readiness: 'capability-ready',
    note: 'Must render from immutable PaymentReview derived from exact XDR.',
  },
  'send-result': {
    readiness: 'capability-ready',
    note: 'Must render normalized accepted/rejected/uncertain submission outcome.',
  },
  'manage-assets': {
    readiness: 'structure-only',
    note: 'Product destination exists; trustline transaction capability is not connected yet.',
  },
  history: {
    readiness: 'structure-only',
    note: 'Activity surface exists; Horizon operation history read path is not connected yet.',
  },
  'operation-details': {
    readiness: 'structure-only',
    note: 'Detail destination exists; Horizon operation presenter is not connected yet.',
  },
  'settings-home': {
    readiness: 'structure-only',
    note: 'Settings information architecture is defined.',
  },
  'accounts-settings': {
    readiness: 'structure-only',
    note: 'Account list/details shell uses durable Account records only.',
  },
  'security-settings': {
    readiness: 'implemented',
    note: 'System Auth status/enable/repair/disable is implemented; app session lock remains upstream-blocked.',
  },
  'network-settings': {
    readiness: 'structure-only',
    note: 'Testnet configuration is display-only; Mainnet switching is intentionally unavailable.',
  },
  about: {
    readiness: 'structure-only',
    note: 'Application information surface exists.',
  },
};
