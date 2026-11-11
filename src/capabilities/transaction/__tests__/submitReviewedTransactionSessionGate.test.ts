import type { FresnicaSdkPort } from '../../ports/FresnicaSdkPort';
import type { SignerRecord } from '../../signer/types';
import { InMemoryPendingSubmissionRepository } from '../../../platform/persistence/memory/InMemoryPendingSubmissionRepository';
import { submitReviewedTransaction } from '../submitReviewedTransaction';
import type { TransactionGatewayPort } from '../TransactionGateway';

const networkId = 'stellar-testnet';
const networkPassphrase = 'Test SDF Network ; September 2015';
const signer: SignerRecord = {
  id: 'wallet-A-signer',
  publicKey: 'GSIGNER',
  kind: 'protected-software',
  envelopeJson: '{"protected":true}',
  createdAt: new Date(0),
  updatedAt: new Date(0),
};
const review = {
  transactionXdrBase64: 'original-reviewed-xdr',
  networkId,
  source: 'GACCOUNT_A',
  fee: '100',
};
const intent = { kind: 'claimable', key: 'claimable-A' };

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => {
    resolve = done;
  });
  return { promise, resolve };
}

function fixture() {
  const repository = new InMemoryPendingSubmissionRepository();
  const gateway = {
    loadAccountAuthorization: jest.fn(async (source: string) => ({
      address: source,
      thresholds: { low: 1, medium: 1, high: 2 },
      signers: [{ kind: 'ed25519' as const, publicKey: signer.publicKey, weight: 1 }],
    })),
    transactionHash: jest.fn(() => 'ORIGINAL_HASH'),
    submitTransaction: jest.fn(async () => ({ status: 'accepted' as const, hash: 'ORIGINAL_HASH', ledger: 123 })),
    loadTransactionOutcome: jest.fn(),
  } satisfies TransactionGatewayPort;
  const sdk = {
    hasSignerSystemAuth: jest.fn(async () => true),
    signWithSystemAuth: jest.fn(async () => 'signed-original-xdr'),
    signWithPassphrase: jest.fn(async () => 'signed-original-xdr'),
  };
  const recovery = {
    repository,
    readInvalidation: { invalidate: jest.fn() },
    now: () => new Date(),
  };
  const submit = (isCurrent: () => boolean, appPassphrase = 'test app passphrase') =>
    submitReviewedTransaction({
      gateway,
      sdk: sdk as unknown as FresnicaSdkPort,
      recovery,
      review,
      accountId: 'wallet-A',
      signer,
      thresholdLevel: 'medium',
      intent,
      networkPassphrase,
      ...(appPassphrase === undefined ? {} : { appPassphrase }),
      isCurrent,
    });
  return { repository, gateway, sdk, submit };
}

function expectNoBroadcast(f: ReturnType<typeof fixture>) {
  expect(f.gateway.submitTransaction).not.toHaveBeenCalled();
  expect(f.gateway.transactionHash).not.toHaveBeenCalled();
  expect(f.repository.findBlockingIntent(networkId, 'wallet-A', intent.key)).toBeUndefined();
}

describe('Claimable lifetime guard through shared authorization / signing / submission', () => {
  it('retiring account A during deferred ledger authorization never initiates signing or broadcast', async () => {
    const f = fixture();
    const authorization = deferred<Awaited<ReturnType<typeof f.gateway.loadAccountAuthorization>>>();
    f.gateway.loadAccountAuthorization.mockReturnValueOnce(authorization.promise);
    let selectedAccountId = 'wallet-A';
    const submitted = f.submit(() => selectedAccountId === 'wallet-A');
    expect(f.gateway.loadAccountAuthorization).toHaveBeenCalledTimes(1);

    selectedAccountId = 'wallet-B';
    authorization.resolve({
      address: review.source,
      thresholds: { low: 1, medium: 1, high: 2 },
      signers: [{ kind: 'ed25519', publicKey: signer.publicKey, weight: 1 }],
    });
    await expect(submitted).rejects.toThrow('reviewed-transaction-session-retired');
    expect(f.sdk.hasSignerSystemAuth).not.toHaveBeenCalled();
    expect(f.sdk.signWithPassphrase).not.toHaveBeenCalled();
    expectNoBroadcast(f);
  });

  it('an enrolled signer cannot sign without an explicitly supplied passphrase', async () => {
    const f = fixture();
    await expect(f.submit(() => true, '')).resolves.toEqual({ status: 'passphrase-required' });
    expect(f.sdk.hasSignerSystemAuth).not.toHaveBeenCalled();
    expect(f.sdk.signWithPassphrase).not.toHaveBeenCalled();
    expectNoBroadcast(f);
  });

  it('leaving the route during pending native passphrase signing discards the signed envelope before a pending row or broadcast', async () => {
    const f = fixture();
    const nativeAuth = deferred<string>();
    f.sdk.signWithPassphrase.mockReturnValueOnce(nativeAuth.promise);
    let focusEpoch = 1;
    const capturedFocusEpoch = focusEpoch;
    const submitted = f.submit(() => focusEpoch === capturedFocusEpoch);
    await Promise.resolve();
    await Promise.resolve();
    expect(f.sdk.signWithPassphrase).toHaveBeenCalledTimes(1);

    // The user navigates away, then rapidly returns. A boolean focused flag
    // would become true again; the captured epoch must remain retired.
    focusEpoch += 1;
    nativeAuth.resolve('signed-old-account-xdr');
    await expect(submitted).rejects.toThrow('reviewed-transaction-session-retired');
    expectNoBroadcast(f);
  });

  it('switching accounts while passphrase signing is pending never persists or broadcasts the retired account', async () => {
    const f = fixture();
    f.sdk.hasSignerSystemAuth.mockResolvedValue(false);
    const passphraseSigning = deferred<string>();
    f.sdk.signWithPassphrase.mockReturnValueOnce(passphraseSigning.promise);
    let selectedAccountId = 'wallet-A';
    const submitted = f.submit(() => selectedAccountId === 'wallet-A', 'app-passphrase');
    await Promise.resolve();
    await Promise.resolve();
    expect(f.sdk.signWithPassphrase).toHaveBeenCalledTimes(1);

    selectedAccountId = 'wallet-B';
    passphraseSigning.resolve('passphrase-signed-old-account-xdr');
    await expect(submitted).rejects.toThrow('reviewed-transaction-session-retired');
    expectNoBroadcast(f);
  });

  it('a callback throwing an exception also fails closed before the ledger request', async () => {
    const f = fixture();
    await expect(
      f.submit(() => {
        throw new Error('navigation-disposed');
      }),
    ).rejects.toThrow('navigation-disposed');
    expect(f.gateway.loadAccountAuthorization).not.toHaveBeenCalled();
    expectNoBroadcast(f);
  });

  it('rechecks once more immediately before writing pending even if session retires while hashing', async () => {
    const f = fixture();
    let active = true;
    f.gateway.transactionHash.mockImplementation(() => {
      active = false;
      return 'ORIGINAL_HASH';
    });
    await expect(f.submit(() => active)).rejects.toThrow('reviewed-transaction-session-retired');
    expect(f.gateway.submitTransaction).not.toHaveBeenCalled();
    expect(f.repository.findBlockingIntent(networkId, 'wallet-A', intent.key)).toBeUndefined();
  });

  it('does not silently cancel the original broadcast after a durable pending record has been written', async () => {
    const f = fixture();
    let focused = true;
    const originalCreate = f.repository.create.bind(f.repository);
    jest.spyOn(f.repository, 'create').mockImplementation(record => {
      originalCreate(record);
      focused = false;
    });
    await expect(f.submit(() => focused)).resolves.toEqual({
      status: 'submitted',
      authorization: 'passphrase',
      hash: 'ORIGINAL_HASH',
      ledger: 123,
    });
    expect(f.gateway.submitTransaction).toHaveBeenCalledTimes(1);
    expect(f.repository.get(networkId, 'ORIGINAL_HASH')?.state).toBe('confirmed');
  });

  it('a continuously valid route uses the exact signed review once', async () => {
    const f = fixture();
    await expect(f.submit(() => true)).resolves.toMatchObject({ status: 'submitted', hash: 'ORIGINAL_HASH' });
    expect(f.sdk.signWithPassphrase).toHaveBeenCalledWith(
      expect.objectContaining({ transactionXdrBase64: review.transactionXdrBase64 }),
    );
    expect(f.gateway.submitTransaction).toHaveBeenCalledWith('signed-original-xdr');
    expect(f.gateway.submitTransaction).toHaveBeenCalledTimes(1);
  });
});
