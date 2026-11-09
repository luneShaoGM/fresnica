import type { AccountRecord } from '../account/types';
import type { NetworkContext } from '../network/types';
import type { StellarAccountStateResult, StellarLedgerParameters, BuiltTransaction } from '../stellar/types';
import type { TransactionGatewayPort } from '../transaction/TransactionGateway';
import type { ReviewedTransaction } from '../transaction/ReviewedTransaction';
import type { AccountSignerRepository } from '../account/AccountSignerRepository';
import type { FresnicaSdkPort } from '../ports/FresnicaSdkPort';
import type { PendingSubmissionDependencies } from '../transaction/pendingSubmission';
import { createTransactionIntentIdentity } from '../transaction/pendingSubmission';
import {
  submitReviewedTransaction,
  type SubmitReviewedTransactionResult,
} from '../transaction/submitReviewedTransaction';
import { claimAvailability, parseClaimPredicate } from './predicate';
import type { ClaimableRecord } from './records';
import type { ClaimableProduct } from './createClaimableProduct';

export type ClaimableTransactionProjection = Readonly<{
  source: string;
  id: string;
  fee: string;
  expiresAtUnixSeconds?: number;
}>;
export interface ClaimableTransactionGateway extends TransactionGatewayPort {
  loadAccountState(address: string): Promise<StellarAccountStateResult>;
  loadLedgerParameters(): Promise<StellarLedgerParameters>;
  buildClaimClaimableBalance(source: string, id: string, baseFee: string): Promise<BuiltTransaction>;
  inspectClaimClaimableBalance(xdr: string, networkPassphrase: string): ClaimableTransactionProjection;
}
export type ClaimableReview = ReviewedTransaction &
  Readonly<{
    id: string;
    asset: ClaimableRecord['asset'];
    amount: string;
    sponsor: string;
    risk: ClaimableRecord['risk'];
    predicate: unknown;
  }>;

export type ClaimableTransactionDependencies = Readonly<{
  network: NetworkContext;
  reader: ClaimableProduct;
  gateway: ClaimableTransactionGateway;
  repository: AccountSignerRepository;
  sdk: FresnicaSdkPort;
  recovery: PendingSubmissionDependencies;
}>;

function assertAccount(account: AccountRecord, network: NetworkContext): void {
  if (account.networkId !== network.id || account.hidden || account.identityKind !== 'classic')
    throw new Error('claimable-network-account-mismatch');
}

function sameRecord(left: ClaimableRecord, right: ClaimableRecord): boolean {
  return (
    left.id === right.id &&
    left.amount === right.amount &&
    left.claimant === right.claimant &&
    left.asset.kind === right.asset.kind &&
    left.asset.code === right.asset.code &&
    (left.asset.kind === 'native' || (right.asset.kind === 'credit' && left.asset.issuer === right.asset.issuer)) &&
    JSON.stringify(left.predicate) === JSON.stringify(right.predicate)
  );
}

async function verifyCurrent(
  dependencies: ClaimableTransactionDependencies,
  account: AccountRecord,
  record: ClaimableRecord,
): Promise<void> {
  assertAccount(account, dependencies.network);
  const current = await dependencies.reader.current(account, record.id);
  if (!current || !sameRecord(record, current) || current.claimant !== account.address)
    throw new Error('claimable-record-stale-or-claimed');
  if (claimAvailability(parseClaimPredicate(current.predicate), Math.floor(Date.now() / 1000)).kind !== 'claimable')
    throw new Error('claimable-predicate-unavailable');
  const state = await dependencies.gateway.loadAccountState(account.address);
  if (state.status !== 'active' || state.account.address !== account.address)
    throw new Error('claimable-account-inactive');
  if (
    current.asset.kind === 'credit' &&
    !state.account.balances.some(
      line =>
        line.kind === 'credit' &&
        line.code === current.asset.code &&
        line.issuer === (current.asset.kind === 'credit' ? current.asset.issuer : '') &&
        line.isAuthorized,
    )
  )
    throw new Error('claimable-trustline-required');
}

function inspect(
  dependencies: ClaimableTransactionDependencies,
  review: ClaimableReview,
): ClaimableTransactionProjection {
  if (review.networkId !== dependencies.network.id) throw new Error('claimable-review-network-mismatch');
  const exact = dependencies.gateway.inspectClaimClaimableBalance(
    review.transactionXdrBase64,
    dependencies.network.networkPassphrase,
  );
  if (
    exact.source !== review.source ||
    exact.id !== review.id ||
    exact.fee !== review.fee ||
    exact.expiresAtUnixSeconds !== review.expiresAtUnixSeconds
  )
    throw new Error('claimable-review-xdr-mismatch');
  return exact;
}

export async function prepareClaimableReview(
  dependencies: ClaimableTransactionDependencies,
  account: AccountRecord,
  record: ClaimableRecord,
): Promise<ClaimableReview> {
  await verifyCurrent(dependencies, account, record);
  const params = await dependencies.gateway.loadLedgerParameters();
  if (!Number.isSafeInteger(params.baseFeeStroops) || params.baseFeeStroops < 1)
    throw new Error('claimable-fee-invalid');
  const built = await dependencies.gateway.buildClaimClaimableBalance(
    account.address,
    record.id,
    String(params.baseFeeStroops),
  );
  if (built.source !== account.address || built.networkId !== account.networkId)
    throw new Error('claimable-built-account-mismatch');
  const projection = dependencies.gateway.inspectClaimClaimableBalance(
    built.transactionXdrBase64,
    dependencies.network.networkPassphrase,
  );
  if (
    projection.source !== account.address ||
    projection.id !== record.id ||
    !projection.expiresAtUnixSeconds ||
    projection.expiresAtUnixSeconds <= Math.floor(Date.now() / 1000)
  )
    throw new Error('claimable-build-xdr-mismatch');
  return Object.freeze({
    transactionXdrBase64: built.transactionXdrBase64,
    networkId: account.networkId,
    source: projection.source,
    fee: projection.fee,
    expiresAtUnixSeconds: projection.expiresAtUnixSeconds,
    id: record.id,
    asset: record.asset,
    amount: record.amount,
    sponsor: record.sponsor,
    risk: record.risk,
    predicate: record.predicate,
  });
}

export async function submitClaimableReview(
  dependencies: ClaimableTransactionDependencies,
  account: AccountRecord,
  review: ClaimableReview,
  systemAuthReason: string,
  appPassphrase?: string,
): Promise<SubmitReviewedTransactionResult | { status: 'watch-only' | 'unsupported-account-signers' }> {
  assertAccount(account, dependencies.network);
  const exact = inspect(dependencies, review);
  if (exact.source !== account.address) throw new Error('claimable-review-account-mismatch');
  const signers = dependencies.repository.listSignersForAccount(account.id);
  if (!signers.length) return { status: 'watch-only' };
  if (signers.length !== 1) return { status: 'unsupported-account-signers' };
  // Verify fresh authoritative record before signing; cached UI rows never
  // authorize a claim or bypass recipient/predicate restrictions.
  await verifyCurrent(dependencies, account, {
    id: review.id,
    amount: review.amount,
    asset: review.asset,
    claimant: account.address,
    predicate: review.predicate,
    sponsor: review.sponsor,
    risk: review.risk,
    riskFlags: [],
  });
  return submitReviewedTransaction({
    gateway: dependencies.gateway,
    sdk: dependencies.sdk,
    review,
    accountId: account.id,
    intent: createTransactionIntentIdentity('claimable', [review.id]),
    recovery: dependencies.recovery,
    signer: signers[0],
    thresholdLevel: 'medium',
    ...(appPassphrase === undefined ? {} : { appPassphrase }),
    systemAuthReason,
    networkPassphrase: dependencies.network.networkPassphrase,
  });
}
