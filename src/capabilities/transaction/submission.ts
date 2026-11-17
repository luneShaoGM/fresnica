export type TransactionSubmissionResult =
  | { status: 'accepted'; hash: string; ledger?: number }
  | { status: 'rejected'; transactionHash: string; resultCode?: string; operationResultCodes?: readonly string[] }
  | { status: 'uncertain'; transactionHash: string };

export type TransactionReconciliationResult =
  | {status: 'confirmed'; transactionHash: string; ledger?: number}
  | {status: 'rejected'; transactionHash: string; resultCode?: string}
  | {status: 'still-unknown'; transactionHash: string};
