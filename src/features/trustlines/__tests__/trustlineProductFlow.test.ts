import type { AccountRecord } from '../../../capabilities/account/types';
import type { FresnicaSdkPort } from '../../../capabilities/ports/FresnicaSdkPort';
import type { TrustlineReview } from '../../../capabilities/trustline/buildTrustlineReview';
import { InMemoryAccountSignerRepository } from '../../../platform/persistence/memory/InMemoryAccountSignerRepository';
import { submitTrustlineProductReview, type TrustlineProductDependencies } from '../trustlineProductFlow';
import type { PendingSubmissionRepository } from '../../../capabilities/transaction/pendingSubmission';
import type { StellarAccountStateResult } from '../../../capabilities/stellar/types';

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
  return {
    repository,
    readInvalidation: {invalidate: jest.fn()},
    now: () => new Date('2026-09-10T02:00:00.000Z'),
  };
}

function signingFixture() {
  const repository = new InMemoryAccountSignerRepository();
  const source = account();
  repository.createAccount(source);
  repository.createSigner({
    id: 'signer', publicKey: source.address, kind: 'protected-software', envelopeJson: '{}',
    createdAt: source.createdAt, updatedAt: source.updatedAt,
  });
  repository.attachSigner(source.id, 'signer', source.createdAt);
  const sourceState: StellarAccountStateResult = {
    status: 'active',
    account: {
      address: source.address, subentryCount: 0, numSponsoring: 0, numSponsored: 0,
      flags: { authRequired: false, authClawbackEnabled: false },
      balances: [{ kind: 'native', balance: '100', sellingLiabilities: '0' }],
    },
  };
  const stellar = {
    ...gateway(),
    isClassicAccountAddress: jest.fn().mockReturnValue(true),
    loadAccountState: jest.fn(async (address: string): Promise<StellarAccountStateResult> => ({
      ...sourceState,
      account: { ...sourceState.account, address },
    })),
    loadLedgerParameters: jest.fn().mockResolvedValue({ baseReserveStroops: 5_000_000, baseFeeStroops: 100 }),
    loadAccountAuthorization: jest.fn().mockResolvedValue({
      address: source.address, thresholds: { low: 1, medium: 1, high: 1 },
      signers: [{ kind: 'ed25519', publicKey: source.address, weight: 1 }],
    }),
    transactionHash: jest.fn().mockReturnValue('hash'),
    submitTransaction: jest.fn(),
  };
  const sdk = { signWithPassphrase: jest.fn().mockResolvedValue('signed-xdr') };
  const deps: TrustlineProductDependencies = {
    repository, gateway: stellar, network: TEST_NETWORK, recovery: recovery(),
    sdk: sdk as unknown as FresnicaSdkPort,
  };
  return { source, sourceState, stellar, sdk, deps };
}

describe('trustlineProductFlow', () => {
  it('rejects an already retired review before revalidation or signer access', async () => {
    const repository = new InMemoryAccountSignerRepository();
    const deps = dependencies(repository);
    await expect(
      submitTrustlineProductReview(deps, account(), review(), 'Authorize asset change', undefined, () => false),
    ).rejects.toThrow('reviewed-transaction-session-retired');
    expect(deps.gateway.inspectTrustlineTransaction).not.toHaveBeenCalled();
  });

  it('stops after delayed ledger revalidation when the account route retired', async () => {
    const f = signingFixture();
    let current = true;
    let resolve!: (value: StellarAccountStateResult) => void;
    f.stellar.loadAccountState.mockReturnValueOnce(new Promise(done => { resolve = done; }));
    const result = submitTrustlineProductReview(
      f.deps, f.source, review(), 'Authorize asset change', 'fresh test passphrase', () => current,
    );
    current = false;
    resolve(f.sourceState);
    await expect(result).rejects.toThrow('reviewed-transaction-session-retired');
    expect(f.stellar.loadAccountAuthorization).not.toHaveBeenCalled();
    expect(f.sdk.signWithPassphrase).not.toHaveBeenCalled();
    expect(f.deps.recovery.repository.create).not.toHaveBeenCalled();
    expect(f.stellar.submitTransaction).not.toHaveBeenCalled();
  });

  it('carries the same route guard through real revalidation to a late native signing result', async () => {
    const f = signingFixture();
    let current = true;
    let resolve!: (value: string) => void;
    f.sdk.signWithPassphrase.mockReturnValueOnce(new Promise(done => { resolve = done; }));
    const result = submitTrustlineProductReview(
      f.deps, f.source, review(), 'Authorize asset change', 'fresh test passphrase', () => current,
    );
    for (let i = 0; i < 10; i++) await Promise.resolve();
    expect(f.sdk.signWithPassphrase).toHaveBeenCalledTimes(1);
    current = false;
    resolve('late-signed-xdr');
    await expect(result).rejects.toThrow('reviewed-transaction-session-retired');
    expect(f.deps.recovery.repository.create).not.toHaveBeenCalled();
    expect(f.stellar.submitTransaction).not.toHaveBeenCalled();
  });

  it('fails closed before signing for a watch-only account', async () => {
    const repository = new InMemoryAccountSignerRepository();
    const source = account();
    repository.createAccount(source);

    await expect(
      submitTrustlineProductReview(dependencies(repository), source, review(), 'Authorize asset change'),
    ).resolves.toEqual({
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

    await expect(
      submitTrustlineProductReview(dependencies(repository), source, review(), 'Authorize asset change'),
    ).resolves.toEqual({
      status: 'unsupported-account-signers',
    });
  });

  it('rejects a mutable intent label that contradicts the exact ChangeTrust XDR', async () => {
    const repository = new InMemoryAccountSignerRepository();
    const source = account();
    repository.createAccount(source);
    const exactReview = review();

    await expect(
      submitTrustlineProductReview(
        dependencies(repository),
        source,
        {
          ...exactReview,
          source: otherSourceAddress,
          operation: 'remove',
          asset: { code: 'FAKE', issuer: otherSourceAddress },
        },
        'Authorize asset change',
      ),
    ).rejects.toThrow('trustline-review-operation-xdr-mismatch');
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
        'Authorize asset change',
      ),
    ).rejects.toThrow('trustline-review-account-mismatch');
  });
});
