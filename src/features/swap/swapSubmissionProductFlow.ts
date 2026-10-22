import type { AccountRecord } from '../../capabilities/account/types';
import {
  submitReviewedPathPayment,
  type PathPaymentSubmissionDependencies,
} from '../../capabilities/path-payment/submitReviewedPathPayment';
import type { PreparedPathPaymentReview } from '../../capabilities/path-payment/types';
import type {
  PendingSubmissionDependencies,
  PendingSubmissionRecord,
} from '../../capabilities/transaction/pendingSubmission';
import type { SubmitReviewedTransactionResult } from '../../capabilities/transaction/submitReviewedTransaction';

type SwapHistoryRepository = Readonly<{
  listByAccount(networkId: string, accountId: string, intentKind: string): PendingSubmissionRecord[];
}>;

export type SwapSubmissionProductDependencies = Omit<
  PathPaymentSubmissionDependencies,
  'isCurrentSession' | 'recovery'
> &
  Readonly<{
    // Only the Swap product boundary needs a terminal/restart history view.
    recovery: Omit<PendingSubmissionDependencies, 'repository'> &
      Readonly<{
        repository: PendingSubmissionDependencies['repository'] & SwapHistoryRepository;
      }>;
    transactionRecovery: Readonly<{ reconcile: (reason: 'manual-refresh') => Promise<unknown> }>;
  }>;

export type SwapReconciliationView = Readonly<{
  pending: readonly PendingSubmissionRecord[];
  checked: readonly PendingSubmissionRecord[];
}>;

function assertCurrent(
  deps: SwapSubmissionProductDependencies,
  account: AccountRecord,
  isCurrentSession: () => boolean,
): void {
  let live = false;
  try {
    live = isCurrentSession?.() === true;
  } catch {
    // Failing to read the current App account is never permission to sign.
  }
  if (
    !live ||
    account.hidden ||
    account.identityKind !== 'classic' ||
    account.networkId !== deps.network.id ||
    deps.gateway.network.id !== deps.network.id ||
    deps.gateway.network.networkPassphrase !== deps.network.networkPassphrase ||
    deps.inspector.network.id !== deps.network.id ||
    deps.inspector.network.networkPassphrase !== deps.network.networkPassphrase
  ) {
    throw new Error('swap-session-stale');
  }
}

/** Only unresolved Path Payments belonging to the currently focused wallet. */
export function listSwapPending(
  deps: SwapSubmissionProductDependencies,
  account: AccountRecord,
  isCurrentSession: () => boolean,
): readonly PendingSubmissionRecord[] {
  assertCurrent(deps, account, isCurrentSession);
  const pending = deps.recovery.repository
    .listUnresolved(deps.network.id)
    .filter(
      record =>
        record.networkId === deps.network.id &&
        record.accountId === account.id &&
        record.sourceAddress === account.address &&
        record.intentKind === 'path-payment',
    );
  assertCurrent(deps, account, isCurrentSession);
  return pending;
}

/** Recover unresolved AND terminal public submission metadata across restarts. */
export function listSwapHistory(
  deps: SwapSubmissionProductDependencies,
  account: AccountRecord,
  isCurrentSession: () => boolean,
): readonly PendingSubmissionRecord[] {
  assertCurrent(deps, account, isCurrentSession);
  const records = deps.recovery.repository
    .listByAccount(deps.network.id, account.id, 'path-payment')
    .filter(record => record.sourceAddress === account.address)
    .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
    .slice(0, 10);
  assertCurrent(deps, account, isCurrentSession);
  return records;
}

/** Explicit user approval of the SAME prepared XDR, never a new quote or build. */
export async function submitSwapReview(
  deps: SwapSubmissionProductDependencies,
  account: AccountRecord,
  review: PreparedPathPaymentReview,
  isCurrentSession: () => boolean,
  appPassphrase?: string,
): Promise<SubmitReviewedTransactionResult> {
  assertCurrent(deps, account, isCurrentSession);
  // Conservative UI policy: do not begin another Swap while ANY earlier Swap
  // from the current account is unresolved. Reconciliation never re-broadcasts.
  if (listSwapPending(deps, account, isCurrentSession).length > 0) {
    throw new Error('swap-unresolved-pending');
  }
  const signers = deps.signerRepository.listSignersForAccount(account.id);
  assertCurrent(deps, account, isCurrentSession);
  if (signers.length !== 1) return { status: 'unsupported-signer' };
  return submitReviewedPathPayment({ ...deps, isCurrentSession }, account, review, signers[0], appPassphrase);
}

/** Reuse the existing app-wide ledger reconciliation. NEVER resubmit XDR. */
export async function reconcileSwapPending(
  deps: SwapSubmissionProductDependencies,
  account: AccountRecord,
  isCurrentSession: () => boolean,
): Promise<SwapReconciliationView> {
  const before = listSwapPending(deps, account, isCurrentSession);
  if (before.length === 0) return { pending: [], checked: [] };
  await deps.transactionRecovery.reconcile('manual-refresh');
  assertCurrent(deps, account, isCurrentSession);
  const checked = before
    .map(record => deps.recovery.repository.get(deps.network.id, record.transactionHash))
    .filter(
      (record): record is PendingSubmissionRecord =>
        record !== undefined &&
        record.accountId === account.id &&
        record.sourceAddress === account.address &&
        record.intentKind === 'path-payment',
    );
  return { pending: listSwapPending(deps, account, isCurrentSession), checked };
}
