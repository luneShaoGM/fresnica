import {
  Account,
  Asset,
  Memo,
  Networks,
  Operation,
  StrKey,
  Transaction,
  TransactionBuilder,
} from '@stellar/stellar-sdk';

import {buildPaymentReview} from '../buildPaymentReview';

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

function createAccountXdr() {
  return new TransactionBuilder(new Account(sourceAddress, '50'), {
    fee: '120',
    networkPassphrase: Networks.TESTNET,
  })
    .addOperation(
      Operation.createAccount({
        destination: destinationAddress,
        startingBalance: '1.5000000',
      }),
    )
    .setTimeout(180)
    .build()
    .toXdr();
}

describe('buildPaymentReview', () => {
  it('derives every displayed Payment field and expiry from exact unsigned XDR', () => {
    const xdr = paymentXdr();
    const transaction = new Transaction(xdr, Networks.TESTNET);
    const expectedExpiry = Number(transaction.timeBounds?.maxTime);

    const review = buildPaymentReview({
      transactionXdrBase64: xdr,
      networkId: 'stellar-testnet',
    });

    expect(review).toEqual({
      transactionXdrBase64: xdr,
      networkId: 'stellar-testnet',
      source: sourceAddress,
      operation: 'payment',
      destination: destinationAddress,
      amount: '2.5000000',
      asset: {kind: 'native'},
      memo: 'review-me',
      fee: '100',
      expiresAtUnixSeconds: expectedExpiry,
    });
    expect(Object.isFrozen(review)).toBe(true);
    expect(Object.isFrozen(review.asset)).toBe(true);
  });

  it('derives CreateAccount operation, native asset and starting balance from exact XDR', () => {
    const xdr = createAccountXdr();

    expect(
      buildPaymentReview({transactionXdrBase64: xdr, networkId: 'stellar-testnet'}),
    ).toMatchObject({
      operation: 'create-account',
      source: sourceAddress,
      destination: destinationAddress,
      amount: '1.5000000',
      asset: {kind: 'native'},
      fee: '120',
    });
  });

  it('decodes a Unicode text memo from exact XDR as UTF-8', () => {
    const xdr = paymentXdr({memo: Memo.text('测试 memo')});

    expect(
      buildPaymentReview({
        transactionXdrBase64: xdr,
        networkId: 'stellar-testnet',
      }).memo,
    ).toBe('测试 memo');
  });

  it('derives credit asset code and issuer from exact XDR without case normalization', () => {
    const xdr = paymentXdr({asset: new Asset('usd', issuerAddress)});

    expect(
      buildPaymentReview({
        transactionXdrBase64: xdr,
        networkId: 'stellar-testnet',
      }).asset,
    ).toEqual({kind: 'credit', code: 'usd', issuer: issuerAddress});
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
        transactionXdrBase64: paymentXdr({secondOperation: true}),
        networkId: 'stellar-testnet',
      }),
    ).toThrow('Payment review requires exactly one operation');
  });

  it('rejects an operation-level source override in the v1 single-source flow', () => {
    const otherSource = StrKey.encodeEd25519PublicKey(new Uint8Array(32).fill(13));

    expect(() =>
      buildPaymentReview({
        transactionXdrBase64: paymentXdr({operationSource: otherSource}),
        networkId: 'stellar-testnet',
      }),
    ).toThrow('Payment review does not support an operation source override');
  });

  it('rejects memo types the v1 product review cannot display completely', () => {
    expect(() =>
      buildPaymentReview({
        transactionXdrBase64: paymentXdr({memo: Memo.id('7')}),
        networkId: 'stellar-testnet',
      }),
    ).toThrow('Payment review supports only none or text memo');
  });
});
