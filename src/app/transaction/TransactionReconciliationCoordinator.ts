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
  networkId: string;
  now?: () => Date;
  onRunStart?: (reason: TransactionReconciliationReason) => void;
  onRunFailure?: (reason: TransactionReconciliationReason, error: unknown) => void;
}>;
export function createTransactionReconciliationCoordinator(
  dependencies: Dependencies,
): TransactionReconciliationCoordinator {
  let inFlight: Promise<readonly PendingSubmissionReconciliation[]> | undefined;

  return {
    reconcile(reason) {
      if (inFlight) {
        return inFlight;
      }

      dependencies.onRunStart?.(reason);
      const run = reconcilePendingSubmissions({
        gateway: dependencies.gateway,
        repository: dependencies.repository,
        networkId: dependencies.networkId,
        ...(dependencies.now === undefined ? {} : {now: dependencies.now}),
      });
      const tracked = run
        .catch(error => {
          dependencies.onRunFailure?.(reason, error);
          throw error;
        })
        .finally(() => {
          if (inFlight === tracked) {
            inFlight = undefined;
          }
        });
      inFlight = tracked;
      return tracked;
    },
  };
}
