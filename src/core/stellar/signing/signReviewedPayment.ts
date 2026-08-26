import { APP_CONFIG } from '../../../app/config/appConfig';
import type { FresnicaCore } from '../../fresnica/FresnicaCore';
import type { SignerRecord } from '../../storage/domain/types';
import type { PaymentReview } from '../review/buildPaymentReview';

export type ReviewedPaymentSigningResult =
  | {
      status: 'signed';
      authorization: 'system-auth' | 'passcode';
      signedTransactionXdrBase64: string;
    }
  | { status: 'passcode-required' }
  | { status: 'unsupported-signer' };

export async function signReviewedPayment(input: {
  core: FresnicaCore;
  review: PaymentReview;
  signer: SignerRecord;
  appPasscode?: string;
  systemAuthReason?: string;
}): Promise<ReviewedPaymentSigningResult> {
  const { core, review, signer } = input;

  if (signer.kind !== 'protected-software' || !signer.envelopeJson) {
    return { status: 'unsupported-signer' };
  }

  const hasSystemAuth = await core.hasSignerSystemAuth(signer.publicKey);
  if (hasSystemAuth) {
    const signedTransactionXdrBase64 = await core.signWithSystemAuth({
      envelopeJson: signer.envelopeJson,
      expectedSignerPublicKey: signer.publicKey,
      transactionXdrBase64: review.transactionXdrBase64,
      networkPassphrase: APP_CONFIG.network.networkPassphrase,
      reason: input.systemAuthReason ?? 'Confirm Fresnica payment',
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

  const signedTransactionXdrBase64 = await core.signWithPasscode({
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
