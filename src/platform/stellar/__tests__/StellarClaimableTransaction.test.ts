import { Account, Memo, Networks, Operation, StrKey, TransactionBuilder } from '@stellar/stellar-sdk';
import { StellarSdkGateway } from '../StellarSdkGateway';
import type { HorizonServerLike } from '../types';

const address = StrKey.encodeEd25519PublicKey(new Uint8Array(32).fill(10));
const other = StrKey.encodeEd25519PublicKey(new Uint8Array(32).fill(11));
const id = '00000000' + 'c'.repeat(64);
const config = {
  network: { id: 'stellar-testnet', networkPassphrase: Networks.TESTNET },
  horizonUrl: 'https://horizon-testnet.stellar.org',
};
const account = () => new Account(address, '100');
function gateway(): StellarSdkGateway {
  return new StellarSdkGateway(config, {
    loadAccount: async () => account(),
  } as unknown as HorizonServerLike);
}

describe('S11 Stellar SDK claimable transaction is an exact unsigned single operation', () => {
  it('builds one fee-bounded ClaimClaimableBalance with expiry and network-bound projection', async () => {
    const sdk = gateway();
    const built = await sdk.buildClaimClaimableBalance(address, id, '100');
    expect(built.networkId).toBe('stellar-testnet');
    expect(sdk.inspectClaimClaimableBalance(built.transactionXdrBase64, Networks.TESTNET)).toMatchObject({
      source: address,
      id,
      fee: '100',
      expiresAtUnixSeconds: expect.any(Number),
    });
    await expect(sdk.buildClaimClaimableBalance(other, id, '0')).rejects.toThrow('claimable-build-invalid');
  });

  it('rejects wrong network and mixed operations, memo, or different source before review', async () => {
    const sdk = gateway();
    const built = await sdk.buildClaimClaimableBalance(address, id, '100');
    expect(() => sdk.inspectClaimClaimableBalance(built.transactionXdrBase64, Networks.PUBLIC)).toThrow(
      'claimable-review-passphrase-mismatch',
    );
    const mixed = new TransactionBuilder(account(), {
      fee: '100',
      networkPassphrase: Networks.TESTNET,
    })
      .addOperation(Operation.claimClaimableBalance({ balanceId: id }))
      .addOperation(Operation.claimClaimableBalance({ balanceId: id }))
      .setTimeout(180)
      .build()
      .toXDR();
    expect(() => sdk.inspectClaimClaimableBalance(mixed, Networks.TESTNET)).toThrow(
      'claimable-review-exact-operation-required',
    );
    const memo = new TransactionBuilder(account(), {
      fee: '100',
      networkPassphrase: Networks.TESTNET,
    })
      .addOperation(Operation.claimClaimableBalance({ balanceId: id }))
      .addMemo(Memo.text('unreviewed'))
      .setTimeout(180)
      .build()
      .toXDR();
    expect(() => sdk.inspectClaimClaimableBalance(memo, Networks.TESTNET)).toThrow(
      'claimable-review-unexpected-memo-or-signature',
    );
    const override = new TransactionBuilder(account(), {
      fee: '100',
      networkPassphrase: Networks.TESTNET,
    })
      .addOperation(Operation.claimClaimableBalance({ balanceId: id, source: other }))
      .setTimeout(180)
      .build()
      .toXDR();
    expect(() => sdk.inspectClaimClaimableBalance(override, Networks.TESTNET)).toThrow(
      'claimable-review-unexpected-source-or-id',
    );
  });
});
