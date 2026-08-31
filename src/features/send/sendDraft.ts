import {Keypair} from '@stellar/stellar-sdk';

import type {BalanceAsset} from '../../capabilities/balance/types';
import type {StellarPaymentAsset} from '../../platform/stellar/types';

export type SendDraftInput = Readonly<{
  destination: string;
  amount: string;
  memo: string;
  asset: BalanceAsset;
}>;

export type ValidatedSendDraft = Readonly<{
  destination: string;
  amount: string;
  memo?: string;
  asset: StellarPaymentAsset;
}>;

export function validateSendDraft(input: SendDraftInput): ValidatedSendDraft {
  const destination = input.destination.trim();
  assertClassicAccount(destination, 'invalid-payment-destination');

  const amount = input.amount.trim();
  if (!/^(?:0|[1-9]\d*)(?:\.\d{1,7})?$/.test(amount)) {
    throw new Error('invalid-payment-amount');
  }
  if (amount.replace(/[.0]/g, '').length === 0) {
    throw new Error('payment-amount-must-be-positive');
  }

  const memo = input.memo;
  if (utf8ByteLength(memo) > 28) {
    throw new Error('payment-memo-too-long');
  }

  const asset: StellarPaymentAsset =
    input.asset.kind === 'native'
      ? {kind: 'native'}
      : validateCreditAsset(input.asset.code, input.asset.issuer);

  return {
    destination,
    amount,
    asset,
    ...(memo.length === 0 ? {} : {memo}),
  };
}

export function sendAssetKey(asset: BalanceAsset): string {
  return asset.kind === 'native' ? 'XLM' : `${asset.code}:${asset.issuer}`;
}

function validateCreditAsset(code: string, issuer: string): StellarPaymentAsset {
  if (code.length === 0) {
    throw new Error('invalid-payment-asset');
  }
  assertClassicAccount(issuer, 'invalid-payment-asset-issuer');
  return {kind: 'credit', code, issuer};
}

function assertClassicAccount(value: string, errorCode: string): void {
  try {
    Keypair.fromPublicKey(value);
  } catch {
    throw new Error(errorCode);
  }
}

function utf8ByteLength(value: string): number {
  let bytes = 0;
  for (const character of value) {
    const codePoint = character.codePointAt(0)!;
    if (codePoint <= 0x7f) {
      bytes += 1;
    } else if (codePoint <= 0x7ff) {
      bytes += 2;
    } else if (codePoint <= 0xffff) {
      bytes += 3;
    } else {
      bytes += 4;
    }
  }
  return bytes;
}
