import type { AccountRecord } from '../../../capabilities/account/types';
import type { FresnicaSdkPort } from '../../../capabilities/ports/FresnicaSdkPort';
import type { TrustlineReview } from '../../../capabilities/trustline/buildTrustlineReview';
import { InMemoryAccountSignerRepository } from '../../../platform/persistence/memory/InMemoryAccountSignerRepository';
import { submitTrustlineProductReview, type TrustlineProductDependencies } from '../trustlineProductFlow';
import type { PendingSubmissionRepository } from '../../../capabilities/transaction/pendingSubmission';

const TEST_NETWORK = Object.freeze({
  id: 'stellar-testnet',
  networkPassphrase: 'Test SDF Network ; September 2015',
});
const sourceAddress = 'GSOURCE';
const otherSourceAddress = 'GOTHERSOURCE';
const issuerAddress = 'GISSUER';

function account(): AccountRecord {
  const now = new Date('2026-09-01T00:00:00.000Z');
  return {
    id: 'account-a',
    address: sourceAddress,
    identityKind: 'classic',
    networkId: TEST_NETWORK.id,
    label: 'Primary',
    sortOrder: 0,
    hidden: false,
    createdAt: now,
    updatedAt: now,
  };
}

function review(source = sourceAddress): TrustlineReview {
  return Object.freeze({
    transactionXdrBase64: `change-trust-xdr:${source}`,
    networkId: TEST_NETWORK.id,
    source,
    fee: '100',
    operation: 'add',
    asset: Object.freeze({ code: 'USD', issuer: issuerAddress }),
    limit: '708269837873.6765000',
  });
}

function gateway(): TrustlineProductDependencies['gateway'] {
  return {
    inspectTrustlineTransaction: jest.fn(input => {
      const source = input.transactionXdrBase64.split(':')[1] ?? sourceAddress;
      return {
        source,
        fee: '100',
        asset: { code: 'USD', issuer: issuerAddress },
        limit: '708269837873.6765000',
      };
    }),
  } as unknown as TrustlineProductDependencies['gateway'];
}

function dependencies(repository: InMemoryAccountSignerRepository): TrustlineProductDependencies {
  return {
    repository,
    recovery: recovery(),
    gateway: gateway(),
    sdk: {} as FresnicaSdkPort,
    network: TEST_NETWORK,
  };
}

function recovery() {
  const repository = {
    create: jest.fn(),
    get: jest.fn(),
    findBlockingIntent: jest.fn(),
    listUnresolved: jest.fn().mockReturnValue([]),
    markUncertain: jest.fn(),
    markConfirmed: jest.fn(),
    markRejected: jest.fn(),
    markStillUnknown: jest.fn(),
  } satisfies jest.Mocked<PendingSubmissionRepository>;
  return {repository, now: () => new Date('2026-09-10T02:00:00.000Z')};
}

describe('trustlineProductFlow', () => {
  it('fails closed before signing for a watch-only account', async () => {
    const repository = new InMemoryAccountSignerRepository();
    const source = account();
    repository.createAccount(source);

    await expect(submitTrustlineProductReview(dependencies(repository), source, review())).resolves.toEqual({
      status: 'watch-only',
    });
  });

  it('fails closed when multiple local account signers are attached in v1', async () => {
    const repository = new InMemoryAccountSignerRepository();
    const source = account();
    const now = new Date('2026-09-01T00:00:00.000Z');
    repository.createAccount(source);

    for (const id of ['one', 'two']) {
      repository.createSigner({
        id,
        publicKey: id === 'one' ? 'GSIGNERONE' : 'GSIGNERTWO',
        kind: 'protected-software',
        envelopeJson: '{}',
        createdAt: now,
        updatedAt: now,
      });
      repository.attachSigner(source.id, id, now);
    }

    await expect(submitTrustlineProductReview(dependencies(repository), source, review())).resolves.toEqual({
      status: 'unsupported-account-signers',
    });
  });

  it('rejects a mutable intent label that contradicts the exact ChangeTrust XDR', async () => {
    const repository = new InMemoryAccountSignerRepository();
    const source = account();
    repository.createAccount(source);
    const exactReview = review();

    await expect(
      submitTrustlineProductReview(dependencies(repository), source, {
        ...exactReview,
        source: otherSourceAddress,
        operation: 'remove',
        asset: { code: 'FAKE', issuer: otherSourceAddress },
      }),
    ).rejects.toThrow('trustline-review-operation-xdr-mismatch');
  });

  it('rejects exact ChangeTrust XDR whose source belongs to another account', async () => {
    const repository = new InMemoryAccountSignerRepository();
    const source = account();
    repository.createAccount(source);

    await expect(
      submitTrustlineProductReview(dependencies(repository), source, review(otherSourceAddress)),
    ).rejects.toThrow('trustline-review-account-mismatch');
  });
});
