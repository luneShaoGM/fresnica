import type { ReviewedTransaction } from './ReviewedTransaction';

export function assertReviewedTransactionFresh(
  review: ReviewedTransaction,
  nowUnixSeconds: number,
): void {
  if (
    review.expiresAtUnixSeconds !== undefined &&
    review.expiresAtUnixSeconds <= nowUnixSeconds
  ) {
    throw new Error('Reviewed transaction is expired');
  }
}
