import type { FresnicaSdkPort } from '../ports/FresnicaSdkPort';
import { signReviewedTransaction } from '../signing/signReviewedTransaction';
import type { SignerRecord } from '../signer/types';
import type { ReviewedTransaction } from '../transaction/ReviewedTransaction';

export type PreparedDappSignature =
  | Readonly<{ status: 'signed'; signedTransactionXdrBase64: string }>
  | Readonly<{ status: 'passphrase-required' }>
  | Readonly<{ status: 'unsupported-signer' }>;

// Signs the reviewed envelope and stops. The website submits the result.
export async function signPreparedDappTransaction(input: {
  sdk: FresnicaSdkPort;
  signer: SignerRecord;
  review: ReviewedTransaction;
  accountAddress: string;
  networkPassphrase: string;
  appPassphrase?: string;
}): Promise<PreparedDappSignature> {
  if (input.signer.publicKey !== input.accountAddress || input.signer.kind !== 'protected-software') {
    return { status: 'unsupported-signer' };
  }
  const signed = await signReviewedTransaction({
    sdk: input.sdk,
    review: input.review,
    signer: input.signer,
    appPassphrase: input.appPassphrase,
    networkPassphrase: input.networkPassphrase,
    systemAuthReason: 'Sign dApp transaction',
  });
  if (signed.status === 'signed') {
    return { status: 'signed', signedTransactionXdrBase64: signed.signedTransactionXdrBase64 };
  }
  if (signed.status === 'passphrase-required') return { status: 'passphrase-required' };
  return { status: 'unsupported-signer' };
}
