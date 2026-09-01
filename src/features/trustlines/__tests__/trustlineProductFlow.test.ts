import {
  Account,
  Asset,
  Networks,
  Operation,
  StrKey,
  TransactionBuilder,
} from '@stellar/stellar-sdk';

import type {AccountRecord} from '../../../capabilities/account/types';
import {buildTrustlineReview} from '../../../capabilities/trustline/buildTrustlineReview';
import type {FresnicaSdk} from '../../../platform/fresnica/FresnicaSdk';
import {InMemoryAccountSignerRepository} from '../../../platform/persistence/memory/InMemoryAccountSignerRepository';
import type {StellarGateway} from '../../../platform/stellar/StellarGateway';
import {
  submitTrustlineProductReview,
  type TrustlineProductDependencies,
} from '../trustlineProductFlow';

const sourceAddress = StrKey.encodeEd25519PublicKey(new Uint8Array(32).fill(41));
const otherSourceAddress = StrKey.encodeEd25519PublicKey(new Uint8Array(32).fill(42));
const issuerAddress = StrKey.encodeEd25519PublicKey(new Uint8Array(32).fill(43));

function account(): AccountRecord {
  const now = new Date('2026-09-01T00:00:00.000Z');
  return {
    id: 'account-a',
    address: sourceAddress,
    identityKind: 'classic',
    networkId: 'stellar-testnet',
    label: 'Primary',
    sortOrder: 0,
    hidden: false,
    createdAt: now,
    updatedAt: now,
  };
}

function review(source = sourceAddress) {
  const xdr = new TransactionBuilder(new Account(source, '10'), {
    fee: '100',
    networkPassphrase: Networks.TESTNET,
  })
    .addOperation(
      Operation.changeTrust({
        asset: new Asset('USD', issuerAddress),
        limit: '708269837873.6765',
      }),
    )
    .setTimeout(180)
    .build()
    .toXdr();

  return buildTrustlineReview({
    transactionXdrBase64: xdr,
    networkId: 'stellar-testnet',
  });
}

function dependencies(
  repository: InMemoryAccountSignerRepository,
): TrustlineProductDependencies {
  return {
    repository,
    gateway: {} as StellarGateway,
    sdk: {} as FresnicaSdk,
  };
}

describe('trustlineProductFlow', () => {
  it('fails closed before signing for a watch-only account', async () => {
    const repository = new InMemoryAccountSignerRepository();
    const source = account();
    repository.createAccount(source);

    await expect(
      submitTrustlineProductReview(dependencies(repository), source, review()),
    ).resolves.toEqual({status: 'watch-only'});
  });

  it('fails closed when multiple local account signers are attached in v1', async () => {
    const repository = new InMemoryAccountSignerRepository();
    const source = account();
    const now = new Date('2026-09-01T00:00:00.000Z');
    repository.createAccount(source);

    for (const [id, fill] of [
      ['one', 44],
      ['two', 45],
    ] as const) {
      repository.createSigner({
        id,
        publicKey: StrKey.encodeEd25519PublicKey(new Uint8Array(32).fill(fill)),
        kind: 'protected-software',
        envelopeJson: '{}',
        createdAt: now,
        updatedAt: now,
      });
      repository.attachSigner(source.id, id, now);
    }

    await expect(
      submitTrustlineProductReview(dependencies(repository), source, review()),
    ).resolves.toEqual({status: 'unsupported-account-signers'});
  });

  it('re-derives Trustline semantics from exact XDR before applying signer gates', async () => {
    const repository = new InMemoryAccountSignerRepository();
    const source = account();
    repository.createAccount(source);
    const exactReview = review();

    await expect(
      submitTrustlineProductReview(dependencies(repository), source, {
        ...exactReview,
        source: otherSourceAddress,
        operation: 'remove',
        asset: {code: 'FAKE', issuer: otherSourceAddress},
      }),
    ).resolves.toEqual({status: 'watch-only'});
  });

  it('rejects exact ChangeTrust XDR whose source belongs to another account', async () => {
    const repository = new InMemoryAccountSignerRepository();
    const source = account();
    repository.createAccount(source);

    await expect(
      submitTrustlineProductReview(
        dependencies(repository),
        source,
        review(otherSourceAddress),
      ),
    ).rejects.toThrow('trustline-review-account-mismatch');
  });
});
