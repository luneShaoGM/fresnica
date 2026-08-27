import type { FresnicaSdk } from '../../platform/fresnica/FresnicaSdk';
import type { StellarGateway } from '../../platform/stellar/StellarGateway';
import { resolveLocalSigner } from '../ledger-authorization/resolveLocalSigner';
import type { SignerRecord } from '../signer/types';
import { signReviewedTransaction } from '../signing/signReviewedTransaction';
import { assertReviewedTransactionFresh } from '../transaction/assertReviewedTransactionFresh';
import type { PaymentReview } from './buildPaymentReview';

export type SubmitReviewedPaymentResult =
  | {
      status: 'submitted';
      authorization: 'system-auth' | 'passcode';
      hash: string;
      ledger?: number;
    }
  | { status: 'passcode-required' }
  | { status: 'unsupported-signer' }
  | {
      status: 'authorization-blocked';
      reason: 'watch-only' | 'insufficient-weight' | 'unsupported-multisig';
      requiredWeight: number;
      availableWeight: number;
    }
  | { status: 'rejected'; transactionHash: string; resultCode?: string }
  | { status: 'uncertain'; transactionHash: string };

export async function submitReviewedPayment(input: {
  gateway: StellarGateway;
  sdk: FresnicaSdk;
  review: PaymentReview;
  signer: SignerRecord;
  appPasscode?: string;
  systemAuthReason?: string;
}): Promise<SubmitReviewedPaymentResult> {
  assertReviewedTransactionFresh(
    input.review,
    Math.floor(Date.now() / 1000),
  );

  const authorization = await input.gateway.loadAccountAuthorization(
    input.review.source,
  );
  const resolution = resolveLocalSigner(
    authorization,
    [input.signer.publicKey],
    'medium',
  );

  if (resolution.status !== 'ready') {
    return {
      status: 'authorization-blocked',
      reason: resolution.status,
      requiredWeight: resolution.requiredWeight,
      availableWeight: resolution.availableWeight,
    };
  }

  const signing = await signReviewedTransaction({
    sdk: input.sdk,
    review: input.review,
    signer: input.signer,
    ...(input.appPasscode === undefined
      ? {}
      : { appPasscode: input.appPasscode }),
    ...(input.systemAuthReason === undefined
      ? {}
      : { systemAuthReason: input.systemAuthReason }),
  });

  if (signing.status !== 'signed') {
    return signing;
  }

  const submission = await input.gateway.submitTransaction(
    signing.signedTransactionXdrBase64,
  );

  if (submission.status === 'accepted') {
    return {
      status: 'submitted',
      authorization: signing.authorization,
      hash: submission.hash,
      ...(submission.ledger === undefined ? {} : { ledger: submission.ledger }),
    };
  }

  return submission;
}
