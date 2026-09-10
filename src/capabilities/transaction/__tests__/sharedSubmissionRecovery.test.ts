import type {FresnicaSdkPort} from '../../ports/FresnicaSdkPort';
import type {PaymentReview} from '../../payment/buildPaymentReview';
import {submitReviewedPayment} from '../../payment/submitReviewedPayment';
import type {SignerRecord} from '../../signer/types';
import type {TrustlineGatewayPort} from '../../trustline/TrustlineGateway';
import type {TrustlineReview} from '../../trustline/buildTrustlineReview';
import {submitReviewedTrustline} from '../../trustline/submitReviewedTrustline';
import {InMemoryPendingSubmissionRepository} from '../../../platform/persistence/memory/InMemoryPendingSubmissionRepository';
import {reconcilePendingSubmissions} from '../reconcilePendingSubmissions';
import type {TransactionGatewayPort} from '../TransactionGateway';

const NETWORK = Object.freeze({
  id: 'stellar-testnet',
  networkPassphrase: 'Test SDF Network ; September 2015',
});
const signer: SignerRecord = {
  id: 'signer-1',
  publicKey: 'GLOCAL',
  kind: 'protected-software',
  envelopeJson: '{"protected":true}',
  createdAt: new Date('2026-09-10T00:00:00.000Z'),
  updatedAt: new Date('2026-09-10T00:00:00.000Z'),
};

const paymentReview: PaymentReview = Object.freeze({
  transactionXdrBase64: 'payment-reviewed-xdr',
  networkId: NETWORK.id,
  source: 'GPAYMENTSOURCE',
  fee: '100',
  operation: 'payment',
  destination: 'GDESTINATION',
  amount: '1.0000000',
  asset: Object.freeze({kind: 'native' as const}),
});

const trustlineReview: TrustlineReview = Object.freeze({
  transactionXdrBase64: 'trustline-reviewed-xdr',
  networkId: NETWORK.id,
  source: 'GTRUSTLINESOURCE',
  fee: '100',
  operation: 'set-limit',
  asset: Object.freeze({code: 'USD', issuer: 'GISSUER'}),
  limit: '100.0000000',
});

function hashForSignedXdr(signedXdr: string): string {
  return signedXdr.includes('trustline') ? 'trustline-hash' : 'payment-hash';
}

describe('shared Payment and Trustline submission recovery', () => {
  it('persists and reconciles S07 and S30 through one recovery repository', async () => {
    const repository = new InMemoryPendingSubmissionRepository();
    const readInvalidation = {invalidate: jest.fn()};
    const recovery = {
      repository,
      readInvalidation,
      now: () => new Date('2026-09-10T00:00:00.000Z'),
    };
    const transactionGateway = {
      loadAccountAuthorization: jest.fn(async (address: string) => ({
        address,
        thresholds: {low: 1, medium: 1, high: 2},
        signers: [{kind: 'ed25519' as const, publicKey: signer.publicKey, weight: 1}],
      })),
      transactionHash: jest.fn((signedXdr: string) => hashForSignedXdr(signedXdr)),
      submitTransaction: jest.fn(async (signedXdr: string) => ({
        status: 'uncertain' as const,
        transactionHash: hashForSignedXdr(signedXdr),
      })),
      loadTransactionOutcome: jest.fn(async (transactionHash: string) => ({
        status: 'confirmed' as const,
        transactionHash,
        ledger: transactionHash === 'payment-hash' ? 100 : 101,
      })),
    } satisfies TransactionGatewayPort;
    const trustlineGateway = {
      ...transactionGateway,
      inspectTrustlineTransaction: jest.fn().mockReturnValue({
        source: trustlineReview.source,
        fee: trustlineReview.fee,
        asset: trustlineReview.asset,
        limit: trustlineReview.limit,
      }),
    } as unknown as TrustlineGatewayPort;
    const sdk = {
      hasSignerSystemAuth: jest.fn().mockResolvedValue(true),
      signWithSystemAuth: jest.fn(async (input: {transactionXdrBase64: string}) =>
        input.transactionXdrBase64.includes('trustline')
          ? 'signed-trustline-xdr'
          : 'signed-payment-xdr',
      ),
    } as unknown as FresnicaSdkPort;

    await expect(
      submitReviewedPayment({
        gateway: transactionGateway,
        sdk,
        review: paymentReview,
        accountId: 'payment-account',
        recovery,
        signer,
        networkPassphrase: NETWORK.networkPassphrase,
      }),
    ).resolves.toMatchObject({status: 'uncertain', transactionHash: 'payment-hash'});
    await expect(
      submitReviewedTrustline({
        gateway: trustlineGateway,
        sdk,
        review: trustlineReview,
        accountId: 'trustline-account',
        recovery,
        signer,
        network: NETWORK,
      }),
    ).resolves.toMatchObject({status: 'uncertain', transactionHash: 'trustline-hash'});

    expect(
      repository
        .listUnresolved(NETWORK.id)
        .map(record => [record.intentKind, record.accountId, record.transactionHash]),
    ).toEqual([
      ['payment', 'payment-account', 'payment-hash'],
      ['trustline', 'trustline-account', 'trustline-hash'],
    ]);

    await reconcilePendingSubmissions({
      gateway: transactionGateway,
      repository,
      readInvalidation,
      networkId: NETWORK.id,
      now: () => new Date('2026-09-10T00:05:00.000Z'),
    });
    expect(repository.listUnresolved(NETWORK.id)).toEqual([]);
  });
});
