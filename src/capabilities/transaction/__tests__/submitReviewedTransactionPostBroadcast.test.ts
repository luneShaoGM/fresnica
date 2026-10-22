import type { FresnicaSdkPort } from '../../ports/FresnicaSdkPort';
import type { SignerRecord } from '../../signer/types';
import { InMemoryPendingSubmissionRepository } from '../../../platform/persistence/memory/InMemoryPendingSubmissionRepository';
import { reconcilePendingSubmissions } from '../reconcilePendingSubmissions';
import type { TransactionSubmissionResult } from '../submission';
import { submitReviewedTransaction } from '../submitReviewedTransaction';
import type { TransactionGatewayPort } from '../TransactionGateway';

const network = { id: 'stellar-testnet', networkPassphrase: 'Test SDF Network ; September 2015' };
const signer: SignerRecord = {
  id: 'one',
  publicKey: 'GSIGNER',
  kind: 'protected-software',
  envelopeJson: '{"protected":true}',
  createdAt: new Date(0),
  updatedAt: new Date(0),
};
const review = {
  transactionXdrBase64: 'reviewed-xdr',
  networkId: network.id,
  source: 'GSOURCE',
  fee: '100',
};
const intent = { kind: 'path-payment', key: '["path-payment","intent"]' };

function fixture() {
  const repository = new InMemoryPendingSubmissionRepository();
  const readInvalidation = { invalidate: jest.fn() };
  const gateway = {
    loadAccountAuthorization: jest.fn(async (address: string) => ({
      address,
      thresholds: { low: 1, medium: 1, high: 2 },
      signers: [{ kind: 'ed25519' as const, publicKey: signer.publicKey, weight: 1 }],
    })),
    transactionHash: jest.fn(() => 'ORIGINAL_HASH'),
    submitTransaction: jest.fn(async (): Promise<TransactionSubmissionResult> => ({
      status: 'accepted',
      hash: 'ORIGINAL_HASH',
      ledger: 123,
    })),
    loadTransactionOutcome: jest.fn(async () => ({
      status: 'confirmed' as const,
      transactionHash: 'ORIGINAL_HASH',
      ledger: 123,
    })),
  } satisfies TransactionGatewayPort;
  const sdk = {
    hasSignerSystemAuth: jest.fn(async () => true),
    signWithSystemAuth: jest.fn(async () => 'signed-xdr'),
  } as unknown as FresnicaSdkPort;
  const recovery = { repository, readInvalidation, now: () => new Date() };
  const submit = () =>
    submitReviewedTransaction({
      gateway,
      sdk,
      review,
      accountId: 'wallet-one',
      intent,
      recovery,
      signer,
      thresholdLevel: 'medium',
      networkPassphrase: network.networkPassphrase,
    });
  return { repository, readInvalidation, gateway, submit, recovery };
}

describe('shared submission when the network already returned but local persistence fails', () => {
  it('keeps the original accepted hash uncertain (check-only) when markConfirmed fails', async () => {
    const { repository, gateway, submit, recovery } = fixture();
    const failingWrite = jest.spyOn(repository, 'markConfirmed').mockImplementation(() => {
      throw new Error('realm-write-failed');
    });
    await expect(submit()).resolves.toEqual({ status: 'uncertain', transactionHash: 'ORIGINAL_HASH' });
    expect(gateway.submitTransaction).toHaveBeenCalledTimes(1);
    expect(repository.findBlockingIntent(network.id, 'wallet-one', intent.key)).toMatchObject({
      transactionHash: 'ORIGINAL_HASH',
    });
    await expect(submit()).resolves.toEqual({
      status: 'uncertain',
      transactionHash: 'ORIGINAL_HASH',
      reason: 'pending-reconciliation',
    });
    expect(gateway.submitTransaction).toHaveBeenCalledTimes(1);
    failingWrite.mockRestore();
    await reconcilePendingSubmissions({
      gateway,
      repository,
      readInvalidation: recovery.readInvalidation,
      networkId: network.id,
    });
    expect(repository.get(network.id, 'ORIGINAL_HASH')).toMatchObject({ state: 'confirmed', ledger: 123 });
  });

  it('retains a blocking submitting row when all post-broadcast Realm writes fail', async () => {
    const { repository, gateway, submit } = fixture();
    jest.spyOn(repository, 'markConfirmed').mockImplementation(() => {
      throw new Error('realm-closed');
    });
    jest.spyOn(repository, 'markUncertain').mockImplementation(() => {
      throw new Error('realm-closed');
    });
    await expect(submit()).resolves.toEqual({ status: 'uncertain', transactionHash: 'ORIGINAL_HASH' });
    expect(repository.get(network.id, 'ORIGINAL_HASH')).toMatchObject({ state: 'submitting' });
    await expect(submit()).resolves.toMatchObject({
      status: 'uncertain',
      transactionHash: 'ORIGINAL_HASH',
      reason: 'pending-reconciliation',
    });
    expect(gateway.submitTransaction).toHaveBeenCalledTimes(1);
  });

  it('uses the original hash and does not claim rejection when markRejected fails', async () => {
    const { repository, gateway, submit } = fixture();
    gateway.submitTransaction.mockImplementationOnce(async () => ({
      status: 'rejected' as const,
      transactionHash: 'ORIGINAL_HASH',
      resultCode: 'tx_bad_seq',
    }));
    jest.spyOn(repository, 'markRejected').mockImplementation(() => {
      throw new Error('realm-write-failed');
    });
    await expect(submit()).resolves.toEqual({ status: 'uncertain', transactionHash: 'ORIGINAL_HASH' });
    expect(repository.findBlockingIntent(network.id, 'wallet-one', intent.key)).toBeDefined();
    expect(gateway.submitTransaction).toHaveBeenCalledTimes(1);
  });

  it('preserves check-only recovery if markUncertain fails after an unknown response', async () => {
    const { repository, gateway, submit } = fixture();
    gateway.submitTransaction.mockImplementationOnce(async () => ({
      status: 'uncertain' as const,
      transactionHash: 'ORIGINAL_HASH',
    }));
    jest.spyOn(repository, 'markUncertain').mockImplementation(() => {
      throw new Error('realm-write-failed');
    });
    await expect(submit()).resolves.toEqual({ status: 'uncertain', transactionHash: 'ORIGINAL_HASH' });
    expect(repository.findBlockingIntent(network.id, 'wallet-one', intent.key)).toBeDefined();
    expect(gateway.submitTransaction).toHaveBeenCalledTimes(1);
  });

  it('keeps the original hash uncertain if post-broadcast ledger invalidation fails', async () => {
    const { repository, readInvalidation, gateway, submit } = fixture();
    readInvalidation.invalidate.mockImplementation(() => {
      throw new Error('read-invalidation-failed');
    });
    await expect(submit()).resolves.toEqual({ status: 'uncertain', transactionHash: 'ORIGINAL_HASH' });
    expect(repository.findBlockingIntent(network.id, 'wallet-one', intent.key)).toBeDefined();
    expect(gateway.submitTransaction).toHaveBeenCalledTimes(1);
  });
});
