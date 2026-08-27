import type { FresnicaSdk } from '../../../../platform/fresnica/FresnicaSdk';
import type { SignerRecord } from '../../../../capabilities/signer/types';
import { APP_CONFIG } from '../../../../app/config/appConfig';
import type { PaymentReview } from '../../../../capabilities/payment/buildPaymentReview';
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

function sdkWith(overrides?: Partial<FresnicaSdk>) {
  return {
    hasSignerSystemAuth: jest.fn().mockResolvedValue(false),
    signWithSystemAuth: jest.fn().mockResolvedValue('AAAA-system-signed'),
    signWithPasscode: jest.fn().mockResolvedValue('AAAA-passcode-signed'),
    ...overrides,
  } as unknown as jest.Mocked<FresnicaSdk>;
}

describe('signReviewedPayment', () => {
  it('automatically uses native System Auth when the signer is registered', async () => {
    const sdk = sdkWith({
      hasSignerSystemAuth: jest.fn().mockResolvedValue(true),
    });

    await expect(
      signReviewedPayment({
        sdk,
        review,
        signer,
        systemAuthReason: 'Confirm Fresnica payment',
      }),
    ).resolves.toEqual({
      status: 'signed',
      authorization: 'system-auth',
      signedTransactionXdrBase64: 'AAAA-system-signed',
    });

    expect(sdk.signWithSystemAuth).toHaveBeenCalledWith({
      envelopeJson: signer.envelopeJson,
      expectedSignerPublicKey: signer.publicKey,
      transactionXdrBase64: review.transactionXdrBase64,
      networkPassphrase: APP_CONFIG.network.networkPassphrase,
      reason: 'Confirm Fresnica payment',
    });
    expect(sdk.signWithPasscode).not.toHaveBeenCalled();
  });

  it('requires a passcode instead of inventing a fallback when System Auth is not registered', async () => {
    const sdk = sdkWith();

    await expect(signReviewedPayment({ sdk, review, signer })).resolves.toEqual({
      status: 'passcode-required',
    });

    expect(sdk.signWithSystemAuth).not.toHaveBeenCalled();
    expect(sdk.signWithPasscode).not.toHaveBeenCalled();
  });

  it('uses the SDK composite passcode-sign operation for the same reviewed XDR', async () => {
    const sdk = sdkWith();

    await expect(
      signReviewedPayment({ sdk, review, signer, appPasscode: '123456' }),
    ).resolves.toEqual({
      status: 'signed',
      authorization: 'passcode',
      signedTransactionXdrBase64: 'AAAA-passcode-signed',
    });

    expect(sdk.signWithPasscode).toHaveBeenCalledWith({
      envelopeJson: signer.envelopeJson,
      appPasscode: '123456',
      expectedSignerPublicKey: signer.publicKey,
      transactionXdrBase64: review.transactionXdrBase64,
      networkPassphrase: APP_CONFIG.network.networkPassphrase,
    });
    expect(sdk.signWithSystemAuth).not.toHaveBeenCalled();
  });

  it('rejects non-software or malformed local signer records before invoking the SDK', async () => {
    const sdk = sdkWith();

    await expect(
      signReviewedPayment({
        sdk,
        review,
        signer: { ...signer, kind: 'external', envelopeJson: undefined },
      }),
    ).resolves.toEqual({ status: 'unsupported-signer' });

    expect(sdk.hasSignerSystemAuth).not.toHaveBeenCalled();
    expect(sdk.signWithSystemAuth).not.toHaveBeenCalled();
    expect(sdk.signWithPasscode).not.toHaveBeenCalled();
  });
});
