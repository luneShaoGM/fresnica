import {Asset, Transaction} from '@stellar/stellar-sdk';

import {APP_CONFIG} from '../../app/config/appConfig';
import type {ReviewedTransaction} from '../transaction/ReviewedTransaction';

export type TrustlineOperation = 'add' | 'remove';
export type TrustlineAuthorization = 'full' | 'maintain-liabilities' | 'unauthorized';

export type TrustlineReview = ReviewedTransaction &
  Readonly<{
    operation: TrustlineOperation;
    asset: Readonly<{code: string; issuer: string}>;
    limit?: string;
    expectedAuthorization?: TrustlineAuthorization;
    expectedClawbackEnabled?: boolean;
  }>;

export function buildTrustlineReview(input: {
  transactionXdrBase64: string;
  networkId: string;
  expectedAuthorization?: TrustlineAuthorization;
  expectedClawbackEnabled?: boolean;
}): TrustlineReview {
  if (input.networkId !== APP_CONFIG.network.id) {
    throw new Error('Trustline review network mismatch');
  }

  const transaction = new Transaction(
    input.transactionXdrBase64,
    APP_CONFIG.network.networkPassphrase,
  );
  if (transaction.operations.length !== 1) {
    throw new Error('Trustline review requires exactly one operation');
  }

  const operation = transaction.operations[0];
  if (operation.type !== 'changeTrust') {
    throw new Error('Trustline review requires a ChangeTrust operation');
  }
  if (operation.source) {
    throw new Error('Trustline review does not support an operation source override');
  }
  if (!(operation.line instanceof Asset) || operation.line.isNative()) {
    throw new Error('Trustline review supports only ordinary issued assets');
  }

  const isRemove = operation.limit === '0.0000000' || operation.limit === '0';
  const maxTime = transaction.timeBounds?.maxTime;
  const expiresAtUnixSeconds =
    maxTime !== undefined && maxTime !== '0' ? Number(maxTime) : undefined;

  return Object.freeze({
    transactionXdrBase64: input.transactionXdrBase64,
    networkId: input.networkId,
    source: transaction.source,
    fee: transaction.fee,
    ...(expiresAtUnixSeconds === undefined ? {} : {expiresAtUnixSeconds}),
    operation: isRemove ? 'remove' : 'add',
    asset: Object.freeze({
      code: operation.line.code,
      issuer: operation.line.issuer!,
    }),
    ...(isRemove ? {} : {limit: operation.limit}),
    ...(input.expectedAuthorization === undefined
      ? {}
      : {expectedAuthorization: input.expectedAuthorization}),
    ...(input.expectedClawbackEnabled === undefined
      ? {}
      : {expectedClawbackEnabled: input.expectedClawbackEnabled}),
  });
}
