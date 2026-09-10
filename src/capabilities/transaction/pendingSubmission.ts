export type TransactionIntentIdentity = Readonly<{
  kind: string;
  key: string;
}>;

export type PendingSubmissionState = 'submitting' | 'uncertain' | 'confirmed' | 'rejected';

export type PendingSubmissionRecord = Readonly<{
  id: string;
  networkId: string;
  accountId: string;
  sourceAddress: string;
  transactionHash: string;
  intentKind: string;
  intentKey: string;
  state: PendingSubmissionState;
  createdAt: Date;
  updatedAt: Date;
  lastCheckedAt?: Date;
  ledger?: number;
  resultCode?: string;
}>;
export interface PendingSubmissionRepository {
  create(record: PendingSubmissionRecord): void;
  get(networkId: string, transactionHash: string): PendingSubmissionRecord | undefined;
  findBlockingIntent(networkId: string, accountId: string, intentKey: string): PendingSubmissionRecord | undefined;
  listUnresolved(networkId?: string): PendingSubmissionRecord[];
  markUncertain(networkId: string, transactionHash: string, checkedAt: Date): void;
  markConfirmed(networkId: string, transactionHash: string, checkedAt: Date, ledger?: number): void;
  markRejected(networkId: string, transactionHash: string, checkedAt: Date, resultCode?: string): void;
  markStillUnknown(networkId: string, transactionHash: string, checkedAt: Date): void;
}

export type PendingSubmissionDependencies = Readonly<{
  repository: PendingSubmissionRepository;
  now: () => Date;
}>;
export function createTransactionIntentIdentity(
  kind: string,
  components: readonly string[],
): TransactionIntentIdentity {
  const normalizedKind = kind.trim();
  if (!normalizedKind) {
    throw new Error('invalid-transaction-intent-kind');
  }
  return Object.freeze({
    kind: normalizedKind,
    key: JSON.stringify([normalizedKind, ...components]),
  });
}

export function pendingSubmissionId(networkId: string, transactionHash: string): string {
  return `${networkId}:${transactionHash}`;
}

export function isPendingSubmissionBlocking(record: PendingSubmissionRecord): boolean {
  return record.state === 'submitting' || record.state === 'uncertain';
}
