import type { FresnicaSdkPort } from '../ports/FresnicaSdkPort';
import type { SignerRecord } from '../signer/types';
import type { ReviewedTransaction } from '../transaction/ReviewedTransaction';

export type SigningAuthorizationPolicy = 'routine' | 'passphrase-required';

export type ReviewedTransactionSigningResult =
  | {
      status: 'signed';
      authorization: 'system-auth' | 'passphrase';
      signedTransactionXdrBase64: string;
    }
  | { status: 'passphrase-required' }
  | { status: 'unsupported-signer' };

export async function signReviewedTransaction(input: {
  sdk: FresnicaSdkPort;
  review: ReviewedTransaction;
  signer: SignerRecord;
  appPassphrase?: string;
  systemAuthReason?: string;
  authorizationPolicy?: SigningAuthorizationPolicy;
  networkPassphrase: string;
}): Promise<ReviewedTransactionSigningResult> {
  const { sdk, review, signer } = input;

  if (signer.kind !== 'protected-software' || !signer.envelopeJson) {
    return { status: 'unsupported-signer' };
  }

  const authorizationPolicy = input.authorizationPolicy ?? 'routine';
  if (authorizationPolicy === 'routine') {
    const hasSystemAuth = await sdk.hasSignerSystemAuth(signer.publicKey);
    if (hasSystemAuth) {
      const signedTransactionXdrBase64 = await sdk.signWithSystemAuth({
        envelopeJson: signer.envelopeJson,
        expectedSignerPublicKey: signer.publicKey,
        transactionXdrBase64: review.transactionXdrBase64,
        networkPassphrase: input.networkPassphrase,
        reason: input.systemAuthReason ?? 'Confirm Fresnica transaction',
      });

      return {
        status: 'signed',
        authorization: 'system-auth',
        signedTransactionXdrBase64,
      };
    }
  }

  if (!input.appPassphrase) {
    return { status: 'passphrase-required' };
  }

  const signedTransactionXdrBase64 = await sdk.signWithPassphrase({
    envelopeJson: signer.envelopeJson,
    appPassphrase: input.appPassphrase,
    expectedSignerPublicKey: signer.publicKey,
    transactionXdrBase64: review.transactionXdrBase64,
    networkPassphrase: input.networkPassphrase,
  });

  return {
    status: 'signed',
    authorization: 'passphrase',
    signedTransactionXdrBase64,
  };
}
