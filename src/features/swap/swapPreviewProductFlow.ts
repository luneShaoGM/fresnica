import type { AccountRecord } from '../../capabilities/account/types';
import type { BalanceCacheRepository } from '../../capabilities/balance/BalanceCacheRepository';
import type { BalanceDependencies } from '../../capabilities/balance/loadBalanceSnapshot';
import type { NetworkContext } from '../../capabilities/network/types';
import { loadPathPaymentQuotes } from '../../capabilities/path-payment/loadPathPaymentQuotes';
import { preparePathPayment } from '../../capabilities/path-payment/preparePathPayment';
import { selectBestPathPaymentQuote } from '../../capabilities/path-payment/quotePolicy';
import {
  projectPathPaymentSourceAvailability,
  type PathPaymentSourceAvailability,
} from '../../capabilities/path-payment/sourceAvailability';
import type {
  LoadPathPaymentQuotesDependencies,
  PathPaymentQuote,
  PathPaymentMode,
  PreparePathPaymentDependencies,
  PreparedPathPaymentReview,
} from '../../capabilities/path-payment/types';
import type { StellarPaymentAsset } from '../../capabilities/stellar/types';
import type { SwapAssetAvailabilityCache, SwapAssetAvailabilitySnapshot } from './swapAssetAvailabilityCache';

export type SwapPreviewProductDependencies = Readonly<{
  network: NetworkContext;
  assetCache: SwapAssetAvailabilityCache;
  balanceCache?: Pick<BalanceCacheRepository, 'getSnapshot' | 'replaceSnapshot'>;
  balance: BalanceDependencies;
  quotes: LoadPathPaymentQuotesDependencies;
  prepare: PreparePathPaymentDependencies;
}>;

export type SwapPreviewDraft = Readonly<{
  mode: PathPaymentMode;
  sourceAsset: StellarPaymentAsset;
  destinationAsset: StellarPaymentAsset;
  fixedAmount: string;
  allowIntermediatePaths?: boolean;
}>;

function assertCurrent(deps: SwapPreviewProductDependencies, account: AccountRecord, isCurrent: () => boolean): void {
  let active = false;
  try {
    active = isCurrent();
  } catch {
    // A missing, stale or throwing App selection source cannot preview XDR.
  }
  if (
    !active ||
    account.hidden ||
    account.identityKind !== 'classic' ||
    account.networkId !== deps.network.id ||
    deps.balance.networkId !== deps.network.id ||
    deps.quotes.network.id !== deps.network.id ||
    deps.quotes.network.networkPassphrase !== deps.network.networkPassphrase ||
    deps.prepare.preflight.network.id !== deps.network.id ||
    deps.prepare.preflight.network.networkPassphrase !== deps.network.networkPassphrase ||
    deps.prepare.transactionGateway.network.id !== deps.network.id ||
    deps.prepare.transactionGateway.network.networkPassphrase !== deps.network.networkPassphrase
  ) {
    throw new Error('swap-session-stale');
  }
}

export async function loadSwapAssetOptions(
  deps: SwapPreviewProductDependencies,
  account: AccountRecord,
  isCurrent: () => boolean,
): Promise<readonly PathPaymentSourceAvailability[]> {
  return (await loadSwapAssetAvailability(deps, account, isCurrent)).options;
}

export async function loadSwapAssetAvailability(
  deps: SwapPreviewProductDependencies,
  account: AccountRecord,
  isCurrent: () => boolean,
): Promise<SwapAssetAvailabilitySnapshot> {
  assertCurrent(deps, account, isCurrent);
  const [accountState, ledger] = await Promise.all([
    deps.prepare.preflight.gateway.loadAccountState(account.address),
    deps.prepare.preflight.gateway.loadLedgerParameters(),
  ]);
  assertCurrent(deps, account, isCurrent);
  if (accountState.status !== 'active' || accountState.account.address !== account.address) {
    throw new Error('swap-assets-unavailable');
  }
  return Object.freeze({
    options: Object.freeze(projectPathPaymentSourceAvailability(accountState.account, ledger)),
    baseFeeStroops: ledger.baseFeeStroops,
  });
}

export async function requestSwapPreviewQuotes(
  deps: SwapPreviewProductDependencies,
  account: AccountRecord,
  draft: SwapPreviewDraft,
  isCurrent: () => boolean,
): Promise<Readonly<{ quotes: readonly PathPaymentQuote[]; best: PathPaymentQuote }>> {
  assertCurrent(deps, account, isCurrent);
  const loadedQuotes = await loadPathPaymentQuotes(deps.quotes, {
    network: deps.network,
    source: account.address,
    destination: account.address,
    sourceAsset: draft.sourceAsset,
    destinationAsset: draft.destinationAsset,
    mode: draft.mode,
    fixedAmount: draft.fixedAmount,
  });
  assertCurrent(deps, account, isCurrent);
  const quotes =
    draft.allowIntermediatePaths === false ? loadedQuotes.filter(quote => quote.path.length === 0) : loadedQuotes;
  if (quotes.length === 0) throw new Error('route_unavailable');
  return Object.freeze({ quotes, best: selectBestPathPaymentQuote(quotes) });
}

export async function prepareSwapPreviewReview(
  deps: SwapPreviewProductDependencies,
  account: AccountRecord,
  selectedQuote: PathPaymentQuote,
  slippageBps: number,
  isCurrent: () => boolean,
): Promise<PreparedPathPaymentReview> {
  assertCurrent(deps, account, isCurrent);
  if (
    selectedQuote.request.network.id !== deps.network.id ||
    selectedQuote.request.network.networkPassphrase !== deps.network.networkPassphrase ||
    selectedQuote.request.source !== account.address ||
    selectedQuote.request.destination !== account.address
  ) {
    throw new Error('swap-session-stale');
  }
  // The UI supplies an explicit fee from the current ledger. C1 will re-read
  // ledger bounds both before and after the unsigned SDK build.
  const ledger = await deps.prepare.preflight.gateway.loadLedgerParameters();
  assertCurrent(deps, account, isCurrent);
  const review = await preparePathPayment(deps.prepare, account, selectedQuote, {
    slippageBps,
    feeStroops: ledger.baseFeeStroops,
    transactionTimeoutSeconds: 180,
  });
  assertCurrent(deps, account, isCurrent);
  return review;
}
