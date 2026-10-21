import type { AccountRecord } from '../../account/types';
import type { FresnicaSdkPort } from '../../ports/FresnicaSdkPort';
import type { SignerRecord } from '../../signer/types';
import type { TransactionGatewayPort } from '../../transaction/TransactionGateway';
import { reconcilePendingSubmissions } from '../../transaction/reconcilePendingSubmissions';
import { InMemoryPendingSubmissionRepository } from '../../../platform/persistence/memory/InMemoryPendingSubmissionRepository';
import { submitReviewedPathPayment } from '../submitReviewedPathPayment';
import type { PreparedPathPaymentReview, PathPaymentTransactionProjection } from '../types';

const NETWORK = Object.freeze({ id: 'stellar-testnet', networkPassphrase: 'Test SDF Network ; September 2015' });
const NATIVE = Object.freeze({ kind: 'native' as const });
const CREDIT = Object.freeze({ kind: 'credit' as const, code: 'USDC', issuer: 'GISSUER' });
const EUR = Object.freeze({ kind: 'credit' as const, code: 'EUR', issuer: 'GISSUER' });
const ACCOUNT = Object.freeze({
  id: 'wallet-1',
  address: 'GSOURCE',
  networkId: NETWORK.id,
  identityKind: 'classic' as const,
});
const SIGNER: SignerRecord = Object.freeze({
  id: 'signer-1',
  publicKey: 'GLOCAL',
  kind: 'protected-software',
  envelopeJson: '{"protected":true}',
  createdAt: new Date('2026-10-21T00:00:00Z'),
  updatedAt: new Date('2026-10-21T00:00:00Z'),
});

function reviewed(
  mode: 'strict_send' | 'strict_receive' = 'strict_send',
  overrides: Partial<PreparedPathPaymentReview> = {},
): PreparedPathPaymentReview {
  const quote = {
    request: {
      network: NETWORK,
      source: ACCOUNT.address,
      destination: 'GDEST',
      sourceAsset: NATIVE,
      destinationAsset: CREDIT,
      mode,
      fixedAmount: mode === 'strict_send' ? '5.0000000' : '10.0000000',
      memo: { type: 'text' as const, value: 'invoice' },
    },
    sourceAmount: '5.0000000',
    destinationAmount: '10.0000000',
    path: [EUR],
    quotedAtUnixMs: 1_700_000_000_000,
    expiresAtUnixMs: 1_700_000_030_000,
    quotedAtMonotonicMs: 20_000,
  };
  const common = {
    transactionXdrBase64: 'unsigned-path-xdr',
    networkId: NETWORK.id,
    source: ACCOUNT.address,
    destination: 'GDEST',
    sourceAsset: NATIVE,
    destinationAsset: CREDIT,
    path: [EUR],
    quote,
    memo: { type: 'text' as const, value: 'invoice' },
    quotedSourceAmount: '5.0000000',
    quotedDestinationAmount: '10.0000000',
    slippageBps: 100,
    fee: '100',
    expiresAtUnixSeconds: Math.floor(Date.now() / 1000) + 180,
  };
  return {
    ...common,
    ...(mode === 'strict_send'
      ? { mode, sendAmount: '5.0000000', destinationMinimum: '9.9000000' }
      : { mode, sourceMaximum: '5.0500000', destinationAmount: '10.0000000' }),
    ...overrides,
  } as PreparedPathPaymentReview;
}

function project(review: PreparedPathPaymentReview): PathPaymentTransactionProjection {
  return {
    source: review.source,
    destination: review.destination,
    sourceAsset: review.sourceAsset,
    destinationAsset: review.destinationAsset,
    path: review.path,
    memo: review.memo,
    fee: review.fee,
    minTimeUnixSeconds: 0,
    expiresAtUnixSeconds: review.expiresAtUnixSeconds,
    ...(review.mode === 'strict_send'
      ? { mode: review.mode, sendAmount: review.sendAmount, destinationMinimum: review.destinationMinimum }
      : { mode: review.mode, sendMaximum: review.sourceMaximum, destinationAmount: review.destinationAmount }),
  };
}

function fixture(review = reviewed()) {
  const repo = new InMemoryPendingSubmissionRepository();
  const readInvalidation = { invalidate: jest.fn() };
  const gateway = {
    network: NETWORK,
    loadAccountAuthorization: jest.fn(async (address: string) => ({
      address,
      thresholds: { low: 1, medium: 1, high: 2 },
      signers: [{ kind: 'ed25519' as const, publicKey: SIGNER.publicKey, weight: 1 }],
    })),
    transactionHash: jest.fn(() => 'path-hash-1'),
    loadTransactionOutcome: jest.fn(async (hash: string) => ({
      status: 'confirmed' as const,
      transactionHash: hash,
      ledger: 42,
    })),
    submitTransaction: jest.fn(async () => ({
      status: 'accepted' as const,
      hash: 'path-hash-1',
      ledger: 42,
    })),
  };
  const inspector = {
    network: NETWORK,
    inspectPathPaymentTransaction: jest.fn(() => project(review)),
  };
  const sdk = {
    hasSignerSystemAuth: jest.fn(async () => true),
    signWithSystemAuth: jest.fn(async () => 'signed-path-xdr'),
    signWithPassphrase: jest.fn(async () => 'passphrase-path-xdr'),
  } as unknown as jest.Mocked<FresnicaSdkPort>;
  const recovery = { repository: repo, readInvalidation, now: () => new Date() };
  const signerRepository = { listSignersForAccount: jest.fn(() => [SIGNER]) };
  const isCurrentSession = jest.fn(() => true);
  const deps = {
    network: NETWORK,
    gateway: gateway as typeof gateway & TransactionGatewayPort,
    inspector,
    sdk,
    signerRepository,
    recovery,
    isCurrentSession,
  };
  return { repo, gateway, inspector, sdk, signerRepository, recovery, isCurrentSession, deps };
}

describe('Swap-D1 exact-XDR-authorized submission bridge', () => {
  it.each(['strict_send', 'strict_receive'] as const)(
    'revalidates the actual %s XDR, uses the existing medium-threshold pipeline and persists before broadcast',
    async mode => {
      const review = reviewed(mode);
      const { deps, gateway, inspector, sdk, repo } = fixture(review);
      const create = jest.spyOn(repo, 'create');
      const result = await submitReviewedPathPayment(deps, ACCOUNT, review, SIGNER);
      expect(result).toEqual({ status: 'submitted', hash: 'path-hash-1', ledger: 42, authorization: 'system-auth' });
      expect(inspector.inspectPathPaymentTransaction).toHaveBeenCalledWith({
        transactionXdrBase64: 'unsigned-path-xdr',
        networkPassphrase: NETWORK.networkPassphrase,
      });
      expect(sdk.signWithSystemAuth).toHaveBeenCalledWith(
        expect.objectContaining({
          transactionXdrBase64: 'unsigned-path-xdr',
          networkPassphrase: NETWORK.networkPassphrase,
        }),
      );
      expect(gateway.loadAccountAuthorization).toHaveBeenCalledWith(ACCOUNT.address);
      expect(gateway.submitTransaction).toHaveBeenCalledWith('signed-path-xdr');
      expect(create).toHaveBeenCalledWith(
        expect.objectContaining({
          networkId: NETWORK.id,
          accountId: ACCOUNT.id,
          intentKind: 'path-payment',
          sourceAddress: ACCOUNT.address,
          transactionHash: 'path-hash-1',
          state: 'submitting',
        }),
      );
      expect(create.mock.invocationCallOrder[0]).toBeLessThan(gateway.submitTransaction.mock.invocationCallOrder[0]);
      expect(repo.listUnresolved(NETWORK.id)).toEqual([]);
    },
  );

  it('does not treat expired quote TTL as an expired prepared XDR', async () => {
    const review = reviewed();
    expect(review.quote.expiresAtUnixMs).toBeLessThan(Date.now());
    const { deps } = fixture(review);
    await expect(submitReviewedPathPayment(deps, ACCOUNT, review, SIGNER)).resolves.toMatchObject({
      status: 'submitted',
    });
  });

  it('uses explicit passphrase fallback without broadcasting before authorization', async () => {
    const review = reviewed();
    const { deps, sdk, gateway } = fixture(review);
    sdk.hasSignerSystemAuth.mockResolvedValue(false);
    await expect(submitReviewedPathPayment(deps, ACCOUNT, review, SIGNER)).resolves.toEqual({
      status: 'passphrase-required',
    });
    expect(gateway.submitTransaction).not.toHaveBeenCalled();
    await expect(submitReviewedPathPayment(deps, ACCOUNT, review, SIGNER, 'password')).resolves.toMatchObject({
      status: 'submitted',
      authorization: 'passphrase',
    });
    expect(sdk.signWithPassphrase).toHaveBeenCalledWith(
      expect.objectContaining({
        transactionXdrBase64: review.transactionXdrBase64,
        appPassphrase: 'password',
        networkPassphrase: NETWORK.networkPassphrase,
      }),
    );
  });

  it('propagates user authorization cancellation without pending row or broadcast', async () => {
    const review = reviewed();
    const { deps, gateway, sdk, repo } = fixture(review);
    sdk.signWithSystemAuth.mockRejectedValue(new Error('user-cancelled'));
    await expect(submitReviewedPathPayment(deps, ACCOUNT, review, SIGNER)).rejects.toThrow('user-cancelled');
    expect(gateway.submitTransaction).not.toHaveBeenCalled();
    expect(repo.listUnresolved(NETWORK.id)).toEqual([]);
  });

  it('blocks a fresh re-quote with changed path, quoted output, fee and slippage while prior intent is uncertain', async () => {
    const first = reviewed();
    const { deps, gateway, repo, inspector } = fixture(first);
    gateway.submitTransaction.mockResolvedValue({
      status: 'uncertain',
      transactionHash: 'path-hash-1',
    } as never);
    await expect(submitReviewedPathPayment(deps, ACCOUNT, first, SIGNER)).resolves.toMatchObject({
      status: 'uncertain',
      transactionHash: 'path-hash-1',
    });
    expect(repo.listUnresolved(NETWORK.id)).toHaveLength(1);
    const second: PreparedPathPaymentReview = {
      ...reviewed(),
      transactionXdrBase64: 'requoted-xdr',
      path: [],
      destinationMinimum: '10.8000000',
      quotedDestinationAmount: '12.0000000',
      fee: '200',
      slippageBps: 1000,
      quote: { ...first.quote, destinationAmount: '12.0000000', path: [] },
    } as PreparedPathPaymentReview;
    inspector.inspectPathPaymentTransaction.mockReturnValue(project(second));
    await expect(submitReviewedPathPayment(deps, ACCOUNT, second, SIGNER)).resolves.toMatchObject({
      status: 'uncertain',
      transactionHash: 'path-hash-1',
      reason: 'pending-reconciliation',
    });
    expect(gateway.submitTransaction).toHaveBeenCalledTimes(1);
    expect(gateway.loadAccountAuthorization).toHaveBeenCalledTimes(1);
    await reconcilePendingSubmissions({
      gateway,
      repository: repo,
      readInvalidation: deps.recovery.readInvalidation,
      networkId: NETWORK.id,
      now: () => new Date(),
    });
    expect(repo.listUnresolved(NETWORK.id)).toHaveLength(0);
  });

  it.each([
    ['source wallet', { ...ACCOUNT, address: 'GOTHER' }],
    ['network wallet', { ...ACCOUNT, networkId: 'stellar-mainnet' }],
    ['contract account', { ...ACCOUNT, identityKind: 'contract' as const }],
  ])('rejects wrong %s before signer authorization', async (_label, wallet) => {
    const review = reviewed();
    const { deps, sdk, gateway } = fixture(review);
    await expect(submitReviewedPathPayment(deps, wallet, review, SIGNER)).rejects.toThrow(
      'path_payment_review_mismatch',
    );
    expect(sdk.hasSignerSystemAuth).not.toHaveBeenCalled();
    expect(gateway.loadAccountAuthorization).not.toHaveBeenCalled();
  });

  it('rejects wrong active network/passphrase or bound inspector network before signing', async () => {
    const review = reviewed();
    const { deps, gateway, inspector } = fixture(review);
    await expect(
      submitReviewedPathPayment(
        {
          ...deps,
          network: { ...NETWORK, networkPassphrase: 'wrong' },
        },
        ACCOUNT,
        review,
        SIGNER,
      ),
    ).rejects.toThrow('path_payment_review_mismatch');
    Object.defineProperty(inspector, 'network', { value: { ...NETWORK, id: 'other' }, configurable: true });
    await expect(submitReviewedPathPayment(deps, ACCOUNT, review, SIGNER)).rejects.toThrow(
      'path_payment_review_mismatch',
    );
    expect(gateway.loadAccountAuthorization).not.toHaveBeenCalled();
  });

  it.each([
    ['destination', { destination: 'GOTHER' }],
    ['review source asset', { sourceAsset: CREDIT }],
    ['review memo', { memo: { type: 'text' as const, value: 'altered' } }],
    ['review path', { path: [] }],
    ['review fee', { fee: '101' }],
    ['review expiry', { expiresAtUnixSeconds: 500 }],
    ['review slippage', { destinationMinimum: '8.0000000' }],
    ['review wrong bps', { slippageBps: 999 }],
    [
      'review quote destination',
      { quote: { ...reviewed().quote, request: { ...reviewed().quote.request, destination: 'GOTHER' } } },
    ],
    [
      'review quote fixed amount',
      { quote: { ...reviewed().quote, request: { ...reviewed().quote.request, fixedAmount: '6.0000000' } } },
    ],
  ] as const)('rejects altered %s even if a caller supplies a review-shaped object', async (_name, overrides) => {
    const base = reviewed();
    const review = { ...base, ...overrides } as PreparedPathPaymentReview;
    const { deps, gateway, sdk } = fixture(base);
    await expect(submitReviewedPathPayment(deps, ACCOUNT, review, SIGNER)).rejects.toThrow(
      'path_payment_review_mismatch',
    );
    expect(gateway.loadAccountAuthorization).not.toHaveBeenCalled();
    expect(sdk.hasSignerSystemAuth).not.toHaveBeenCalled();
  });

  it.each([
    ['destination decoded', { destination: 'GOTHER' }],
    ['asset decoded', { destinationAsset: NATIVE }],
    ['memo decoded', { memo: { type: 'text' as const, value: 'wrong' } }],
    ['path decoded', { path: [] }],
    ['fee decoded', { fee: '101' }],
    ['TimeBounds decoded', { expiresAtUnixSeconds: 0 }],
    ['amount decoded', { sendAmount: '4.0000000' }],
    ['slippage decoded', { destinationMinimum: '8.0000000' }],
  ] as const)('rejects actual XDR %s mismatch before authorization', async (_name, drift) => {
    const review = reviewed();
    const { deps, inspector, sdk } = fixture(review);
    inspector.inspectPathPaymentTransaction.mockReturnValue({ ...project(review), ...drift });
    await expect(submitReviewedPathPayment(deps, ACCOUNT, review, SIGNER)).rejects.toThrow(
      'path_payment_review_mismatch',
    );
    expect(sdk.hasSignerSystemAuth).not.toHaveBeenCalled();
  });

  it('blocks an expired prepared XDR before touching signer or network', async () => {
    const current = reviewed();
    const review = { ...current, expiresAtUnixSeconds: Math.floor(Date.now() / 1000) - 1 };
    const { deps, sdk, gateway } = fixture(review);
    await expect(submitReviewedPathPayment(deps, ACCOUNT, review, SIGNER)).rejects.toThrow('expired');
    expect(sdk.hasSignerSystemAuth).not.toHaveBeenCalled();
    expect(gateway.submitTransaction).not.toHaveBeenCalled();
  });

  it('snapshots the selected signer before awaiting ledger authorization or system auth', async () => {
    const review = reviewed();
    const { deps, sdk } = fixture(review);
    const mutableSigner = { ...SIGNER };
    sdk.hasSignerSystemAuth.mockImplementationOnce(async () => {
      mutableSigner.publicKey = 'GATTACKER';
      mutableSigner.envelopeJson = '{"different":true}';
      return true;
    });
    await expect(submitReviewedPathPayment(deps, ACCOUNT, review, mutableSigner)).resolves.toMatchObject({
      status: 'submitted',
    });
    expect(sdk.signWithSystemAuth).toHaveBeenCalledWith(
      expect.objectContaining({
        expectedSignerPublicKey: SIGNER.publicKey,
        envelopeJson: SIGNER.envelopeJson,
        transactionXdrBase64: review.transactionXdrBase64,
      }),
    );
  });

  it('rejects network switching during awaited ledger authorization before signing', async () => {
    const review = reviewed();
    const { deps, gateway, sdk, repo } = fixture(review);
    gateway.loadAccountAuthorization.mockImplementationOnce(async address => {
      Object.defineProperty(gateway, 'network', {
        value: { ...NETWORK, id: 'stellar-mainnet' },
        configurable: true,
      });
      return {
        address,
        thresholds: { low: 1, medium: 1, high: 2 },
        signers: [{ kind: 'ed25519' as const, publicKey: SIGNER.publicKey, weight: 1 }],
      };
    });
    await expect(submitReviewedPathPayment(deps, ACCOUNT, review, SIGNER)).rejects.toThrow(
      'path_payment_review_mismatch',
    );
    expect(sdk.hasSignerSystemAuth).not.toHaveBeenCalled();
    expect(repo.listUnresolved(NETWORK.id)).toHaveLength(0);
  });

  it('rejects a network rebind during system authorization before persistence or submit', async () => {
    const review = reviewed();
    const { deps, gateway, sdk, repo } = fixture(review);
    sdk.signWithSystemAuth.mockImplementationOnce(async () => {
      Object.defineProperty(gateway, 'network', {
        value: { ...NETWORK, networkPassphrase: 'wrong-passphrase' },
        configurable: true,
      });
      return 'signed-path-xdr';
    });
    await expect(submitReviewedPathPayment(deps, ACCOUNT, review, SIGNER)).rejects.toThrow(
      'path_payment_review_mismatch',
    );
    expect(gateway.submitTransaction).not.toHaveBeenCalled();
    expect(repo.listUnresolved(NETWORK.id)).toHaveLength(0);
  });

  it.each([
    ['address', { address: 'GOTHER' }],
    ['network', { networkId: 'stellar-mainnet' }],
    ['account ID', { id: 'wallet-other' }],
    ['account type', { identityKind: 'contract' as const }],
  ])('rejects %s mutation during System Auth before persistence or broadcast', async (_field, mutation) => {
    const review = reviewed();
    const liveAccount: Pick<AccountRecord, 'id' | 'address' | 'networkId' | 'identityKind'> = { ...ACCOUNT };
    const { deps, gateway, sdk, repo, signerRepository } = fixture(review);
    sdk.signWithSystemAuth.mockImplementationOnce(async () => {
      Object.assign(liveAccount, mutation);
      return 'signed-path-xdr';
    });
    await expect(submitReviewedPathPayment(deps, liveAccount, review, SIGNER)).rejects.toThrow(
      'path_payment_review_mismatch',
    );
    expect(signerRepository.listSignersForAccount).toHaveBeenCalledWith(ACCOUNT.id);
    expect(gateway.submitTransaction).not.toHaveBeenCalled();
    expect(repo.get(NETWORK.id, 'path-hash-1')).toBeUndefined();
  });

  it('does not start System Auth signing when account changes during availability check', async () => {
    const review = reviewed();
    const liveAccount: Pick<AccountRecord, 'id' | 'address' | 'networkId' | 'identityKind'> = { ...ACCOUNT };
    const { deps, sdk, gateway, repo } = fixture(review);
    sdk.hasSignerSystemAuth.mockImplementationOnce(async () => {
      liveAccount.address = 'GOTHER';
      return true;
    });
    await expect(submitReviewedPathPayment(deps, liveAccount, review, SIGNER)).rejects.toThrow(
      'path_payment_review_mismatch',
    );
    expect(sdk.signWithSystemAuth).not.toHaveBeenCalled();
    expect(gateway.submitTransaction).not.toHaveBeenCalled();
    expect(repo.get(NETWORK.id, 'path-hash-1')).toBeUndefined();
  });

  it('blocks passphrase signing continuation after a live-account mutation', async () => {
    const review = reviewed();
    const liveAccount: Pick<AccountRecord, 'id' | 'address' | 'networkId' | 'identityKind'> = { ...ACCOUNT };
    const { deps, gateway, sdk, repo } = fixture(review);
    sdk.hasSignerSystemAuth.mockResolvedValueOnce(false);
    sdk.signWithPassphrase.mockImplementationOnce(async () => {
      liveAccount.id = 'wallet-other';
      return 'passphrase-path-xdr';
    });
    await expect(submitReviewedPathPayment(deps, liveAccount, review, SIGNER, 'password')).rejects.toThrow(
      'path_payment_review_mismatch',
    );
    expect(gateway.submitTransaction).not.toHaveBeenCalled();
    expect(repo.get(NETWORK.id, 'path-hash-1')).toBeUndefined();
  });

  it('rechecks account identity after awaited ledger authorization, before System Auth', async () => {
    const review = reviewed();
    const liveAccount: Pick<AccountRecord, 'id' | 'address' | 'networkId' | 'identityKind'> = { ...ACCOUNT };
    const { deps, gateway, sdk, repo } = fixture(review);
    gateway.loadAccountAuthorization.mockImplementationOnce(async address => {
      liveAccount.networkId = 'stellar-mainnet';
      return {
        address,
        thresholds: { low: 1, medium: 1, high: 2 },
        signers: [{ kind: 'ed25519' as const, publicKey: SIGNER.publicKey, weight: 1 }],
      };
    });
    await expect(submitReviewedPathPayment(deps, liveAccount, review, SIGNER)).rejects.toThrow(
      'path_payment_review_mismatch',
    );
    expect(sdk.hasSignerSystemAuth).not.toHaveBeenCalled();
    expect(gateway.submitTransaction).not.toHaveBeenCalled();
    expect(repo.get(NETWORK.id, 'path-hash-1')).toBeUndefined();
  });

  it('blocks broadcast and preserves pending reconciliation when the account changes after persistence', async () => {
    const review = reviewed();
    const liveAccount: Pick<AccountRecord, 'id' | 'address' | 'networkId' | 'identityKind'> = { ...ACCOUNT };
    const { deps, gateway, repo } = fixture(review);
    const originalCreate = repo.create.bind(repo);
    jest.spyOn(repo, 'create').mockImplementation(record => {
      originalCreate(record);
      liveAccount.address = 'GOTHER';
    });
    await expect(submitReviewedPathPayment(deps, liveAccount, review, SIGNER)).resolves.toMatchObject({
      status: 'uncertain',
      transactionHash: 'path-hash-1',
    });
    expect(gateway.submitTransaction).not.toHaveBeenCalled();
    expect(repo.get(NETWORK.id, 'path-hash-1')).toMatchObject({
      accountId: ACCOUNT.id,
      sourceAddress: ACCOUNT.address,
      state: 'uncertain',
    });
  });

  it('treats a changed account after broadcast as uncertain rather than accepted', async () => {
    const review = reviewed();
    const liveAccount: Pick<AccountRecord, 'id' | 'address' | 'networkId' | 'identityKind'> = { ...ACCOUNT };
    const { deps, gateway, repo } = fixture(review);
    gateway.submitTransaction.mockImplementationOnce(async () => {
      liveAccount.networkId = 'stellar-mainnet';
      return { status: 'accepted' as const, hash: 'path-hash-1', ledger: 42 };
    });
    await expect(submitReviewedPathPayment(deps, liveAccount, review, SIGNER)).resolves.toMatchObject({
      status: 'uncertain',
      transactionHash: 'path-hash-1',
    });
    expect(gateway.submitTransaction).toHaveBeenCalledTimes(1);
    expect(repo.get(NETWORK.id, 'path-hash-1')).toMatchObject({
      accountId: ACCOUNT.id,
      sourceAddress: ACCOUNT.address,
      state: 'uncertain',
    });
  });

  it('rejects a stale external account selection during System Auth even if AccountRecord itself is unchanged', async () => {
    const review = reviewed();
    const { deps, isCurrentSession, sdk, gateway, repo } = fixture(review);
    sdk.signWithSystemAuth.mockImplementationOnce(async () => {
      isCurrentSession.mockReturnValue(false);
      return 'signed-path-xdr';
    });
    await expect(submitReviewedPathPayment(deps, ACCOUNT, review, SIGNER)).rejects.toThrow(
      'path_payment_review_mismatch',
    );
    expect(gateway.submitTransaction).not.toHaveBeenCalled();
    expect(repo.get(NETWORK.id, 'path-hash-1')).toBeUndefined();
  });

  it('does not initiate native signing when external session is invalidated during System Auth availability', async () => {
    const review = reviewed();
    const { deps, isCurrentSession, sdk, gateway } = fixture(review);
    sdk.hasSignerSystemAuth.mockImplementationOnce(async () => {
      isCurrentSession.mockReturnValue(false);
      return true;
    });
    await expect(submitReviewedPathPayment(deps, ACCOUNT, review, SIGNER)).rejects.toThrow(
      'path_payment_review_mismatch',
    );
    expect(sdk.signWithSystemAuth).not.toHaveBeenCalled();
    expect(gateway.submitTransaction).not.toHaveBeenCalled();
  });

  it('checks the external selection after ledger authorization and before signer authorization', async () => {
    const review = reviewed();
    const { deps, isCurrentSession, sdk, gateway } = fixture(review);
    gateway.loadAccountAuthorization.mockImplementationOnce(async address => {
      isCurrentSession.mockReturnValue(false);
      return {
        address,
        thresholds: { low: 1, medium: 1, high: 2 },
        signers: [{ kind: 'ed25519' as const, publicKey: SIGNER.publicKey, weight: 1 }],
      };
    });
    await expect(submitReviewedPathPayment(deps, ACCOUNT, review, SIGNER)).rejects.toThrow(
      'path_payment_review_mismatch',
    );
    expect(sdk.hasSignerSystemAuth).not.toHaveBeenCalled();
  });

  it('blocks broadcast but preserves pending reconciliation when external selection changes after persistence', async () => {
    const review = reviewed();
    const { deps, isCurrentSession, gateway, repo } = fixture(review);
    const originalCreate = repo.create.bind(repo);
    jest.spyOn(repo, 'create').mockImplementation(record => {
      originalCreate(record);
      isCurrentSession.mockReturnValue(false);
    });
    await expect(submitReviewedPathPayment(deps, ACCOUNT, review, SIGNER)).resolves.toMatchObject({
      status: 'uncertain',
      transactionHash: 'path-hash-1',
    });
    expect(gateway.submitTransaction).not.toHaveBeenCalled();
    expect(repo.get(NETWORK.id, 'path-hash-1')).toMatchObject({ state: 'uncertain' });
  });

  it('never reports accepted after the external session changes while the broadcast is in progress', async () => {
    const review = reviewed();
    const { deps, isCurrentSession, gateway, repo } = fixture(review);
    gateway.submitTransaction.mockImplementationOnce(async () => {
      isCurrentSession.mockReturnValue(false);
      return { status: 'accepted' as const, hash: 'path-hash-1', ledger: 42 };
    });
    await expect(submitReviewedPathPayment(deps, ACCOUNT, review, SIGNER)).resolves.toMatchObject({
      status: 'uncertain',
      transactionHash: 'path-hash-1',
    });
    expect(gateway.submitTransaction).toHaveBeenCalledTimes(1);
    expect(repo.get(NETWORK.id, 'path-hash-1')).toMatchObject({ state: 'uncertain' });
  });

  it('does not accept replacing the supplied session guard function during signing', async () => {
    const review = reviewed();
    const { deps, isCurrentSession, sdk, gateway } = fixture(review);
    const mutableDeps = { ...deps };
    sdk.signWithSystemAuth.mockImplementationOnce(async () => {
      isCurrentSession.mockReturnValue(false);
      mutableDeps.isCurrentSession = jest.fn(() => true);
      return 'signed-path-xdr';
    });
    await expect(submitReviewedPathPayment(mutableDeps, ACCOUNT, review, SIGNER)).rejects.toThrow(
      'path_payment_review_mismatch',
    );
    expect(gateway.submitTransaction).not.toHaveBeenCalled();
  });

  it('fails closed if no live session is supplied by App composition', async () => {
    const review = reviewed();
    const { deps, sdk, gateway } = fixture(review);
    await expect(
      submitReviewedPathPayment({ ...deps, isCurrentSession: undefined } as never, ACCOUNT, review, SIGNER),
    ).rejects.toThrow('path_payment_review_mismatch');
    expect(sdk.hasSignerSystemAuth).not.toHaveBeenCalled();
    expect(gateway.loadAccountAuthorization).not.toHaveBeenCalled();
  });

  it('keeps a broadcast with network switching afterwards uncertain and requiring reconciliation', async () => {
    const review = reviewed();
    const { deps, gateway, repo } = fixture(review);
    gateway.submitTransaction.mockImplementationOnce(async () => {
      Object.defineProperty(gateway, 'network', {
        value: { ...NETWORK, id: 'stellar-mainnet' },
        configurable: true,
      });
      return { status: 'accepted' as const, hash: 'path-hash-1', ledger: 42 };
    });
    await expect(submitReviewedPathPayment(deps, ACCOUNT, review, SIGNER)).resolves.toMatchObject({
      status: 'uncertain',
      transactionHash: 'path-hash-1',
    });
    expect(repo.listUnresolved(NETWORK.id)).toHaveLength(1);
    expect(repo.listUnresolved(NETWORK.id)[0].state).toBe('uncertain');
  });

  it('maps a transport failure after attempting to broadcast into uncertain, never auto-retrying', async () => {
    const review = reviewed();
    const { deps, gateway, repo } = fixture(review);
    gateway.submitTransaction.mockRejectedValueOnce(new Error('network-broadcast-timeout'));
    await expect(submitReviewedPathPayment(deps, ACCOUNT, review, SIGNER)).resolves.toMatchObject({
      status: 'uncertain',
      transactionHash: 'path-hash-1',
    });
    expect(gateway.submitTransaction).toHaveBeenCalledTimes(1);
    expect(repo.listUnresolved(NETWORK.id)).toHaveLength(1);
  });

  it('rejects a signer unlinked during awaited authorization before invoking the SDK', async () => {
    const review = reviewed();
    const { deps, gateway, sdk, signerRepository, repo } = fixture(review);
    gateway.loadAccountAuthorization.mockImplementationOnce(async address => {
      signerRepository.listSignersForAccount.mockReturnValue([]);
      return {
        address,
        thresholds: { low: 1, medium: 1, high: 2 },
        signers: [{ kind: 'ed25519' as const, publicKey: SIGNER.publicKey, weight: 1 }],
      };
    });
    await expect(submitReviewedPathPayment(deps, ACCOUNT, review, SIGNER)).rejects.toThrow(
      'path_payment_signer_mismatch',
    );
    expect(sdk.hasSignerSystemAuth).not.toHaveBeenCalled();
    expect(repo.listUnresolved(NETWORK.id)).toHaveLength(0);
  });

  it('rejects a signer unlinked while System Auth runs before creating a pending submission', async () => {
    const review = reviewed();
    const { deps, sdk, gateway, signerRepository, repo } = fixture(review);
    sdk.signWithSystemAuth.mockImplementationOnce(async () => {
      signerRepository.listSignersForAccount.mockReturnValue([]);
      return 'signed-path-xdr';
    });
    await expect(submitReviewedPathPayment(deps, ACCOUNT, review, SIGNER)).rejects.toThrow(
      'path_payment_signer_mismatch',
    );
    expect(gateway.submitTransaction).not.toHaveBeenCalled();
    expect(repo.listUnresolved(NETWORK.id)).toHaveLength(0);
  });

  it.each([
    [
      'same endpoints',
      { quote: { ...reviewed().quote, request: { ...reviewed().quote.request, destinationAsset: NATIVE } } },
    ],
    ['six intermediates', { quote: { ...reviewed().quote, path: Array(6).fill(EUR) }, path: Array(6).fill(EUR) }],
    ['endpoint in path', { quote: { ...reviewed().quote, path: [NATIVE] }, path: [NATIVE] }],
  ] as const)('rejects a forged reviewed Swap with invalid %s before authorization', async (_name, changes) => {
    const review = { ...reviewed(), ...changes } as PreparedPathPaymentReview;
    const { deps, gateway, sdk } = fixture(review);
    await expect(submitReviewedPathPayment(deps, ACCOUNT, review, SIGNER)).rejects.toThrow(
      'path_payment_review_mismatch',
    );
    expect(sdk.hasSignerSystemAuth).not.toHaveBeenCalled();
    expect(gateway.loadAccountAuthorization).not.toHaveBeenCalled();
  });

  it('uses the shared deterministic rejection pathway and leaves no pending block', async () => {
    const review = reviewed();
    const { deps, gateway, repo } = fixture(review);
    gateway.submitTransaction.mockResolvedValueOnce({
      status: 'rejected',
      transactionHash: 'path-hash-1',
      resultCode: 'tx_bad_seq',
    } as never);
    await expect(submitReviewedPathPayment(deps, ACCOUNT, review, SIGNER)).resolves.toMatchObject({
      status: 'rejected',
      transactionHash: 'path-hash-1',
    });
    expect(repo.listUnresolved(NETWORK.id)).toHaveLength(0);
    expect(repo.get(NETWORK.id, 'path-hash-1')?.state).toBe('rejected');
  });

  it('rejects watch-only, multi-signer and an unreferenced local signer before authorization', async () => {
    const review = reviewed();
    const { deps, signerRepository, sdk, gateway } = fixture(review);
    signerRepository.listSignersForAccount.mockReturnValueOnce([]);
    await expect(submitReviewedPathPayment(deps, ACCOUNT, review, SIGNER)).resolves.toEqual({
      status: 'unsupported-signer',
    });
    signerRepository.listSignersForAccount.mockReturnValueOnce([SIGNER, { ...SIGNER, id: 'second' }]);
    await expect(submitReviewedPathPayment(deps, ACCOUNT, review, SIGNER)).resolves.toEqual({
      status: 'unsupported-signer',
    });
    signerRepository.listSignersForAccount.mockReturnValueOnce([{ ...SIGNER, id: 'different' }]);
    await expect(submitReviewedPathPayment(deps, ACCOUNT, review, SIGNER)).resolves.toEqual({
      status: 'unsupported-signer',
    });
    expect(signerRepository.listSignersForAccount).toHaveBeenCalledWith(ACCOUNT.id);
    expect(gateway.loadAccountAuthorization).not.toHaveBeenCalled();
    expect(sdk.hasSignerSystemAuth).not.toHaveBeenCalled();
  });

  it('uses existing medium-ledger-weight signer checks; insufficient weight never signs or broadcasts', async () => {
    const review = reviewed();
    const { deps, gateway, sdk } = fixture(review);
    gateway.loadAccountAuthorization.mockResolvedValueOnce({
      address: ACCOUNT.address,
      thresholds: { low: 1, medium: 2, high: 3 },
      signers: [{ kind: 'ed25519', publicKey: SIGNER.publicKey, weight: 1 }],
    });
    await expect(submitReviewedPathPayment(deps, ACCOUNT, review, SIGNER)).resolves.toMatchObject({
      status: 'authorization-blocked',
      reason: 'insufficient-weight',
    });
    expect(sdk.signWithSystemAuth).not.toHaveBeenCalled();
    expect(gateway.submitTransaction).not.toHaveBeenCalled();
  });

  it('rejects a wrong ledger authorization account identity before calling SDK signer', async () => {
    const review = reviewed();
    const { deps, gateway, sdk } = fixture(review);
    gateway.loadAccountAuthorization.mockResolvedValueOnce({
      address: 'GOTHER',
      thresholds: { low: 1, medium: 1, high: 2 },
      signers: [{ kind: 'ed25519', publicKey: SIGNER.publicKey, weight: 1 }],
    });
    await expect(submitReviewedPathPayment(deps, ACCOUNT, review, SIGNER)).rejects.toThrow(
      'path_payment_review_mismatch',
    );
    expect(sdk.hasSignerSystemAuth).not.toHaveBeenCalled();
  });
});
