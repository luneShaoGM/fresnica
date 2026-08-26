import {
  Account,
  Asset,
  Memo,
  Networks,
  Operation,
  StrKey,
  TransactionBuilder,
} from '@stellar/stellar-sdk';

import { buildPaymentReview } from '../buildPaymentReview';

const sourceAddress = StrKey.encodeEd25519PublicKey(new Uint8Array(32).fill(11));
const destinationAddress = StrKey.encodeEd25519PublicKey(
  new Uint8Array(32).fill(12),
);
const issuerAddress = StrKey.encodeEd25519PublicKey(new Uint8Array(32).fill(14));

function paymentXdr(options?: {
  secondOperation?: boolean;
  operationSource?: string;
  asset?: Asset;
  memo?: Memo;
}) {
  let builder = new TransactionBuilder(new Account(sourceAddress, '50'), {
    fee: '100',
    networkPassphrase: Networks.TESTNET,
  })
    .addOperation(
      Operation.payment({
        destination: destinationAddress,
        asset: options?.asset ?? Asset.native(),
        amount: '2.5000000',
        source: options?.operationSource,
      }),
    )
    .addMemo(options?.memo ?? Memo.text('review-me'));

  if (options?.secondOperation) {
    builder = builder.addOperation(
      Operation.payment({
        destination: destinationAddress,
        asset: Asset.native(),
        amount: '1.0000000',
      }),
    );
  }

  return builder.setTimeout(180).build().toXdr();
}

describe('buildPaymentReview', () => {
  it('derives every displayed field from the exact unsigned XDR', () => {
    const xdr = paymentXdr();

    const review = buildPaymentReview({
      transactionXdrBase64: xdr,
      networkId: 'stellar-testnet',
    });

    expect(review).toEqual({
      transactionXdrBase64: xdr,
      networkId: 'stellar-testnet',
      source: sourceAddress,
      destination: destinationAddress,
      amount: '2.5000000',
      asset: { kind: 'native' },
      memo: 'review-me',
      fee: '100',
    });
    expect(Object.isFrozen(review)).toBe(true);
    expect(Object.isFrozen(review.asset)).toBe(true);
  });

  it('derives credit asset code and issuer from the exact XDR', () => {
    const xdr = paymentXdr({ asset: new Asset('USDC', issuerAddress) });

    expect(
      buildPaymentReview({
        transactionXdrBase64: xdr,
        networkId: 'stellar-testnet',
      }).asset,
    ).toEqual({ kind: 'credit', code: 'USDC', issuer: issuerAddress });
  });

  it('rejects a caller network that is not the configured Testnet network', () => {
    expect(() =>
      buildPaymentReview({
        transactionXdrBase64: paymentXdr(),
        networkId: 'stellar-mainnet',
      }),
    ).toThrow('Payment review network mismatch');
  });

  it('rejects more than one operation instead of showing an incomplete summary', () => {
    expect(() =>
      buildPaymentReview({
        transactionXdrBase64: paymentXdr({ secondOperation: true }),
        networkId: 'stellar-testnet',
      }),
    ).toThrow('Payment review requires exactly one operation');
  });

  it('rejects an operation-level source override in the v1 single-source flow', () => {
    const otherSource = StrKey.encodeEd25519PublicKey(new Uint8Array(32).fill(13));

    expect(() =>
      buildPaymentReview({
        transactionXdrBase64: paymentXdr({ operationSource: otherSource }),
        networkId: 'stellar-testnet',
      }),
    ).toThrow('Payment review does not support an operation source override');
  });

  it('rejects memo types the v1 review cannot display completely', () => {
    expect(() =>
      buildPaymentReview({
        transactionXdrBase64: paymentXdr({ memo: Memo.id('7') }),
        networkId: 'stellar-testnet',
      }),
    ).toThrow('Payment review supports only none or text memo');
  });
});
