export type TransactionSubmissionResult =
  | { status: 'accepted'; hash: string; ledger?: number }
  | { status: 'rejected'; transactionHash: string; resultCode?: string }
  | { status: 'uncertain'; transactionHash: string };
