import type { FresnicaSdkPort } from '../ports/FresnicaSdkPort';
import type { TransactionGatewayPort } from './TransactionGateway';
import { resolveLocalSigner } from '../ledger-authorization/resolveLocalSigner';
import type { StellarThresholdLevel } from '../ledger-authorization/types';
import type { SignerRecord } from '../signer/types';
import { signReviewedTransaction } from '../signing/signReviewedTransaction';
import { assertReviewedTransactionFresh } from './assertReviewedTransactionFresh';
import type { ReviewedTransaction } from './ReviewedTransaction';

export type SubmitReviewedTransactionResult =
  | {
      status: 'submitted';
      authorization: 'system-auth' | 'passphrase';
      hash: string;
      ledger?: number;
    }
  | { status: 'passphrase-required' }
  | { status: 'unsupported-signer' }
  | {
      status: 'authorization-blocked';
      reason: 'watch-only' | 'insufficient-weight' | 'unsupported-multisig';
      requiredWeight: number;
      availableWeight: number;
    }
  | { status: 'rejected'; transactionHash: string; resultCode?: string }
  | { status: 'uncertain'; transactionHash: string };

export async function submitReviewedTransaction(input: {
  gateway: TransactionGatewayPort;
  sdk: FresnicaSdkPort;
  review: ReviewedTransaction;
  signer: SignerRecord;
  thresholdLevel: StellarThresholdLevel;
  appPassphrase?: string;
  systemAuthReason?: string;
  networkPassphrase: string;
}): Promise<SubmitReviewedTransactionResult> {
  assertReviewedTransactionFresh(input.review, Math.floor(Date.now() / 1000));

  const authorization = await input.gateway.loadAccountAuthorization(input.review.source);
  const resolution = resolveLocalSigner(authorization, [input.signer.publicKey], input.thresholdLevel);

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
    ...(input.appPassphrase === undefined ? {} : { appPassphrase: input.appPassphrase }),
    ...(input.systemAuthReason === undefined ? {} : { systemAuthReason: input.systemAuthReason }),
    networkPassphrase: input.networkPassphrase,
  });

  if (signing.status !== 'signed') {
    return signing;
  }

  const submission = await input.gateway.submitTransaction(signing.signedTransactionXdrBase64);

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
