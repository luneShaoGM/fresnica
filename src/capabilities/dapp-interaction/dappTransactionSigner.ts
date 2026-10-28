export type DappTransactionSignResult =
  | Readonly<{ status: 'ready'; source: string; fee: string; operationCount: number }>
  | Readonly<{ status: 'signed'; signedTransaction: string; signerAddress: string }>
  | Readonly<{ status: 'passphrase-required' }>
  | Readonly<{ status: 'invalid' }>
  | Readonly<{ status: 'unsupported-signer' }>;

export type DappTransactionSigner = (input: {
  phase: 'inspect' | 'sign';
  accountId: string;
  accountAddress: string;
  networkId: string;
  networkPassphrase: string;
  transactionXdrBase64: string;
  appPassphrase?: string;
}) => Promise<DappTransactionSignResult>;
