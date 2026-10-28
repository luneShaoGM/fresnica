import { FeeBumpTransaction, Transaction } from '@stellar/stellar-sdk';

export type TransactionIdentity = Readonly<{
  source: string;
  fee: string;
  operationCount: number;
  expiresAtUnixSeconds?: number;
}>;

export function readTransactionIdentity(
  transactionXdrBase64: string,
  networkPassphrase: string,
): TransactionIdentity | undefined {
  const transaction = readTransaction(transactionXdrBase64, networkPassphrase);
  if (!transaction) return undefined;
  const maxTime = transaction.timeBounds?.maxTime;
  const expiresAtUnixSeconds = maxTime !== undefined && maxTime !== '0' ? Number(maxTime) : undefined;
  return Object.freeze({
    source: transaction.source,
    fee: transaction.fee,
    operationCount: transaction.operations.length,
    ...(expiresAtUnixSeconds === undefined ? {} : { expiresAtUnixSeconds }),
  });
}

function readTransaction(transactionXdrBase64: string, networkPassphrase: string): Transaction | undefined {
  try {
    return new Transaction(transactionXdrBase64, networkPassphrase);
  } catch {
    try {
      return new FeeBumpTransaction(transactionXdrBase64, networkPassphrase).innerTransaction;
    } catch {
      return undefined;
    }
  }
}
