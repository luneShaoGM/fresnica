import { Account, Networks, StrKey, Transaction } from '@stellar/stellar-sdk';

import { StellarSdkGateway } from '../StellarSdkGateway';
import type { HorizonAccountLike, HorizonServerLike } from '../types';

const sourceAddress = StrKey.encodeEd25519PublicKey(new Uint8Array(32).fill(1));
const destinationAddress = StrKey.encodeEd25519PublicKey(new Uint8Array(32).fill(2));
const signerAddress = StrKey.encodeEd25519PublicKey(new Uint8Array(32).fill(3));

function horizonAccount(): HorizonAccountLike {
  return Object.assign(new Account(sourceAddress, '100'), {
    account_id: sourceAddress,
    thresholds: {
      low_threshold: 1,
      med_threshold: 2,
      high_threshold: 3,
    },
    signers: [
      { key: sourceAddress, weight: 1, type: 'ed25519_public_key' },
      { key: signerAddress, weight: 2, type: 'ed25519_public_key' },
    ],
  });
}

function server(account = horizonAccount()): jest.Mocked<HorizonServerLike> {
  return {
    loadAccount: jest.fn().mockResolvedValue(account),
    submitTransaction: jest.fn(),
  };
}

function transactionHashHex(xdr: string): string {
  const transaction = new Transaction(xdr, Networks.TESTNET);
  return Array.from(transaction.hash())
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('');
}

async function paymentXdr(gateway: StellarSdkGateway): Promise<string> {
  const built = await gateway.buildPayment({
    source: sourceAddress,
    destination: destinationAddress,
    asset: { kind: 'native' },
    amount: '1.2500000',
    memo: 'hello',
    baseFee: '100',
  });
  return built.transactionXdrBase64;
}

describe('StellarSdkGateway', () => {
  it('maps Horizon thresholds and typed Ed25519 signers into ledger authorization', async () => {
    const gateway = new StellarSdkGateway(server());

    await expect(gateway.loadAccountAuthorization(sourceAddress)).resolves.toEqual({
      address: sourceAddress,
      thresholds: { low: 1, medium: 2, high: 3 },
      signers: [
        { kind: 'ed25519', publicKey: sourceAddress, weight: 1 },
        { kind: 'ed25519', publicKey: signerAddress, weight: 2 },
      ],
    });
  });

  it('preserves non-Ed25519 ledger signer identity kinds', async () => {
    const account = horizonAccount();
    account.signers = [
      { key: 'PREAUTH', weight: 1, type: 'preauth_tx' },
      { key: 'HASHX', weight: 2, type: 'sha256_hash' },
      { key: 'PAYLOAD', weight: 3, type: 'ed25519_signed_payload' },
    ];
    const gateway = new StellarSdkGateway(server(account));

    await expect(gateway.loadAccountAuthorization(sourceAddress)).resolves.toMatchObject({
      signers: [
        { kind: 'preauth-tx', key: 'PREAUTH', weight: 1 },
        { kind: 'hash-x', key: 'HASHX', weight: 2 },
        { kind: 'signed-payload', key: 'PAYLOAD', weight: 3 },
      ],
    });
  });

  it('fails closed on an unknown Horizon signer type', async () => {
    const account = horizonAccount();
    account.signers = [{ key: 'UNKNOWN', weight: 1, type: 'future_signer_type' }];
    const gateway = new StellarSdkGateway(server(account));

    await expect(gateway.loadAccountAuthorization(sourceAddress)).rejects.toThrow(
      'unsupported-ledger-signer-type:future_signer_type',
    );
  });

  it('builds an unsigned native-asset payment on Stellar Testnet', async () => {
    const gateway = new StellarSdkGateway(server());
    const xdr = await paymentXdr(gateway);
    const transaction = new Transaction(xdr, Networks.TESTNET);
    const operation = transaction.operations[0];

    expect(transaction.networkPassphrase).toBe(Networks.TESTNET);
    expect(transaction.signatures).toHaveLength(0);
    expect(transaction.operations).toHaveLength(1);
    expect(operation.type).toBe('payment');
    if (operation.type !== 'payment') {
      throw new Error('Expected payment operation');
    }
    expect(operation.destination).toBe(destinationAddress);
    expect(operation.amount).toBe('1.2500000');
    expect(operation.asset.isNative()).toBe(true);
    expect(transaction.memo.type).toBe('text');
  });

  it('normalizes an accepted submission', async () => {
    const horizon = server();
    horizon.submitTransaction.mockResolvedValue({ hash: 'accepted-hash', ledger: 77 });
    const gateway = new StellarSdkGateway(horizon);
    const xdr = await paymentXdr(gateway);

    await expect(gateway.submitTransaction(xdr)).resolves.toEqual({
      status: 'accepted',
      hash: 'accepted-hash',
      ledger: 77,
    });
  });

  it('normalizes a deterministic Horizon rejection with the exact transaction hash', async () => {
    const horizon = server();
    horizon.submitTransaction.mockRejectedValue({
      response: {
        status: 400,
        data: { extras: { result_codes: { transaction: 'tx_bad_seq' } } },
      },
    });
    const gateway = new StellarSdkGateway(horizon);
    const xdr = await paymentXdr(gateway);

    await expect(gateway.submitTransaction(xdr)).resolves.toEqual({
      status: 'rejected',
      transactionHash: transactionHashHex(xdr),
      resultCode: 'tx_bad_seq',
    });
  });

  it('normalizes a transport failure as uncertain without claiming rejection', async () => {
    const horizon = server();
    horizon.submitTransaction.mockRejectedValue(new Error('timeout'));
    const gateway = new StellarSdkGateway(horizon);
    const xdr = await paymentXdr(gateway);

    await expect(gateway.submitTransaction(xdr)).resolves.toEqual({
      status: 'uncertain',
      transactionHash: transactionHashHex(xdr),
    });
    expect(horizon.submitTransaction).toHaveBeenCalledTimes(1);
  });
});
