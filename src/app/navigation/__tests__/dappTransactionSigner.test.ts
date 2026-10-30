import { createNetworkAccountRepository } from '../../../capabilities/account/createNetworkAccountRepository';
import { InMemoryAccountSignerRepository } from '../../../platform/persistence/memory/InMemoryAccountSignerRepository';
import { Account, Asset, Networks, Operation, StrKey, TransactionBuilder } from '@stellar/stellar-sdk';

import type { AccountRecord } from '../../../capabilities/account/types';
import type { AccountSignerRepository } from '../../../capabilities/account/AccountSignerRepository';
import type { FresnicaSdkPort } from '../../../capabilities/ports/FresnicaSdkPort';
import type { SignerRecord } from '../../../capabilities/signer/types';
import { createDappTransactionSigner } from '../createDappTransactionSigner';

const address = StrKey.encodeEd25519PublicKey(new Uint8Array(32).fill(4));
const destination = StrKey.encodeEd25519PublicKey(new Uint8Array(32).fill(5));
const networkPassphrase = Networks.TESTNET;

const account: AccountRecord = {
  id: 'account-1',
  address,
  identityKind: 'classic',
  networkId: 'stellar-testnet',
  label: 'Test',
  sortOrder: 0,
  hidden: false,
  createdAt: new Date('2026-10-27T00:00:00Z'),
  updatedAt: new Date('2026-10-27T00:00:00Z'),
};

const signer: SignerRecord = {
  id: 'signer-1',
  publicKey: address,
  kind: 'protected-software',
  envelopeJson: '{"protected":true}',
  createdAt: account.createdAt,
  updatedAt: account.updatedAt,
};

function envelope(): string {
  return new TransactionBuilder(new Account(address, '7'), { fee: '100', networkPassphrase })
    .addOperation(Operation.payment({ destination, asset: Asset.native(), amount: '2' }))
    .setTimeout(30)
    .build()
    .toXDR();
}

describe('createDappTransactionSigner', () => {
  it('inspects the target-network context of an existing Classic wallet but rejects another network before auth', async () => {
    const records = new InMemoryAccountSignerRepository();
    records.createAccountWithSigner({
      account: { ...account, networkId: 'stellar-mainnet' },
      signer,
      attachedAt: account.createdAt,
    });
    const sdk = { hasSignerSystemAuth: jest.fn() } as unknown as FresnicaSdkPort;
    const sign = createDappTransactionSigner({
      sdk,
      repository: createNetworkAccountRepository(records, 'stellar-testnet'),
    });
    const input = {
      phase: 'inspect' as const,
      accountId: account.id,
      accountAddress: address,
      networkId: 'stellar-testnet',
      networkPassphrase,
      transactionXdrBase64: envelope(),
    };
    await expect(sign(input)).resolves.toMatchObject({ status: 'ready' });
    await expect(sign({ ...input, networkId: 'stellar-mainnet' })).resolves.toEqual({ status: 'unsupported-signer' });
    expect(sdk.hasSignerSystemAuth).not.toHaveBeenCalled();
    expect(records.getAccount(account.id)?.networkId).toBe('stellar-mainnet');
  });

  it('inspects the exact envelope and signs that same XDR', async () => {
    const transactionXdrBase64 = envelope();
    const signWithSystemAuth = jest.fn().mockResolvedValue('signed-envelope');
    const sdk = {
      hasSignerSystemAuth: jest.fn().mockResolvedValue(true),
      signWithSystemAuth,
    } as unknown as FresnicaSdkPort;
    const repository = {
      getAccount: () => account,
      listSignersForAccount: () => [signer],
    } as unknown as AccountSignerRepository;
    const sign = createDappTransactionSigner({ sdk, repository });
    const input = {
      accountId: account.id,
      accountAddress: address,
      networkId: account.networkId,
      networkPassphrase,
      transactionXdrBase64,
    };

    const inspected = await sign({ ...input, phase: 'inspect' });
    expect(inspected).toMatchObject({
      status: 'ready',
      intent: { source: address, fee: '100', operations: [{ destination, amount: '2.0000000', assetCode: 'XLM' }] },
    });
    if (inspected.status !== 'ready') throw new Error('invalid-inspection');
    await expect(
      sign({ ...input, phase: 'sign', reviewedHash: inspected.intent.hash, isCurrent: () => true }),
    ).resolves.toEqual({
      status: 'signed',
      signedTransaction: 'signed-envelope',
      signerAddress: address,
    });
    expect(signWithSystemAuth).toHaveBeenCalledWith(expect.objectContaining({ transactionXdrBase64 }));
  });

  it('refuses to sign changed destinations and stale authorization before native auth', async () => {
    const signWithSystemAuth = jest.fn().mockResolvedValue('signed-envelope');
    const sdk = {
      hasSignerSystemAuth: jest.fn().mockResolvedValue(true),
      signWithSystemAuth,
    } as unknown as FresnicaSdkPort;
    const repository = {
      getAccount: () => account,
      listSignersForAccount: () => [signer],
    } as unknown as AccountSignerRepository;
    const sign = createDappTransactionSigner({ sdk, repository });
    const first = envelope();
    const inspected = await sign({
      phase: 'inspect',
      accountId: account.id,
      accountAddress: address,
      networkId: account.networkId,
      networkPassphrase,
      transactionXdrBase64: first,
    });
    if (inspected.status !== 'ready') throw new Error('no-intent');
    const changed = new TransactionBuilder(new Account(address, '7'), { fee: '100', networkPassphrase })
      .addOperation(Operation.payment({ destination: address, asset: Asset.native(), amount: '2' }))
      .setTimeout(30)
      .build()
      .toXDR();
    const fields = { accountId: account.id, accountAddress: address, networkId: account.networkId, networkPassphrase };
    await expect(
      sign({
        ...fields,
        phase: 'sign',
        transactionXdrBase64: changed,
        reviewedHash: inspected.intent.hash,
        isCurrent: () => true,
      }),
    ).resolves.toEqual({ status: 'invalid' });
    await expect(
      sign({
        ...fields,
        phase: 'sign',
        transactionXdrBase64: first,
        reviewedHash: inspected.intent.hash,
        isCurrent: () => false,
      }),
    ).resolves.toEqual({ status: 'invalid' });
    expect(signWithSystemAuth).not.toHaveBeenCalled();
  });

  it('rejects an envelope that cannot be parsed before asking for a signature', async () => {
    const sdk = { hasSignerSystemAuth: jest.fn() } as unknown as FresnicaSdkPort;
    const repository = {
      getAccount: () => account,
      listSignersForAccount: () => [signer],
    } as unknown as AccountSignerRepository;
    const sign = createDappTransactionSigner({ sdk, repository });

    await expect(
      sign({
        phase: 'inspect',
        accountId: account.id,
        accountAddress: address,
        networkId: account.networkId,
        networkPassphrase,
        transactionXdrBase64: 'AAAA',
      }),
    ).resolves.toEqual({ status: 'invalid' });
    expect(sdk.hasSignerSystemAuth).not.toHaveBeenCalled();
  });
});
