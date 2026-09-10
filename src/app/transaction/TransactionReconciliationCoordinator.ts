import type {LedgerReadInvalidationPort} from '@capabilities/transaction/LedgerReadInvalidation';
import type {PendingSubmissionRepository} from '@capabilities/transaction/pendingSubmission';
import {
  reconcilePendingSubmissions,
  type PendingSubmissionReconciliation,
} from '@capabilities/transaction/reconcilePendingSubmissions';
import type {TransactionGatewayPort} from '@capabilities/transaction/TransactionGateway';

export type TransactionReconciliationReason =
  | 'cold-start'
  | 'foreground'
  | 'network-recovery'
  | 'manual-refresh';

export type TransactionReconciliationCoordinator = Readonly<{
  reconcile: (
    reason: TransactionReconciliationReason,
  ) => Promise<readonly PendingSubmissionReconciliation[]>;
}>;

type Dependencies = Readonly<{
  gateway: Pick<TransactionGatewayPort, 'loadTransactionOutcome'>;
  repository: PendingSubmissionRepository;
  readInvalidation: LedgerReadInvalidationPort;
  networkId: string;
  now?: () => Date;
  onRunStart?: (reason: TransactionReconciliationReason) => void;
  onRunFailure?: (reason: TransactionReconciliationReason, error: unknown) => void;
}>;
export function createTransactionReconciliationCoordinator(
  dependencies: Dependencies,
): TransactionReconciliationCoordinator {
  let inFlight: Promise<readonly PendingSubmissionReconciliation[]> | undefined;
  let trailingReason: TransactionReconciliationReason | undefined;

  async function runUntilIdle(
    initialReason: TransactionReconciliationReason,
  ): Promise<readonly PendingSubmissionReconciliation[]> {
    let reason: TransactionReconciliationReason | undefined = initialReason;
    let lastResult: readonly PendingSubmissionReconciliation[] = [];
    let firstFailure: Readonly<{error: unknown}> | undefined;

    while (reason) {
      const runReason = reason;
      reason = undefined;
      dependencies.onRunStart?.(runReason);

      try {
        lastResult = await reconcilePendingSubmissions({
          gateway: dependencies.gateway,
          repository: dependencies.repository,
          readInvalidation: dependencies.readInvalidation,
          networkId: dependencies.networkId,
          ...(dependencies.now === undefined ? {} : {now: dependencies.now}),
        });
      } catch (error) {
        dependencies.onRunFailure?.(runReason, error);
        firstFailure ??= {error};
      }

      if (trailingReason) {
        reason = trailingReason;
        trailingReason = undefined;
      }
    }

    if (firstFailure) {
      throw firstFailure.error;
    }
    return lastResult;
  }

  return {
    reconcile(reason) {
      if (inFlight) {
        trailingReason = reason;
        return inFlight;
      }

      const run = runUntilIdle(reason);
      const tracked = run.finally(() => {
        if (inFlight === tracked) {
          inFlight = undefined;
        }
      });
      inFlight = tracked;
      return tracked;
    },
  };
}
