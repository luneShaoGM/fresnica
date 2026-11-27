import { Asset, Transaction, xdr } from '@stellar/stellar-sdk';

// Only explicitly reviewable Classic operations are accepted. Reject fee bumps, Soroban,
// contract calls, unsupported preconditions and every other operation type.
import type {
  DappOperationIntent,
  DappTransactionIntent,
} from '../../capabilities/dapp-interaction/dappTransactionIntent';

export function readReviewableDappTransaction(
  transactionXdrBase64: string,
  networkPassphrase: string,
  expectedSource: string,
): DappTransactionIntent | undefined {
  try {
    // Deliberately do not unwrap fee-bump envelopes: an inner transaction
    // summary does not describe the fee source or the entire signed envelope.
    const envelope = xdr.TransactionEnvelope.fromXDR(transactionXdrBase64, 'base64');
    if (envelope.type === 'envelopeTypeTx' && envelope.v1.tx.ext.type !== 'v0') return undefined;
    if (envelope.type !== 'envelopeTypeTx' && envelope.type !== 'envelopeTypeTxV0') return undefined;
    const transaction = new Transaction(envelope, networkPassphrase);
    if (
      transaction.source !== expectedSource ||
      transaction.operations.length === 0 ||
      transaction.operations.length > 10 ||
      transaction.signatures.length !== 0 ||
      transaction.ledgerBounds !== undefined ||
      transaction.minAccountSequence !== undefined ||
      transaction.minAccountSequenceAge !== undefined ||
      transaction.minAccountSequenceLedgerGap !== undefined ||
      (transaction.extraSigners !== undefined && transaction.extraSigners.length > 0)
    ) {
      return undefined;
    }

    // Other memo types are unsupported until their exact semantics are
    // displayed; never silently omit transaction-level intent.
    const memo = transaction.memo;
    if (memo.type !== 'none' && memo.type !== 'text') return undefined;
    const operations: DappOperationIntent[] = [];
    for (const operation of transaction.operations) {
      if (operation.source !== undefined && operation.source !== expectedSource) return undefined;
      if (operation.type === 'createAccount') {
        if (
          transaction.operations.length !== 1 ||
          !/^(?!0(?:\.0+)?$)\d+(?:\.\d{1,7})?$/.test(operation.startingBalance)
        ) {
          return undefined;
        }
        operations.push(
          Object.freeze({
            type: 'create-account',
            destination: operation.destination,
            amount: operation.startingBalance,
            assetCode: 'XLM',
          }),
        );
        continue;
      }
      if (operation.type === 'changeTrust') {
        if (
          transaction.operations.length !== 1 ||
          !(operation.line instanceof Asset) ||
          operation.line.isNative() ||
          !/^(?!0(?:\.0+)?$)\d+(?:\.\d{1,7})?$/.test(operation.limit)
        )
          return undefined;
        const assetIssuer = operation.line.getIssuer();
        if (!assetIssuer || assetIssuer === expectedSource) return undefined;
        operations.push(
          Object.freeze({
            type: 'change-trust',
            assetCode: operation.line.getCode(),
            assetIssuer,
            limit: operation.limit,
          }),
        );
        continue;
      }
      if (operation.type !== 'payment') return undefined;
      const assetCode = operation.asset.isNative() ? 'XLM' : operation.asset.getCode();
      const assetIssuer = operation.asset.isNative() ? undefined : operation.asset.getIssuer();
      if (!assetCode || (!operation.asset.isNative() && !assetIssuer)) return undefined;
      operations.push(
        Object.freeze({
          type: 'payment',
          source: operation.source ?? expectedSource,
          destination: operation.destination,
          amount: operation.amount,
          assetCode,
          ...(assetIssuer === undefined ? {} : { assetIssuer }),
        }),
      );
    }

    return Object.freeze({
      // Hash is network-passphrase-bound to the original exact XDR.
      hash: Array.from(transaction.hash(), byte => byte.toString(16).padStart(2, '0')).join(''),
      source: transaction.source,
      sequence: transaction.sequence,
      fee: transaction.fee,
      memo: memo.type === 'text' ? String(memo.value) : null,
      ...(transaction.timeBounds === undefined
        ? {}
        : {
            timeBounds: Object.freeze({
              minTime: transaction.timeBounds.minTime,
              maxTime: transaction.timeBounds.maxTime,
            }),
          }),
      operations: Object.freeze(operations),
    });
  } catch {
    return undefined;
  }
}
