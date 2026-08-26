import type { FresnicaCore } from '../../../fresnica/FresnicaCore';
import type { SignerRecord } from '../../../storage/domain/types';
import { APP_CONFIG } from '../../../../app/config/appConfig';
import type { PaymentReview } from '../../review/buildPaymentReview';
import { signReviewedPayment } from '../signReviewedPayment';

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

function coreWith(overrides?: Partial<FresnicaCore>) {
  return {
    hasSignerSystemAuth: jest.fn().mockResolvedValue(false),
    signWithSystemAuth: jest.fn().mockResolvedValue('AAAA-system-signed'),
    signWithPasscode: jest.fn().mockResolvedValue('AAAA-passcode-signed'),
    ...overrides,
  } as unknown as jest.Mocked<FresnicaCore>;
}

describe('signReviewedPayment', () => {
  it('automatically uses native System Auth when the signer is registered', async () => {
    const core = coreWith({
      hasSignerSystemAuth: jest.fn().mockResolvedValue(true),
    });

    await expect(
      signReviewedPayment({
        core,
        review,
        signer,
        systemAuthReason: 'Confirm Fresnica payment',
      }),
    ).resolves.toEqual({
      status: 'signed',
      authorization: 'system-auth',
      signedTransactionXdrBase64: 'AAAA-system-signed',
    });

    expect(core.signWithSystemAuth).toHaveBeenCalledWith({
      envelopeJson: signer.envelopeJson,
      expectedSignerPublicKey: signer.publicKey,
      transactionXdrBase64: review.transactionXdrBase64,
      networkPassphrase: APP_CONFIG.network.networkPassphrase,
      reason: 'Confirm Fresnica payment',
    });
    expect(core.signWithPasscode).not.toHaveBeenCalled();
  });

  it('requires a passcode instead of inventing a fallback when System Auth is not registered', async () => {
    const core = coreWith();

    await expect(
      signReviewedPayment({ core, review, signer }),
    ).resolves.toEqual({ status: 'passcode-required' });

    expect(core.signWithSystemAuth).not.toHaveBeenCalled();
    expect(core.signWithPasscode).not.toHaveBeenCalled();
  });

  it('uses the SDK composite passcode-sign operation for the same reviewed XDR', async () => {
    const core = coreWith();

    await expect(
      signReviewedPayment({
        core,
        review,
        signer,
        appPasscode: '123456',
      }),
    ).resolves.toEqual({
      status: 'signed',
      authorization: 'passcode',
      signedTransactionXdrBase64: 'AAAA-passcode-signed',
    });

    expect(core.signWithPasscode).toHaveBeenCalledWith({
      envelopeJson: signer.envelopeJson,
      appPasscode: '123456',
      expectedSignerPublicKey: signer.publicKey,
      transactionXdrBase64: review.transactionXdrBase64,
      networkPassphrase: APP_CONFIG.network.networkPassphrase,
    });
    expect(core.signWithSystemAuth).not.toHaveBeenCalled();
  });

  it('rejects non-software or malformed local signer records before invoking the SDK', async () => {
    const core = coreWith();

    await expect(
      signReviewedPayment({
        core,
        review,
        signer: { ...signer, kind: 'external', envelopeJson: undefined },
      }),
    ).resolves.toEqual({ status: 'unsupported-signer' });

    expect(core.hasSignerSystemAuth).not.toHaveBeenCalled();
    expect(core.signWithSystemAuth).not.toHaveBeenCalled();
    expect(core.signWithPasscode).not.toHaveBeenCalled();
  });
});
