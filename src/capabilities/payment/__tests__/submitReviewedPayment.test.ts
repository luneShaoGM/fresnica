import type { FresnicaSdk } from '../../../platform/fresnica/FresnicaSdk';
import type { StellarGateway } from '../../../platform/stellar/StellarGateway';
import type { SignerRecord } from '../../signer/types';
import type { PaymentReview } from '../buildPaymentReview';
import { submitReviewedPayment } from '../submitReviewedPayment';

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
  destination: 'GDESTINATION',
  amount: '1.0000000',
  asset: Object.freeze({ kind: 'native' as const }),
  fee: '100',
});

function gatewayWith(options?: {
  weight?: number;
  threshold?: number;
  submission?: Awaited<ReturnType<StellarGateway['submitTransaction']>>;
}) {
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
    submitTransaction: jest.fn().mockResolvedValue(
      options?.submission ?? { status: 'accepted', hash: 'tx-hash', ledger: 77 },
    ),
  } as unknown as jest.Mocked<StellarGateway>;
}

function sdkWith(systemAuth: boolean) {
  return {
    hasSignerSystemAuth: jest.fn().mockResolvedValue(systemAuth),
    signWithSystemAuth: jest.fn().mockResolvedValue('AAAA-system-signed'),
    signWithPasscode: jest.fn().mockResolvedValue('AAAA-passcode-signed'),
  } as unknown as jest.Mocked<FresnicaSdk>;
}

describe('submitReviewedPayment', () => {
  it('revalidates ledger authorization, signs the exact reviewed XDR, then submits the exact signed XDR', async () => {
    const gateway = gatewayWith();
    const sdk = sdkWith(true);

    await expect(submitReviewedPayment({ gateway, sdk, review, signer })).resolves.toEqual({
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
  });

  it('blocks before authentication when ledger signer weight is insufficient', async () => {
    const gateway = gatewayWith({ weight: 1, threshold: 2 });
    const sdk = sdkWith(true);

    await expect(submitReviewedPayment({ gateway, sdk, review, signer })).resolves.toEqual({
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
      submitReviewedPayment({ gateway, sdk, review: expiredReview, signer }),
    ).rejects.toThrow('Reviewed transaction is expired');

    expect(gateway.loadAccountAuthorization).not.toHaveBeenCalled();
    expect(sdk.hasSignerSystemAuth).not.toHaveBeenCalled();
    expect(gateway.submitTransaction).not.toHaveBeenCalled();
  });

  it('returns passcode-required without submission when System Auth is not registered', async () => {
    const gateway = gatewayWith();
    const sdk = sdkWith(false);

    await expect(submitReviewedPayment({ gateway, sdk, review, signer })).resolves.toEqual({
      status: 'passcode-required',
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

    await expect(submitReviewedPayment({ gateway, sdk, review, signer })).resolves.toEqual({
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

    await expect(submitReviewedPayment({ gateway, sdk, review, signer })).resolves.toEqual({
      status: 'uncertain',
      transactionHash: 'cafebabe',
    });
    expect(gateway.submitTransaction).toHaveBeenCalledTimes(1);
  });
});
