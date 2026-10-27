import type { AccountRecord } from '../account/types';
import { validatePaymentAsset, validatePaymentMemo } from '../payment/preparePayment';
import type {
  StellarAccountState,
  StellarAccountStateResult,
  StellarLedgerParameters,
  StellarPaymentAsset,
  StellarTrustlineBalance,
} from '../stellar/types';
import { derivePathPaymentProtection } from './quotePolicy';
import type { PathPaymentPreflightDependencies, PathPaymentQuote } from './types';

const MAX_STROOPS = 9_223_372_036_854_775_807n;
const STROOPS_PER_UNIT = 10_000_000n;

// Read-only ledger eligibility. No transaction operation/XDR, authorization,
// signed amount, or reusable "approved" result is produced by this function.
// Swap-C2 must run this check again in the actual prepare operation.
export async function assertPathPaymentPreflight(
  dependencies: PathPaymentPreflightDependencies,
  account: Pick<AccountRecord, 'address' | 'networkId' | 'identityKind'>,
  quote: PathPaymentQuote,
  slippageBps: number,
  requestedFeeStroops?: number,
): Promise<void> {
  if (requestedFeeStroops !== undefined && (!Number.isSafeInteger(requestedFeeStroops) || requestedFeeStroops <= 0)) {
    throw new Error('invalid_request');
  }
  assertContext(dependencies, account, quote);
  const request = quote.request;
  const validClassic = (address: string) => dependencies.gateway.isClassicAccountAddress(address);
  try {
    if (
      !validClassic(request.source) ||
      !validClassic(request.destination) ||
      (request.sourceAsset.kind !== 'native' && request.sourceAsset.kind !== 'credit') ||
      (request.destinationAsset.kind !== 'native' && request.destinationAsset.kind !== 'credit')
    ) {
      throw new Error('invalid_request');
    }
    validatePaymentAsset(request.sourceAsset, validClassic);
    validatePaymentAsset(request.destinationAsset, validClassic);
    const sourceAsset = request.sourceAsset;
    const destinationAsset = request.destinationAsset;
    if (
      (sourceAsset.kind === 'native' && destinationAsset.kind === 'native') ||
      (sourceAsset.kind === 'credit' &&
        destinationAsset.kind === 'credit' &&
        sourceAsset.code === destinationAsset.code &&
        sourceAsset.issuer === destinationAsset.issuer)
    ) {
      throw new Error('invalid_request');
    }
    if (request.memo !== undefined && !['text', 'id', 'hash'].includes(request.memo.type)) {
      throw new Error('invalid_request');
    }
  } catch {
    throw new Error('invalid_request');
  }
  const memo = validateMemo(request.memo);
  const protection = derivePathPaymentProtection(quote, slippageBps, dependencies.clock);

  const source = await loadActive(dependencies, account, quote, request.source, 'insufficient_source');
  const destination =
    request.source === request.destination
      ? source
      : await loadActive(dependencies, account, quote, request.destination, 'destination_missing');

  // SEP-29 applies to cross-account transfers only. A same-account Swap never
  // silently injects or modifies the memo.
  if (request.source !== request.destination && destination.memoRequired && !memo) {
    throw new Error('invalid_request');
  }

  // Both external issuers must still exist even when the two account
  // trustlines are present. Issuer-as-sender/receiver needs no own trustline.
  const issuers = new Set<string>();
  for (const asset of [request.sourceAsset, request.destinationAsset]) {
    if (asset.kind === 'credit' && asset.issuer !== request.source && asset.issuer !== request.destination) {
      issuers.add(asset.issuer);
    }
  }
  for (const issuer of issuers) {
    await loadActive(dependencies, account, quote, issuer, 'issuer_missing');
  }

  const ledger = await readLedger(dependencies, account, quote);
  if (requestedFeeStroops !== undefined && requestedFeeStroops < ledger.baseFeeStroops) {
    throw new Error('invalid_request');
  }
  const sourceAmount =
    protection.mode === 'strict_send' ? parseStroops(quote.sourceAmount) : parseStroops(protection.sourceMaximum);
  const destinationAmount = parseStroops(quote.destinationAmount);

  assertSourceCanPay(source, request.sourceAsset, sourceAmount, ledger, requestedFeeStroops ?? ledger.baseFeeStroops);
  assertDestinationCanReceive(destination, request.destinationAsset, destinationAmount);

  // Ledger reads may consume most or all quote TTL. Freshness is not
  // persisted, and must be rechecked at transaction preparation in Swap-C2.
  assertContext(dependencies, account, quote);
  derivePathPaymentProtection(quote, slippageBps, dependencies.clock);
}

function assertContext(
  dependencies: PathPaymentPreflightDependencies,
  account: Pick<AccountRecord, 'address' | 'networkId' | 'identityKind'>,
  quote: PathPaymentQuote,
): void {
  const network = quote.request.network;
  if (
    account.identityKind !== 'classic' ||
    account.address !== quote.request.source ||
    account.networkId !== network?.id ||
    !network.id ||
    !network.networkPassphrase ||
    dependencies.network.id !== network.id ||
    dependencies.network.networkPassphrase !== network.networkPassphrase ||
    dependencies.gateway.network.id !== network.id ||
    dependencies.gateway.network.networkPassphrase !== network.networkPassphrase
  ) {
    throw new Error('invalid_request');
  }
}

async function readLedger(
  dependencies: PathPaymentPreflightDependencies,
  account: Pick<AccountRecord, 'address' | 'networkId' | 'identityKind'>,
  quote: PathPaymentQuote,
): Promise<StellarLedgerParameters> {
  let ledger: StellarLedgerParameters;
  try {
    ledger = await dependencies.gateway.loadLedgerParameters();
  } catch {
    throw new Error('quote_unavailable');
  }
  assertContext(dependencies, account, quote);
  if (
    !ledger ||
    !Number.isSafeInteger(ledger.baseFeeStroops) ||
    !Number.isSafeInteger(ledger.baseReserveStroops) ||
    ledger.baseFeeStroops < 0 ||
    ledger.baseReserveStroops < 0
  ) {
    throw new Error('quote_unavailable');
  }
  return ledger;
}

async function loadActive(
  dependencies: PathPaymentPreflightDependencies,
  account: Pick<AccountRecord, 'address' | 'networkId' | 'identityKind'>,
  quote: PathPaymentQuote,
  address: string,
  error: string,
): Promise<StellarAccountState> {
  let response: StellarAccountStateResult;
  try {
    response = await dependencies.gateway.loadAccountState(address);
  } catch {
    throw new Error('quote_unavailable');
  }
  assertContext(dependencies, account, quote);
  if (!response || response.status !== 'active') {
    throw new Error(error);
  }
  if (!response.account || response.account.address !== address) {
    throw new Error('invalid_request');
  }
  if (
    !Array.isArray(response.account.balances) ||
    response.account.balances.some(
      balance => !balance || !['native', 'credit', 'liquidity-pool-share'].includes(balance.kind),
    )
  ) {
    throw new Error('quote_unavailable');
  }
  return response.account;
}

function validateMemo(memo: PathPaymentQuote['request']['memo']) {
  try {
    return validatePaymentMemo(memo);
  } catch {
    throw new Error('invalid_request');
  }
}

function assertSourceCanPay(
  source: StellarAccountState,
  asset: StellarPaymentAsset,
  sourceAmount: bigint,
  ledger: StellarLedgerParameters,
  actualFeeStroops: number,
): void {
  const spendable = sourceSpendableStroops(source, asset, ledger, actualFeeStroops);
  if (spendable !== undefined && sourceAmount > spendable) throw new Error('insufficient_source');
}

// Display-only estimate based on the same current-ledger source bounds used by
// exact-XDR preflight. Never a substitute for preparing and checking the trade.
// An issuer has no finite source trustline balance, so Max is unavailable.
export function projectPathPaymentSpendable(
  source: StellarAccountState,
  asset: StellarPaymentAsset,
  ledger: StellarLedgerParameters,
  actualFeeStroops: number,
): string | undefined {
  const amount = sourceSpendableStroops(source, asset, ledger, actualFeeStroops);
  return amount === undefined
    ? undefined
    : `${amount / STROOPS_PER_UNIT}.${(amount % STROOPS_PER_UNIT).toString().padStart(7, '0')}`;
}

function sourceSpendableStroops(
  source: StellarAccountState,
  asset: StellarPaymentAsset,
  ledger: StellarLedgerParameters,
  actualFeeStroops: number,
): bigint | undefined {
  if (
    !Number.isSafeInteger(ledger.baseReserveStroops) ||
    ledger.baseReserveStroops < 0 ||
    !Number.isSafeInteger(actualFeeStroops) ||
    actualFeeStroops < 0
  )
    throw new Error('quote_unavailable');
  const { subentryCount, numSponsoring, numSponsored } = source;
  if ([subentryCount, numSponsoring, numSponsored].some(value => !Number.isSafeInteger(value) || value < 0))
    throw new Error('quote_unavailable');
  const reserveUnits = Math.max(0, 2 + subentryCount + numSponsoring - numSponsored);
  if (!Number.isSafeInteger(reserveUnits)) throw new Error('quote_unavailable');

  const native = source.balances.find(balance => balance.kind === 'native');
  if (!native || native.kind !== 'native') throw new Error('insufficient_source');
  const freeNative =
    parseStroops(native.balance) -
    parseStroops(native.sellingLiabilities) -
    BigInt(reserveUnits) * BigInt(ledger.baseReserveStroops);
  if (freeNative < BigInt(actualFeeStroops)) throw new Error('insufficient_source');

  if (asset.kind === 'native') return freeNative - BigInt(actualFeeStroops);
  if (asset.issuer === source.address) return undefined;
  const line = findTrustline(source, asset);
  if (!line) throw new Error('insufficient_source');
  if (!line.isAuthorized) throw new Error('not_authorized');
  const available = parseStroops(line.balance) - parseStroops(line.sellingLiabilities);
  return available > 0n ? available : 0n;
}

function assertDestinationCanReceive(
  destination: StellarAccountState,
  asset: StellarPaymentAsset,
  amount: bigint,
): void {
  if (asset.kind === 'native') {
    const native = destination.balances.find(balance => balance.kind === 'native');
    if (!native || native.kind !== 'native') throw new Error('line_full');
    const committed = parseStroops(native.balance) + parseStroops(native.buyingLiabilities ?? '0');
    if (committed + amount > MAX_STROOPS) throw new Error('line_full');
    return;
  }
  if (asset.issuer === destination.address) return;
  const line = findTrustline(destination, asset);
  if (!line || line.limit === undefined) throw new Error('destination_no_trust');
  if (!line.isAuthorized) throw new Error('not_authorized');
  const committed = parseStroops(line.balance) + parseStroops(line.buyingLiabilities);
  if (committed + amount > parseStroops(line.limit)) throw new Error('line_full');
}

function findTrustline(
  account: StellarAccountState,
  asset: Extract<StellarPaymentAsset, { kind: 'credit' }>,
): StellarTrustlineBalance | undefined {
  return account.balances.find(
    (balance): balance is StellarTrustlineBalance =>
      balance.kind === 'credit' && balance.code === asset.code && balance.issuer === asset.issuer,
  );
}

function parseStroops(value: string): bigint {
  if (typeof value !== 'string' || value.length > 20) throw new Error('quote_unavailable');
  const match = /^(0|[1-9]\d*)(?:\.(\d{1,7}))?$/.exec(value);
  if (!match) throw new Error('quote_unavailable');
  const amount = BigInt(match[1]) * STROOPS_PER_UNIT + BigInt((match[2] ?? '').padEnd(7, '0') || '0');
  if (amount > MAX_STROOPS) throw new Error('quote_unavailable');
  return amount;
}
