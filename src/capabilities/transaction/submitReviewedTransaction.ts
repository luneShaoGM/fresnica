import type { FresnicaSdkPort } from '../ports/FresnicaSdkPort';
import type { TransactionGatewayPort } from './TransactionGateway';
import { resolveLocalSigner } from '../ledger-authorization/resolveLocalSigner';
import type { StellarThresholdLevel } from '../ledger-authorization/types';
import type { SignerRecord } from '../signer/types';
import { signReviewedTransaction } from '../signing/signReviewedTransaction';
import { assertReviewedTransactionFresh } from './assertReviewedTransactionFresh';
import type { ReviewedTransaction } from './ReviewedTransaction';
import {
  pendingSubmissionId,
  type PendingSubmissionDependencies,
  type TransactionIntentIdentity,
} from './pendingSubmission';

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
  accountId: string;
  intent: TransactionIntentIdentity;
  recovery: PendingSubmissionDependencies;
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

  const transactionHash = input.gateway.transactionHash(signing.signedTransactionXdrBase64);
  const startedAt = input.recovery.now();
  input.recovery.repository.create({
    id: pendingSubmissionId(input.review.networkId, transactionHash),
    networkId: input.review.networkId,
    accountId: input.accountId,
    sourceAddress: input.review.source,
    transactionHash,
    intentKind: input.intent.kind,
    intentKey: input.intent.key,
    state: 'submitting',
    createdAt: startedAt,
    updatedAt: startedAt,
  });

  const submission = await input.gateway.submitTransaction(signing.signedTransactionXdrBase64);
  const completedAt = input.recovery.now();

  if (submission.status === 'accepted') {
    if (submission.hash !== transactionHash) {
      input.recovery.repository.markUncertain(input.review.networkId, transactionHash, completedAt);
      return {status: 'uncertain', transactionHash};
    }
    input.recovery.repository.markConfirmed(
      input.review.networkId,
      transactionHash,
      completedAt,
      submission.ledger,
    );
    return {
      status: 'submitted',
      authorization: signing.authorization,
      hash: transactionHash,
      ...(submission.ledger === undefined ? {} : { ledger: submission.ledger }),
    };
  }

  if (submission.transactionHash !== transactionHash) {
    input.recovery.repository.markUncertain(input.review.networkId, transactionHash, completedAt);
    return {status: 'uncertain', transactionHash};
  }

  if (submission.status === 'rejected') {
    input.recovery.repository.markRejected(
      input.review.networkId,
      transactionHash,
      completedAt,
      submission.resultCode,
    );
    return submission;
  }

  input.recovery.repository.markUncertain(input.review.networkId, transactionHash, completedAt);
  return submission;
}
