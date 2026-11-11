import type { FresnicaSdkPort } from '../../ports/FresnicaSdkPort';
import type { SignerRecord } from '../../signer/types';
import type { ReviewedTransaction } from '../../transaction/ReviewedTransaction';
import { signReviewedTransaction } from '../signReviewedTransaction';

const NETWORK_PASSPHRASE = 'Test SDF Network ; September 2015';

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

function sdkWith(overrides?: Partial<FresnicaSdkPort>) {
  return {
    hasSignerSystemAuth: jest.fn().mockResolvedValue(false),
    signWithSystemAuth: jest.fn().mockResolvedValue('AAAA-system-signed'),
    signWithPassphrase: jest.fn().mockResolvedValue('AAAA-passphrase-signed'),
    ...overrides,
  } as unknown as jest.Mocked<FresnicaSdkPort>;
}

describe('signReviewedTransaction', () => {
  it.each([undefined, 'routine', 'passphrase-required'] as const)(
    'never uses enrolled System Auth under policy %s',
    async authorizationPolicy => {
      const sdk = sdkWith({ hasSignerSystemAuth: jest.fn().mockResolvedValue(true) });
      await expect(
        signReviewedTransaction({ sdk, review, signer, authorizationPolicy, networkPassphrase: NETWORK_PASSPHRASE }),
      ).resolves.toEqual({ status: 'passphrase-required' });
      expect(sdk.hasSignerSystemAuth).not.toHaveBeenCalled();
      expect(sdk.signWithSystemAuth).not.toHaveBeenCalled();
      expect(sdk.signWithPassphrase).not.toHaveBeenCalled();
    },
  );
  it('rejects wrong passphrase without system-auth fallback and requires fresh input on retry', async () => {
    const sdk = sdkWith();
    sdk.signWithPassphrase.mockRejectedValueOnce(new Error('invalid-passcode'));
    await expect(
      signReviewedTransaction({ sdk, review, signer, appPassphrase: 'wrong', networkPassphrase: NETWORK_PASSPHRASE }),
    ).rejects.toThrow('invalid-passcode');
    await expect(
      signReviewedTransaction({ sdk, review, signer, networkPassphrase: NETWORK_PASSPHRASE }),
    ).resolves.toEqual({ status: 'passphrase-required' });
    expect(sdk.signWithPassphrase).toHaveBeenCalledTimes(1);
    expect(sdk.signWithSystemAuth).not.toHaveBeenCalled();
  });
  it('requires passphrase without inventing a feature-local fallback', async () => {
    const sdk = sdkWith();
    await expect(
      signReviewedTransaction({ sdk, review, signer, networkPassphrase: NETWORK_PASSPHRASE }),
    ).resolves.toEqual({
      status: 'passphrase-required',
    });
  });

  it('uses passphrase signing for the same exact reviewed XDR', async () => {
    const sdk = sdkWith();
    await expect(
      signReviewedTransaction({
        sdk,
        review,
        signer,
        networkPassphrase: NETWORK_PASSPHRASE,
        appPassphrase: 'a strong app passphrase',
      }),
    ).resolves.toEqual({
      status: 'signed',
      authorization: 'passphrase',
      signedTransactionXdrBase64: 'AAAA-passphrase-signed',
    });
    expect(sdk.signWithPassphrase).toHaveBeenCalledWith(
      expect.objectContaining({ transactionXdrBase64: review.transactionXdrBase64 }),
    );
  });

  it('never invokes System Auth when policy requires a fresh passphrase', async () => {
    const sdk = sdkWith({ hasSignerSystemAuth: jest.fn().mockResolvedValue(true) });

    await expect(
      signReviewedTransaction({
        sdk,
        review,
        signer,
        networkPassphrase: NETWORK_PASSPHRASE,
        authorizationPolicy: 'passphrase-required',
      }),
    ).resolves.toEqual({ status: 'passphrase-required' });

    expect(sdk.hasSignerSystemAuth).not.toHaveBeenCalled();
    expect(sdk.signWithSystemAuth).not.toHaveBeenCalled();
  });

  it('uses only passphrase signing for passphrase-required actions', async () => {
    const sdk = sdkWith({ hasSignerSystemAuth: jest.fn().mockResolvedValue(true) });

    await expect(
      signReviewedTransaction({
        sdk,
        review,
        signer,
        networkPassphrase: NETWORK_PASSPHRASE,
        appPassphrase: 'a strong app passphrase',
        authorizationPolicy: 'passphrase-required',
      }),
    ).resolves.toEqual({
      status: 'signed',
      authorization: 'passphrase',
      signedTransactionXdrBase64: 'AAAA-passphrase-signed',
    });

    expect(sdk.hasSignerSystemAuth).not.toHaveBeenCalled();
    expect(sdk.signWithSystemAuth).not.toHaveBeenCalled();
  });

  it('rejects unsupported signer records before invoking the SDK', async () => {
    const sdk = sdkWith();
    await expect(
      signReviewedTransaction({
        sdk,
        review,
        signer: { ...signer, kind: 'external', envelopeJson: undefined },
        networkPassphrase: NETWORK_PASSPHRASE,
      }),
    ).resolves.toEqual({ status: 'unsupported-signer' });
    expect(sdk.hasSignerSystemAuth).not.toHaveBeenCalled();
  });
});
