import type { Asset } from './asset';

export type Operation =
  | { kind: 'payment'; asset: Asset; destination: string; amount: string }
  | { kind: 'change-trust'; asset: Extract<Asset, { kind: 'classic' }>; limit?: string }
  | { kind: 'invoke-contract'; contractId: string; functionName: string }
  | { kind: 'manage-data'; name: string; value: string | null };

export type TransactionIntent = {
  sourceAccount: string;
  operations: Operation[];
  memo?: { type: 'text' | 'id' | 'hash' | 'return'; value: string };
};

export type UnsignedTransaction = {
  envelopeXdr: string;
  networkPassphrase: string;
};

export type SignedTransaction = {
  envelopeXdr: string;
};
