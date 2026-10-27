import type { AccountRecord } from '../../capabilities/account/types';
import type { BalanceDependencies } from '../../capabilities/balance/loadBalanceSnapshot';
import { loadBalanceSnapshot } from '../../capabilities/balance/loadBalanceSnapshot';
import type { NetworkContext } from '../../capabilities/network/types';
import { loadPathPaymentQuotes } from '../../capabilities/path-payment/loadPathPaymentQuotes';
import { preparePathPayment } from '../../capabilities/path-payment/preparePathPayment';
import { projectPathPaymentSpendable } from '../../capabilities/path-payment/preflightPathPayment';
import { selectBestPathPaymentQuote } from '../../capabilities/path-payment/quotePolicy';
import type {
  LoadPathPaymentQuotesDependencies,
  PathPaymentQuote,
  PathPaymentMode,
  PreparePathPaymentDependencies,
  PreparedPathPaymentReview,
} from '../../capabilities/path-payment/types';
import type { StellarPaymentAsset } from '../../capabilities/stellar/types';

export type SwapPreviewProductDependencies = Readonly<{
  network: NetworkContext;
  balance: BalanceDependencies;
  quotes: LoadPathPaymentQuotesDependencies;
  prepare: PreparePathPaymentDependencies;
}>;

export type SwapPreviewDraft = Readonly<{
  mode: PathPaymentMode;
  sourceAsset: StellarPaymentAsset;
  destinationAsset: StellarPaymentAsset;
  fixedAmount: string;
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

export async function loadSwapPreviewAssets(
  deps: SwapPreviewProductDependencies,
  account: AccountRecord,
  isCurrent: () => boolean,
): Promise<readonly StellarPaymentAsset[]> {
  assertCurrent(deps, account, isCurrent);
  const balance = await loadBalanceSnapshot(deps.balance, account);
  assertCurrent(deps, account, isCurrent);
  if (balance.status !== 'active' || balance.address !== account.address) {
    throw new Error('swap-assets-unavailable');
  }
  const assets = balance.balances.map(line =>
    line.asset.kind === 'native'
      ? ({ kind: 'native' } as const)
      : ({ kind: 'credit', code: line.asset.code, issuer: line.asset.issuer } as const),
  );
  if (assets.length < 2) throw new Error('swap-assets-unavailable');
  return Object.freeze(assets.map(asset => Object.freeze(asset)));
}

// Spendable is read from current account state and current ledger parameters;
// balance display caches are never valid inputs to Max.
export async function loadSwapSourceSpendable(
  deps: SwapPreviewProductDependencies,
  account: AccountRecord,
  asset: StellarPaymentAsset,
  isCurrent: () => boolean,
): Promise<string | undefined> {
  assertCurrent(deps, account, isCurrent);
  const gateway = deps.prepare.preflight.gateway;
  const response = await gateway.loadAccountState(account.address);
  assertCurrent(deps, account, isCurrent);
  if (response.status !== 'active' || response.account.address !== account.address) {
    throw new Error('swap-assets-unavailable');
  }
  const ledger = await gateway.loadLedgerParameters();
  assertCurrent(deps, account, isCurrent);
  return projectPathPaymentSpendable(response.account, asset, ledger, ledger.baseFeeStroops);
}

export async function requestSwapPreviewQuotes(
  deps: SwapPreviewProductDependencies,
  account: AccountRecord,
  draft: SwapPreviewDraft,
  isCurrent: () => boolean,
): Promise<Readonly<{ quotes: readonly PathPaymentQuote[]; best: PathPaymentQuote }>> {
  assertCurrent(deps, account, isCurrent);
  const quotes = await loadPathPaymentQuotes(deps.quotes, {
    network: deps.network,
    source: account.address,
    destination: account.address,
    sourceAsset: draft.sourceAsset,
    destinationAsset: draft.destinationAsset,
    mode: draft.mode,
    fixedAmount: draft.fixedAmount,
  });
  assertCurrent(deps, account, isCurrent);
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
