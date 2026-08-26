import type { FresnicaCore } from '../../../fresnica/FresnicaCore';
import type { SignerRecord } from '../../../storage/domain/types';
import type { StellarGateway } from '../../gateway/StellarGateway';
import type { PaymentReview } from '../../review/buildPaymentReview';
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

function gatewayWith(weight: number, threshold = 1) {
  return {
    loadAccountAuthorization: jest.fn().mockResolvedValue({
      address: review.source,
      thresholds: { low: 1, medium: threshold, high: 2 },
      signers: [{ publicKey: signer.publicKey, weight }],
    }),
    submitTransaction: jest.fn().mockResolvedValue({ hash: 'tx-hash', ledger: 77 }),
  } as unknown as jest.Mocked<StellarGateway>;
}

function coreWith(systemAuth: boolean) {
  return {
    hasSignerSystemAuth: jest.fn().mockResolvedValue(systemAuth),
    signWithSystemAuth: jest.fn().mockResolvedValue('AAAA-system-signed'),
    signWithPasscode: jest.fn().mockResolvedValue('AAAA-passcode-signed'),
  } as unknown as jest.Mocked<FresnicaCore>;
}

describe('submitReviewedPayment', () => {
  it('revalidates ledger authorization, signs the exact reviewed XDR, then submits', async () => {
    const gateway = gatewayWith(1);
    const core = coreWith(true);

    await expect(
      submitReviewedPayment({ gateway, core, review, signer }),
    ).resolves.toEqual({
      status: 'submitted',
      authorization: 'system-auth',
      hash: 'tx-hash',
      ledger: 77,
    });

    expect(gateway.loadAccountAuthorization).toHaveBeenCalledWith(review.source);
    expect(core.signWithSystemAuth).toHaveBeenCalledWith(
      expect.objectContaining({ transactionXdrBase64: review.transactionXdrBase64 }),
    );
    expect(gateway.submitTransaction).toHaveBeenCalledWith('AAAA-system-signed');
  });

  it('blocks before authentication when the ledger signer weight is no longer sufficient', async () => {
    const gateway = gatewayWith(1, 2);
    const core = coreWith(true);

    await expect(
      submitReviewedPayment({ gateway, core, review, signer }),
    ).resolves.toEqual({
      status: 'authorization-blocked',
      reason: 'insufficient-weight',
      requiredWeight: 2,
      availableWeight: 1,
    });

    expect(core.hasSignerSystemAuth).not.toHaveBeenCalled();
    expect(core.signWithSystemAuth).not.toHaveBeenCalled();
    expect(gateway.submitTransaction).not.toHaveBeenCalled();
  });

  it('returns passcode-required without submitting when System Auth is not registered', async () => {
    const gateway = gatewayWith(1);
    const core = coreWith(false);

    await expect(
      submitReviewedPayment({ gateway, core, review, signer }),
    ).resolves.toEqual({ status: 'passcode-required' });

    expect(gateway.submitTransaction).not.toHaveBeenCalled();
  });
});
