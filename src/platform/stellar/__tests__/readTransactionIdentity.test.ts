import { Account, Asset, Networks, Operation, StrKey, TransactionBuilder } from '@stellar/stellar-sdk';

import { readTransactionIdentity } from '../readTransactionIdentity';

const source = StrKey.encodeEd25519PublicKey(new Uint8Array(32).fill(1));
const destination = StrKey.encodeEd25519PublicKey(new Uint8Array(32).fill(2));

describe('readTransactionIdentity', () => {
  it('reads the source, fee and operation count without changing the XDR', () => {
    const transaction = new TransactionBuilder(new Account(source, '10'), {
      fee: '100',
      networkPassphrase: Networks.TESTNET,
    })
      .addOperation(Operation.payment({ destination, asset: Asset.native(), amount: '1' }))
      .setTimeout(30)
      .build();

    expect(readTransactionIdentity(transaction.toXDR(), Networks.TESTNET)).toMatchObject({
      source,
      fee: '100',
      operationCount: 1,
    });
  });

  it('returns undefined for a payload that is not a transaction envelope', () => {
    expect(readTransactionIdentity('AAAA', Networks.TESTNET)).toBeUndefined();
  });
});
