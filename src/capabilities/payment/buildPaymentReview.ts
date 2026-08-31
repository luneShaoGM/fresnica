import {Transaction} from '@stellar/stellar-sdk';

import {APP_CONFIG} from '../../app/config/appConfig';
import type {ReviewedTransaction} from '../transaction/ReviewedTransaction';

export type PaymentReviewAsset =
  | {kind: 'native'}
  | {kind: 'credit'; code: string; issuer: string};

export type PaymentReview = ReviewedTransaction &
  Readonly<{
    destination: string;
    amount: string;
    asset: Readonly<PaymentReviewAsset>;
    memo?: string;
  }>;

export function buildPaymentReview(input: {
  transactionXdrBase64: string;
  networkId: string;
}): PaymentReview {
  if (input.networkId !== APP_CONFIG.network.id) {
    throw new Error('Payment review network mismatch');
  }

  const transaction = new Transaction(
    input.transactionXdrBase64,
    APP_CONFIG.network.networkPassphrase,
  );

  if (transaction.operations.length !== 1) {
    throw new Error('Payment review requires exactly one operation');
  }

  const operation = transaction.operations[0];
  if (operation.type !== 'payment') {
    throw new Error('Payment review requires a payment operation');
  }
  if (operation.source) {
    throw new Error('Payment review does not support an operation source override');
  }

  const asset: PaymentReviewAsset = operation.asset.isNative()
    ? {kind: 'native'}
    : {
        kind: 'credit',
        code: operation.asset.code,
        issuer: operation.asset.issuer!,
      };

  const memo = transaction.memo;
  let memoText: string | undefined;
  if (memo.type === 'text') {
    memoText = decodeUtf8(memo.value as Uint8Array);
  } else if (memo.type !== 'none') {
    throw new Error('Payment review supports only none or text memo');
  }

  const maxTime = transaction.timeBounds?.maxTime;
  const expiresAtUnixSeconds =
    maxTime !== undefined && maxTime !== '0' ? Number(maxTime) : undefined;

  return Object.freeze({
    transactionXdrBase64: input.transactionXdrBase64,
    networkId: input.networkId,
    source: transaction.source,
    destination: operation.destination,
    amount: operation.amount,
    asset: Object.freeze(asset),
    ...(memoText === undefined ? {} : {memo: memoText}),
    fee: transaction.fee,
    ...(expiresAtUnixSeconds === undefined ? {} : {expiresAtUnixSeconds}),
  });
}

function decodeUtf8(bytes: Uint8Array): string {
  const encoded = Array.from(bytes)
    .map(byte => `%${byte.toString(16).padStart(2, '0')}`)
    .join('');

  try {
    return decodeURIComponent(encoded);
  } catch {
    throw new Error('Payment review contains invalid UTF-8 text memo');
  }
}
