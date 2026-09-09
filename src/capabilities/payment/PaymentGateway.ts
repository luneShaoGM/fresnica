import type {
  BuildPaymentInput,
  BuiltTransaction,
  StellarAccountStateResult,
  StellarLedgerParameters,
  StellarPaymentAsset,
} from '../stellar/types';
import type { TransactionGatewayPort } from '../transaction/TransactionGateway';

export type PaymentTransactionProjection = Readonly<{
  source: string;
  fee: string;
  expiresAtUnixSeconds?: number;
  operation: 'payment' | 'create-account';
  destination: string;
  amount: string;
  asset: StellarPaymentAsset;
  memo?: string;
}>;

export interface PaymentGatewayPort extends TransactionGatewayPort {
  isClassicAccountAddress(address: string): boolean;
  loadAccountState(address: string): Promise<StellarAccountStateResult>;
  loadLedgerParameters(): Promise<StellarLedgerParameters>;
  buildPayment(input: BuildPaymentInput): Promise<BuiltTransaction>;
  inspectPaymentTransaction(
    input: Readonly<{
      transactionXdrBase64: string;
      networkPassphrase: string;
    }>,
  ): PaymentTransactionProjection;
}
