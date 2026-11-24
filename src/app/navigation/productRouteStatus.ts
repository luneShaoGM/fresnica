import type { ProductRoute } from './productRoutes';

export type ProductRouteReadiness = 'implemented' | 'structure-only' | 'capability-ready' | 'blocked';

export type ProductRouteStatus = Readonly<{
  readiness: ProductRouteReadiness;
  note: string;
}>;

// Route readiness describes the supported, reachable implementation only.
// It does not certify full Stellar parity, independent review or native/release
// acceptance. Candidate repairs and dated evidence live in the product ledger.
export const PRODUCT_ROUTE_STATUS: Readonly<Record<ProductRoute, ProductRouteStatus>> = {
  home: {
    readiness: 'implemented',
    note: 'Home provides partitioned Balance/cache refresh, asset details, native reserve breakdown, Claimable and liquidity-pool categories, orders, and eligible Swap entry. Fiat estimates cover XLM and on-demand mainnet credit-asset details; complete portfolio and native aggregate acceptance remain open.',
  },
  'account-details': {
    readiness: 'implemented',
    note: 'Settings account details exposes public identity/copy, rename, hide/restore, guarded deletion, Send, Manage Assets and supported recovery access. Account and Signer ownership remain distinct; hardware/provider flows remain outside this route scope.',
  },
  'add-account': {
    readiness: 'implemented',
    note: 'Home and Settings reach existing-wallet Create, mnemonic/secret Import, HD derivation and watch-only entry, with SDK-owned protection and pending-backup recovery. Sensitive-input lifecycle repairs and native acceptance are tracked separately.',
  },
  'asset-details': {
    readiness: 'implemented',
    note: 'Home opens a native form sheet using stable accountId + networkId + BalanceAsset identity. Current Balance, native reserve details, token imagery and Send/Remove actions are wired; a catalog or icon is not an asset-trust or valuation guarantee.',
  },
  'send-form': {
    readiness: 'implemented',
    note: 'Send uses Details → Recipient → Summary, G-address/Contacts/Request/QR prefill, exact decimal amounts and none/text/ID/hash/return memo before preparing Payment or CreateAccount. M addresses remain paused.',
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
    readiness: 'implemented',
    note: 'Request builds canonical SEP-7 pay URIs for Copy, Share and QR. Paste, camera, photo QR and deep-link ingress feed bounded parsing and explicit Send review; Actions also reaches general scan. No ingress grants signing authority; native permission/lifecycle acceptance remains separate.',
  },
  swap: {
    readiness: 'implemented',
    note: 'S10 Swap is reachable from Home and Actions, with Path Payment quotes, spendable/Max, exact-XDR review and existing authorization/submission/recovery. Simulator, real-device and native product-flow acceptance remain pending; this is not an L4 claim.',
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
    readiness: 'implemented',
    note: 'dApps has catalog/details/cache, Recent, disclaimer/custom URL, browser origin controls, scoped account-read permissions/revocation, Freighter account/network replies, reviewed plain-payment XDR signing and SEP-53 messages. Soroban auth-entry/token requests and WalletConnect remain unavailable; native acceptance is incomplete.',
  },
  'settings-home': {
    readiness: 'implemented',
    note: 'Settings routes General/Theme/Language, Advanced/Network/Logs, Accounts/Recovery, Security, Contacts, Connected dApps and support readers through native-stack history. Developer Mode uses warning/confirmation; signing always requires fresh App Passphrase.',
  },
  'general-settings': {
    readiness: 'implemented',
    note: 'General persists light/dark/system/image theme, USD/EUR/CNY display currency, haptics, separators and reserve-display preferences, with Language entry. Image palette extraction and XLM fiat estimates are implemented; full valuation and native product acceptance remain open.',
  },
  'advanced-settings': {
    readiness: 'implemented',
    note: 'Advanced exposes Network, warning/confirmation-only Developer Mode, version/session identity and gated redacted Session Logs. ChangeLog and broader developer/release tooling remain incomplete; native acceptance is recorded separately.',
  },
  'address-book': {
    readiness: 'implemented',
    note: 'S22 wallet-wide G-address Contacts retain original network provenance, exact typed-memo identity, CRUD/search, QR and recipient/participant selection. Network-bound transactions remain isolated; M addresses and trusted remote resolution remain deferred.',
  },
  'accounts-settings': {
    readiness: 'implemented',
    note: 'Account list/details supports direct selection/default restore, ordering, hide/restore/delete and Create/Import/HD/watch-only entry. Classic identity persists across explicit runtime network contexts; hardware and full multisig workflows remain separate work.',
  },
  'security-settings': {
    readiness: 'implemented',
    note: 'Application lock/unlock, biometric App access with passphrase fallback, timeout/privacy settings, recovery reveal and passphrase change are reachable. App access never authorizes signatures: each key operation requires fresh App Passphrase. Real-device acceptance remains open.',
  },
  'network-settings': {
    readiness: 'implemented',
    note: 'Advanced reaches current runtime network/health and gated node management. Initial legacy setup retains mode controls until network confirmation; fixed helper sessions are read-only. No native maturity is implied.',
  },
  'language-settings': {
    readiness: 'implemented',
    note: 'The app exposes the full Stellar locale inventory, persists the selected locale independently of wallet secrets, and falls back to English for Fresnica dictionaries not yet migrated.',
  },
  about: {
    readiness: 'implemented',
    note: 'About displays application/runtime/network identity. Support and read-only Terms/Credits surfaces exist elsewhere in Settings; owner-approved legal text, release content and full support closure remain pending.',
  },
};
