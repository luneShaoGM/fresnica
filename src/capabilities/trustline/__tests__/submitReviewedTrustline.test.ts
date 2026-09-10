import type {FresnicaSdkPort} from '../../ports/FresnicaSdkPort';
import type {PendingSubmissionRepository} from '../../transaction/pendingSubmission';
import type {SignerRecord} from '../../signer/types';
import type {TrustlineGatewayPort} from '../TrustlineGateway';
import type {TrustlineReview} from '../buildTrustlineReview';
import {submitReviewedTrustline} from '../submitReviewedTrustline';

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
  asset: Object.freeze({code: 'USD', issuer: 'GISSUER'}),
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
        thresholds: {low: 1, medium: 1, high: 2},
        signers: [{kind: 'ed25519', publicKey: signer.publicKey, weight: 1}],
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
      signWithSystemAuth: jest.fn().mockResolvedValue('AAAA-signed-change-trust'),
    } as unknown as jest.Mocked<FresnicaSdkPort>;

    await expect(
      submitReviewedTrustline({
        gateway,
        sdk,
        review,
        accountId: 'account-1',
        recovery: {repository: pending, now: () => checkedAt},
        signer,
        network: NETWORK,
      }),
    ).resolves.toEqual({
      status: 'submitted',
      authorization: 'system-auth',
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
    expect(pending.markConfirmed).toHaveBeenCalledWith(
      NETWORK.id,
      'trustline-hash',
      checkedAt,
      88,
    );
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
      signWithSystemAuth: jest.fn(),
    } as unknown as jest.Mocked<FresnicaSdkPort>;

    await expect(
      submitReviewedTrustline({
        gateway,
        sdk,
        review,
        accountId: 'account-1',
        recovery: {repository: pending, now: () => checkedAt},
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
