import { assertReviewedTransactionFresh } from '../assertReviewedTransactionFresh';
import type { ReviewedTransaction } from '../ReviewedTransaction';

const review: ReviewedTransaction = Object.freeze({
  transactionXdrBase64: 'AAAA-reviewed-xdr',
  networkId: 'stellar-testnet',
  source: 'GSOURCE',
  fee: '100',
  expiresAtUnixSeconds: 1000,
});

describe('assertReviewedTransactionFresh', () => {
  it('allows a reviewed transaction strictly before its maximum time', () => {
    expect(() => assertReviewedTransactionFresh(review, 999)).not.toThrow();
  });

  it('fails closed when the reviewed transaction reaches its maximum time', () => {
    expect(() => assertReviewedTransactionFresh(review, 1000)).toThrow(
      'Reviewed transaction is expired',
    );
  });

  it('allows a reviewed transaction with no maximum time', () => {
    expect(() =>
      assertReviewedTransactionFresh(
        Object.freeze({
          transactionXdrBase64: 'AAAA-no-max-time',
          networkId: 'stellar-testnet',
          source: 'GSOURCE',
          fee: '100',
        }),
        1000,
      ),
    ).not.toThrow();
  });
});
