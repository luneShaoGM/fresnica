import { APP_CONFIG } from '../../app/config/appConfig';
import type { FresnicaSdk } from '../../platform/fresnica/FresnicaSdk';
import type { SignerRecord } from '../signer/types';
import type { ReviewedTransaction } from '../transaction/ReviewedTransaction';

export type ReviewedTransactionSigningResult =
  | {
      status: 'signed';
      authorization: 'system-auth' | 'passcode';
      signedTransactionXdrBase64: string;
    }
  | { status: 'passcode-required' }
  | { status: 'unsupported-signer' };

export async function signReviewedTransaction(input: {
  sdk: FresnicaSdk;
  review: ReviewedTransaction;
  signer: SignerRecord;
  appPasscode?: string;
  systemAuthReason?: string;
}): Promise<ReviewedTransactionSigningResult> {
  const { sdk, review, signer } = input;

  if (signer.kind !== 'protected-software' || !signer.envelopeJson) {
    return { status: 'unsupported-signer' };
  }

  const hasSystemAuth = await sdk.hasSignerSystemAuth(signer.publicKey);
  if (hasSystemAuth) {
    const signedTransactionXdrBase64 = await sdk.signWithSystemAuth({
      envelopeJson: signer.envelopeJson,
      expectedSignerPublicKey: signer.publicKey,
      transactionXdrBase64: review.transactionXdrBase64,
      networkPassphrase: APP_CONFIG.network.networkPassphrase,
      reason: input.systemAuthReason ?? 'Confirm Fresnica transaction',
    });

    return {
      status: 'signed',
      authorization: 'system-auth',
      signedTransactionXdrBase64,
    };
  }

  if (!input.appPasscode) {
    return { status: 'passcode-required' };
  }

  const signedTransactionXdrBase64 = await sdk.signWithPasscode({
    envelopeJson: signer.envelopeJson,
    appPasscode: input.appPasscode,
    expectedSignerPublicKey: signer.publicKey,
    transactionXdrBase64: review.transactionXdrBase64,
    networkPassphrase: APP_CONFIG.network.networkPassphrase,
  });

  return {
    status: 'signed',
    authorization: 'passcode',
    signedTransactionXdrBase64,
  };
}
