import {
  Account,
  Asset,
  Networks,
  Operation,
  StrKey,
  Transaction,
  TransactionBuilder,
} from '@stellar/stellar-sdk';

import {buildTrustlineReview} from '../buildTrustlineReview';

const source = StrKey.encodeEd25519PublicKey(new Uint8Array(32).fill(21));
const issuer = StrKey.encodeEd25519PublicKey(new Uint8Array(32).fill(22));

function changeTrustXdr(limit: string, withSource = false): string {
  return new TransactionBuilder(new Account(source, '10'), {
    fee: '100',
    networkPassphrase: Networks.TESTNET,
  })
    .addOperation(
      Operation.changeTrust({
        asset: new Asset('USD', issuer),
        limit,
        ...(withSource ? {source} : {}),
      }),
    )
    .setTimeout(180)
    .build()
    .toXdr();
}

describe('buildTrustlineReview', () => {
  it('derives add semantics from the exact ChangeTrust XDR', () => {
    const xdr = changeTrustXdr('708269837873.6765');
    const transaction = new Transaction(xdr, Networks.TESTNET);

    const review = buildTrustlineReview({
      transactionXdrBase64: xdr,
      networkId: 'stellar-testnet',
      expectedAuthorization: 'unauthorized',
      expectedClawbackEnabled: true,
    });

    expect(review).toEqual({
      transactionXdrBase64: xdr,
      networkId: 'stellar-testnet',
      source,
      fee: '100',
      expiresAtUnixSeconds: Number(transaction.timeBounds?.maxTime),
      operation: 'add',
      asset: {code: 'USD', issuer},
      limit: '708269837873.6765000',
      expectedAuthorization: 'unauthorized',
      expectedClawbackEnabled: true,
    });
    expect(Object.isFrozen(review)).toBe(true);
    expect(Object.isFrozen(review.asset)).toBe(true);
  });

  it('derives remove semantics only from zero-limit exact XDR', () => {
    const review = buildTrustlineReview({
      transactionXdrBase64: changeTrustXdr('0'),
      networkId: 'stellar-testnet',
    });

    expect(review.operation).toBe('remove');
    expect(review.limit).toBeUndefined();
  });

  it('rejects an operation-level source override', () => {
    expect(() =>
      buildTrustlineReview({
        transactionXdrBase64: changeTrustXdr('1', true),
        networkId: 'stellar-testnet',
      }),
    ).toThrow('Trustline review does not support an operation source override');
  });

  it('rejects the wrong network before parsing semantics', () => {
    expect(() =>
      buildTrustlineReview({
        transactionXdrBase64: changeTrustXdr('1'),
        networkId: 'stellar-mainnet',
      }),
    ).toThrow('Trustline review network mismatch');
  });
});
