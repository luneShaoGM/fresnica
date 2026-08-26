import type { FresnicaCore } from '../../fresnica/FresnicaCore';
import type { SignerRecord } from '../../storage/domain/types';
import type { StellarGateway } from '../gateway/StellarGateway';
import type { PaymentReview } from '../review/buildPaymentReview';
import { resolveLocalSigner } from './resolveLocalSigner';
import { signReviewedPayment } from './signReviewedPayment';

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
    };

export async function submitReviewedPayment(input: {
  gateway: StellarGateway;
  core: FresnicaCore;
  review: PaymentReview;
  signer: SignerRecord;
  appPasscode?: string;
  systemAuthReason?: string;
}): Promise<SubmitReviewedPaymentResult> {
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

  const signing = await signReviewedPayment({
    core: input.core,
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

  const submitted = await input.gateway.submitTransaction(
    signing.signedTransactionXdrBase64,
  );

  return {
    status: 'submitted',
    authorization: signing.authorization,
    hash: submitted.hash,
    ...(submitted.ledger === undefined ? {} : { ledger: submitted.ledger }),
  };
}
