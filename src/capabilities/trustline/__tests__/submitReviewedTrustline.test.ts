import type { FresnicaSdkPort } from '../../ports/FresnicaSdkPort';
import type { PendingSubmissionRepository } from '../../transaction/pendingSubmission';
import type { SignerRecord } from '../../signer/types';
import type { TrustlineGatewayPort } from '../TrustlineGateway';
import type { TrustlineReview } from '../buildTrustlineReview';
import { submitReviewedTrustline } from '../submitReviewedTrustline';

const NETWORK = Object.freeze({
  id: 'stellar-testnet',
  networkPassphrase: 'Test SDF Network ; September 2015',
});
const checkedAt = new Date('2026-09-10T02:00:00.000Z');
const signer: SignerRecord = {
  id: 'signer-1',
  publicKey: 'GLOCAL',
  kind: 'protected-software',
  envelopeJson: '{"protected":true}',
  createdAt: checkedAt,
  updatedAt: checkedAt,
};
const review: TrustlineReview = Object.freeze({
  transactionXdrBase64: 'AAAA-change-trust',
  networkId: NETWORK.id,
  source: 'GSOURCE',
  fee: '100',
  operation: 'set-limit',
  asset: Object.freeze({ code: 'USD', issuer: 'GISSUER' }),
  limit: '100.0000000',
});

function pendingRepository() {
  return {
    create: jest.fn(),
    get: jest.fn(),
    findBlockingIntent: jest.fn(),
    listUnresolved: jest.fn().mockReturnValue([]),
    markUncertain: jest.fn(),
    markConfirmed: jest.fn(),
    markRejected: jest.fn(),
    markStillUnknown: jest.fn(),
  } satisfies jest.Mocked<PendingSubmissionRepository>;
}

function guardedSubmission() {
  let current = true;
  const pending = pendingRepository();
  const authorization = {
    address: review.source,
    thresholds: { low: 1, medium: 1, high: 2 },
    signers: [{ kind: 'ed25519' as const, publicKey: signer.publicKey, weight: 1 }],
  };
  const gateway = {
    inspectTrustlineTransaction: jest.fn().mockReturnValue({
      source: review.source, fee: review.fee, asset: review.asset, limit: review.limit,
    }),
    loadAccountAuthorization: jest.fn().mockResolvedValue(authorization),
    transactionHash: jest.fn().mockReturnValue('trustline-hash'),
    submitTransaction: jest.fn().mockResolvedValue({ status: 'accepted', hash: 'trustline-hash', ledger: 88 }),
  } as unknown as jest.Mocked<TrustlineGatewayPort>;
  const sdk = {
    signWithPassphrase: jest.fn().mockResolvedValue('AAAA-signed-change-trust'),
  } as unknown as jest.Mocked<FresnicaSdkPort>;
  const readInvalidation = { invalidate: jest.fn() };
  return {
    pending, gateway, sdk, authorization, readInvalidation,
    retire: () => { current = false; },
    submit: () => submitReviewedTrustline({
      gateway, sdk, review, accountId: 'account-1', signer, network: NETWORK,
      appPassphrase: 'fresh test passphrase',
      recovery: { repository: pending, readInvalidation, now: () => checkedAt },
      isCurrent: () => current,
    }),
  };
}

describe('Trustline shared cancellable and durable boundaries', () => {
  it('stops before native signing when authorization returns to a retired session', async () => {
    const f = guardedSubmission();
    let resolve!: (value: typeof f.authorization) => void;
    f.gateway.loadAccountAuthorization.mockReturnValue(new Promise(done => { resolve = done; }));
    const pending = f.submit();
    f.retire();
    resolve(f.authorization);
    await expect(pending).rejects.toThrow('reviewed-transaction-session-retired');
    expect(f.sdk.signWithPassphrase).not.toHaveBeenCalled();
    expect(f.pending.create).not.toHaveBeenCalled();
    expect(f.gateway.submitTransaction).not.toHaveBeenCalled();
  });

  it('discards late native signed bytes before hashing, pending storage or broadcast', async () => {
    const f = guardedSubmission();
    let resolve!: (value: string) => void;
    f.sdk.signWithPassphrase.mockReturnValue(new Promise(done => { resolve = done; }));
    const pending = f.submit();
    await Promise.resolve();
    expect(f.sdk.signWithPassphrase).toHaveBeenCalledTimes(1);
    f.retire();
    resolve('AAAA-late-signed');
    await expect(pending).rejects.toThrow('reviewed-transaction-session-retired');
    expect(f.gateway.transactionHash).not.toHaveBeenCalled();
    expect(f.pending.create).not.toHaveBeenCalled();
    expect(f.gateway.submitTransaction).not.toHaveBeenCalled();
  });

  it('checks again at the last boundary before durable pending creation', async () => {
    const f = guardedSubmission();
    f.gateway.transactionHash.mockImplementation(() => { f.retire(); return 'trustline-hash'; });
    await expect(f.submit()).rejects.toThrow('reviewed-transaction-session-retired');
    expect(f.pending.create).not.toHaveBeenCalled();
    expect(f.gateway.submitTransaction).not.toHaveBeenCalled();
  });

  it('preserves uncertain recovery if the route retires after the pending record is durable', async () => {
    const f = guardedSubmission();
    f.pending.create.mockImplementation(() => f.retire());
    f.gateway.submitTransaction.mockRejectedValue(new Error('connection interrupted'));
    await expect(f.submit()).resolves.toEqual({ status: 'uncertain', transactionHash: 'trustline-hash' });
    expect(f.pending.create).toHaveBeenCalledTimes(1);
    expect(f.gateway.submitTransaction).toHaveBeenCalledTimes(1);
    expect(f.pending.markUncertain).toHaveBeenCalledWith(NETWORK.id, 'trustline-hash', checkedAt);
    expect(f.readInvalidation.invalidate).toHaveBeenCalledWith({
      networkId: NETWORK.id, accountId: 'account-1', transactionHash: 'trustline-hash',
    });
  });
});

describe('submitReviewedTrustline', () => {
  it('persists the exact signed transaction before broadcasting through the shared recovery pipeline', async () => {
    const pending = pendingRepository();
    const gateway = {
      inspectTrustlineTransaction: jest.fn().mockReturnValue({
        source: review.source,
        fee: review.fee,
        asset: review.asset,
        limit: review.limit,
      }),
      loadAccountAuthorization: jest.fn().mockResolvedValue({
        address: review.source,
        thresholds: { low: 1, medium: 1, high: 2 },
        signers: [{ kind: 'ed25519', publicKey: signer.publicKey, weight: 1 }],
      }),
      transactionHash: jest.fn().mockReturnValue('trustline-hash'),
      loadTransactionOutcome: jest.fn(),
      submitTransaction: jest.fn().mockResolvedValue({
        status: 'accepted',
        hash: 'trustline-hash',
        ledger: 88,
      }),
    } as unknown as jest.Mocked<TrustlineGatewayPort>;
    const sdk = {
      hasSignerSystemAuth: jest.fn().mockResolvedValue(true),
      signWithPassphrase: jest.fn().mockResolvedValue('AAAA-signed-change-trust'),
    } as unknown as jest.Mocked<FresnicaSdkPort>;

    await expect(
      submitReviewedTrustline({
        appPassphrase: 'test app passphrase',
        gateway,
        sdk,
        review,
        accountId: 'account-1',
        recovery: {
          repository: pending,
          readInvalidation: { invalidate: jest.fn() },
          now: () => checkedAt,
        },
        signer,
        network: NETWORK,
      }),
    ).resolves.toEqual({
      status: 'submitted',
      authorization: 'passphrase',
      hash: 'trustline-hash',
      ledger: 88,
    });

    expect(pending.create).toHaveBeenCalledWith(
      expect.objectContaining({
        accountId: 'account-1',
        transactionHash: 'trustline-hash',
        intentKind: 'trustline',
        state: 'submitting',
      }),
    );
    expect(pending.create.mock.invocationCallOrder[0]).toBeLessThan(
      gateway.submitTransaction.mock.invocationCallOrder[0],
    );
    expect(pending.markConfirmed).toHaveBeenCalledWith(NETWORK.id, 'trustline-hash', checkedAt, 88);
  });
  it('blocks an unresolved matching trustline intent before authorization or signing', async () => {
    const pending = pendingRepository();
    pending.findBlockingIntent.mockReturnValue({
      id: 'stellar-testnet:existing-trustline-hash',
      networkId: NETWORK.id,
      accountId: 'account-1',
      sourceAddress: review.source,
      transactionHash: 'existing-trustline-hash',
      intentKind: 'trustline',
      intentKey: '["trustline","set-limit","USD","GISSUER","100.0000000"]',
      state: 'uncertain',
      createdAt: checkedAt,
      updatedAt: checkedAt,
    });
    const gateway = {
      inspectTrustlineTransaction: jest.fn().mockReturnValue({
        source: review.source,
        fee: review.fee,
        asset: review.asset,
        limit: review.limit,
      }),
      loadAccountAuthorization: jest.fn(),
      transactionHash: jest.fn(),
      loadTransactionOutcome: jest.fn(),
      submitTransaction: jest.fn(),
    } as unknown as jest.Mocked<TrustlineGatewayPort>;
    const sdk = {
      hasSignerSystemAuth: jest.fn(),
      signWithPassphrase: jest.fn(),
    } as unknown as jest.Mocked<FresnicaSdkPort>;

    await expect(
      submitReviewedTrustline({
        appPassphrase: 'test app passphrase',
        gateway,
        sdk,
        review,
        accountId: 'account-1',
        recovery: {
          repository: pending,
          readInvalidation: { invalidate: jest.fn() },
          now: () => checkedAt,
        },
        signer,
        network: NETWORK,
      }),
    ).resolves.toEqual({
      status: 'uncertain',
      transactionHash: 'existing-trustline-hash',
      reason: 'pending-reconciliation',
    });

    expect(pending.findBlockingIntent).toHaveBeenCalledWith(
      NETWORK.id,
      'account-1',
      '["trustline","set-limit","USD","GISSUER","100.0000000"]',
    );
    expect(gateway.loadAccountAuthorization).not.toHaveBeenCalled();
    expect(sdk.hasSignerSystemAuth).not.toHaveBeenCalled();
    expect(gateway.submitTransaction).not.toHaveBeenCalled();
  });
});
