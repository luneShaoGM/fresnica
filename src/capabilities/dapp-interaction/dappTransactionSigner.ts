import type { DappTransactionIntent } from './dappTransactionIntent';

export type DappTransactionSignResult =
  | Readonly<{ status: 'ready'; intent: DappTransactionIntent }>
  | Readonly<{ status: 'signed'; signedTransaction: string; signerAddress: string }>
  | Readonly<{ status: 'passphrase-required' }>
  | Readonly<{ status: 'invalid' }>
  | Readonly<{ status: 'unsupported-signer' }>;

type DappSignerContext = Readonly<{
  accountId: string;
  accountAddress: string;
  networkId: string;
  networkPassphrase: string;
  transactionXdrBase64: string;
}>;

export type DappTransactionSigner = (
  input: DappSignerContext &
    (
      | Readonly<{ phase: 'inspect' }>
      | Readonly<{
          phase: 'sign';
          reviewedHash: string;
          isCurrent: () => boolean;
          appPassphrase?: string;
        }>
    ),
) => Promise<DappTransactionSignResult>;
