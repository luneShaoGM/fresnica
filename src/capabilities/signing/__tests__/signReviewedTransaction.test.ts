import { APP_CONFIG } from '../../../app/config/appConfig';
import type { FresnicaSdk } from '../../../platform/fresnica/FresnicaSdk';
import type { SignerRecord } from '../../signer/types';
import type { ReviewedTransaction } from '../../transaction/ReviewedTransaction';
import { signReviewedTransaction } from '../signReviewedTransaction';

const signer: SignerRecord = {
  id: 'signer-1',
  publicKey: 'GLOCAL',
  kind: 'protected-software',
  envelopeJson: '{"protected":true}',
  createdAt: new Date('2026-08-26T00:00:00Z'),
  updatedAt: new Date('2026-08-26T00:00:00Z'),
};

const review: ReviewedTransaction = Object.freeze({
  transactionXdrBase64: 'AAAA-reviewed-xdr',
  networkId: 'stellar-testnet',
  source: 'GSOURCE',
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

describe('signReviewedTransaction', () => {
  it('uses System Auth for the exact reviewed XDR when registered', async () => {
    const sdk = sdkWith({ hasSignerSystemAuth: jest.fn().mockResolvedValue(true) });

    await expect(
      signReviewedTransaction({ sdk, review, signer, systemAuthReason: 'Confirm transaction' }),
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
      reason: 'Confirm transaction',
    });
  });

  it('requires passcode without inventing a feature-local fallback', async () => {
    const sdk = sdkWith();
    await expect(signReviewedTransaction({ sdk, review, signer })).resolves.toEqual({
      status: 'passcode-required',
    });
  });

  it('uses passcode signing for the same exact reviewed XDR', async () => {
    const sdk = sdkWith();
    await expect(
      signReviewedTransaction({ sdk, review, signer, appPasscode: '123456' }),
    ).resolves.toEqual({
      status: 'signed',
      authorization: 'passcode',
      signedTransactionXdrBase64: 'AAAA-passcode-signed',
    });
    expect(sdk.signWithPasscode).toHaveBeenCalledWith(
      expect.objectContaining({ transactionXdrBase64: review.transactionXdrBase64 }),
    );
  });

  it('rejects unsupported signer records before invoking the SDK', async () => {
    const sdk = sdkWith();
    await expect(
      signReviewedTransaction({
        sdk,
        review,
        signer: { ...signer, kind: 'external', envelopeJson: undefined },
      }),
    ).resolves.toEqual({ status: 'unsupported-signer' });
    expect(sdk.hasSignerSystemAuth).not.toHaveBeenCalled();
  });
});
