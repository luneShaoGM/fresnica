import type { FresnicaSdkPort } from '../../ports/FresnicaSdkPort';
import type { TransactionGatewayPort } from '../../transaction/TransactionGateway';
import type { PendingSubmissionRepository } from '../../transaction/pendingSubmission';
import type { SignerRecord } from '../../signer/types';
import type { PaymentReview } from '../buildPaymentReview';
import { submitReviewedPayment } from '../submitReviewedPayment';

const NETWORK_PASSPHRASE = 'Test SDF Network ; September 2015';

const signer: SignerRecord = {
  id: 'signer-1',
  publicKey: 'GLOCAL',
  kind: 'protected-software',
  envelopeJson: '{"protected":true}',
  createdAt: new Date('2026-08-26T00:00:00Z'),
  updatedAt: new Date('2026-08-26T00:00:00Z'),
};

const review: PaymentReview = Object.freeze({
  transactionXdrBase64: 'AAAA-reviewed-xdr',
  networkId: 'stellar-testnet',
  source: 'GSOURCE',
  operation: 'payment',
  destination: 'GDESTINATION',
  amount: '1.0000000',
  asset: Object.freeze({ kind: 'native' as const }),
  fee: '100',
});

function gatewayWith(options?: {
  weight?: number;
  threshold?: number;
  submission?: Awaited<ReturnType<TransactionGatewayPort['submitTransaction']>>;
}) {
  const transactionHash =
    options?.submission === undefined
      ? 'tx-hash'
      : options.submission.status === 'accepted'
        ? options.submission.hash
        : options.submission.transactionHash;
  return {
    loadAccountAuthorization: jest.fn().mockResolvedValue({
      address: review.source,
      thresholds: { low: 1, medium: options?.threshold ?? 1, high: 2 },
      signers: [
        {
          kind: 'ed25519' as const,
          publicKey: signer.publicKey,
          weight: options?.weight ?? 1,
        },
      ],
    }),
    transactionHash: jest.fn().mockReturnValue(transactionHash),
    loadTransactionOutcome: jest.fn(),
    submitTransaction: jest
      .fn()
      .mockResolvedValue(options?.submission ?? { status: 'accepted', hash: 'tx-hash', ledger: 77 }),
  } as jest.Mocked<TransactionGatewayPort>;
}

function pendingRecovery() {
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
    recovery: {
      repository,
      now: jest.fn().mockReturnValue(new Date('2026-09-10T02:00:00.000Z')),
    },
  };
}

function sdkWith(systemAuth: boolean) {
  return {
    hasSignerSystemAuth: jest.fn().mockResolvedValue(systemAuth),
    signWithSystemAuth: jest.fn().mockResolvedValue('AAAA-system-signed'),
    signWithPassphrase: jest.fn().mockResolvedValue('AAAA-passphrase-signed'),
  } as unknown as jest.Mocked<FresnicaSdkPort>;
}

function submitInput(gateway: jest.Mocked<TransactionGatewayPort>, sdk: jest.Mocked<FresnicaSdkPort>) {
  const pending = pendingRecovery();
  return {
    pending,
    input: {
      gateway,
      sdk,
      review,
      accountId: 'account-1',
      recovery: pending.recovery,
      signer,
      networkPassphrase: NETWORK_PASSPHRASE,
    },
  };
}

describe('submitReviewedPayment', () => {
  it('revalidates ledger authorization, signs the exact reviewed XDR, then submits the exact signed XDR', async () => {
    const gateway = gatewayWith();
    const sdk = sdkWith(true);
    const {pending, input} = submitInput(gateway, sdk);

    await expect(
      submitReviewedPayment(input),
    ).resolves.toEqual({
      status: 'submitted',
      authorization: 'system-auth',
      hash: 'tx-hash',
      ledger: 77,
    });

    expect(gateway.loadAccountAuthorization).toHaveBeenCalledWith(review.source);
    expect(sdk.signWithSystemAuth).toHaveBeenCalledWith(
      expect.objectContaining({ transactionXdrBase64: review.transactionXdrBase64 }),
    );
    expect(gateway.submitTransaction).toHaveBeenCalledWith('AAAA-system-signed');
    expect(pending.repository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        networkId: review.networkId,
        accountId: 'account-1',
        sourceAddress: review.source,
        transactionHash: 'tx-hash',
        intentKind: 'payment',
        state: 'submitting',
      }),
    );
    expect(pending.repository.create.mock.invocationCallOrder[0]).toBeLessThan(
      gateway.submitTransaction.mock.invocationCallOrder[0],
    );
    expect(pending.repository.markConfirmed).toHaveBeenCalledWith(
      review.networkId,
      'tx-hash',
      expect.any(Date),
      77,
    );
  });

  it('blocks the same economic intent before authorization while an earlier submission is unresolved', async () => {
    const gateway = gatewayWith();
    const sdk = sdkWith(true);
    const {pending, input} = submitInput(gateway, sdk);
    pending.repository.findBlockingIntent.mockReturnValue({
      id: 'stellar-testnet:existing-hash',
      networkId: review.networkId,
      accountId: 'account-1',
      sourceAddress: review.source,
      transactionHash: 'existing-hash',
      intentKind: 'payment',
      intentKey: '["payment","payment","GDESTINATION","native","1.0000000","memo:none",""]',
      state: 'uncertain',
      createdAt: new Date('2026-09-10T01:00:00.000Z'),
      updatedAt: new Date('2026-09-10T01:00:00.000Z'),
    });

    await expect(submitReviewedPayment(input)).resolves.toEqual({
      status: 'uncertain',
      transactionHash: 'existing-hash',
      reason: 'pending-reconciliation',
    });

    expect(pending.repository.findBlockingIntent).toHaveBeenCalledWith(
      review.networkId,
      'account-1',
      '["payment","payment","GDESTINATION","native","1.0000000","memo:none",""]',
    );
    expect(gateway.loadAccountAuthorization).not.toHaveBeenCalled();
    expect(sdk.hasSignerSystemAuth).not.toHaveBeenCalled();
    expect(gateway.submitTransaction).not.toHaveBeenCalled();
  });

  it('does not broadcast when another matching intent wins the persistence race', async () => {
    const gateway = gatewayWith();
    const sdk = sdkWith(true);
    const {pending, input} = submitInput(gateway, sdk);
    const concurrent = {
      id: 'stellar-testnet:concurrent-hash',
      networkId: review.networkId,
      accountId: 'account-1',
      sourceAddress: review.source,
      transactionHash: 'concurrent-hash',
      intentKind: 'payment',
      intentKey: '["payment","payment","GDESTINATION","native","1.0000000","memo:none",""]',
      state: 'submitting' as const,
      createdAt: new Date('2026-09-10T01:00:00.000Z'),
      updatedAt: new Date('2026-09-10T01:00:00.000Z'),
    };
    pending.repository.findBlockingIntent
      .mockReturnValueOnce(undefined)
      .mockReturnValueOnce(concurrent);
    pending.repository.create.mockImplementation(() => {
      throw new Error('pending-submission-intent-blocked');
    });

    await expect(submitReviewedPayment(input)).resolves.toEqual({
      status: 'uncertain',
      transactionHash: 'concurrent-hash',
      reason: 'pending-reconciliation',
    });
    expect(gateway.submitTransaction).not.toHaveBeenCalled();
  });

  it('blocks before authentication when ledger signer weight is insufficient', async () => {
    const gateway = gatewayWith({ weight: 1, threshold: 2 });
    const sdk = sdkWith(true);

    await expect(
      submitReviewedPayment(submitInput(gateway, sdk).input),
    ).resolves.toEqual({
      status: 'authorization-blocked',
      reason: 'insufficient-weight',
      requiredWeight: 2,
      availableWeight: 1,
    });

    expect(sdk.hasSignerSystemAuth).not.toHaveBeenCalled();
    expect(sdk.signWithSystemAuth).not.toHaveBeenCalled();
    expect(gateway.submitTransaction).not.toHaveBeenCalled();
  });

  it('rejects an expired review before loading authorization or authenticating', async () => {
    const gateway = gatewayWith();
    const sdk = sdkWith(true);
    const expiredReview: PaymentReview = Object.freeze({
      ...review,
      expiresAtUnixSeconds: 1,
    });

    await expect(
      submitReviewedPayment({...submitInput(gateway, sdk).input, review: expiredReview}),
    ).rejects.toThrow('Reviewed transaction is expired');

    expect(gateway.loadAccountAuthorization).not.toHaveBeenCalled();
    expect(sdk.hasSignerSystemAuth).not.toHaveBeenCalled();
    expect(gateway.submitTransaction).not.toHaveBeenCalled();
  });

  it('returns passphrase-required without submission when System Auth is not registered', async () => {
    const gateway = gatewayWith();
    const sdk = sdkWith(false);

    await expect(
      submitReviewedPayment(submitInput(gateway, sdk).input),
    ).resolves.toEqual({
      status: 'passphrase-required',
    });
    expect(gateway.submitTransaction).not.toHaveBeenCalled();
  });

  it('surfaces deterministic rejection separately from uncertain submission', async () => {
    const gateway = gatewayWith({
      submission: {
        status: 'rejected',
        transactionHash: 'deadbeef',
        resultCode: 'tx_bad_seq',
      },
    });
    const sdk = sdkWith(true);

    await expect(
      submitReviewedPayment(submitInput(gateway, sdk).input),
    ).resolves.toEqual({
      status: 'rejected',
      transactionHash: 'deadbeef',
      resultCode: 'tx_bad_seq',
    });
  });

  it('surfaces uncertain submission without retrying', async () => {
    const gateway = gatewayWith({
      submission: { status: 'uncertain', transactionHash: 'cafebabe' },
    });
    const sdk = sdkWith(true);

    await expect(
      submitReviewedPayment(submitInput(gateway, sdk).input),
    ).resolves.toEqual({
      status: 'uncertain',
      transactionHash: 'cafebabe',
    });
    expect(gateway.submitTransaction).toHaveBeenCalledTimes(1);
  });
});
