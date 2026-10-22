import type { AccountRecord } from '../../../capabilities/account/types';
import type { SignerRecord } from '../../../capabilities/signer/types';
import type { PreparedPathPaymentReview } from '../../../capabilities/path-payment/types';
import { submitReviewedPathPayment } from '../../../capabilities/path-payment/submitReviewedPathPayment';
import type { PendingSubmissionRecord } from '../../../capabilities/transaction/pendingSubmission';
import { InMemoryPendingSubmissionRepository } from '../../../platform/persistence/memory/InMemoryPendingSubmissionRepository';
import { listSwapHistory, listSwapPending, reconcileSwapPending, submitSwapReview } from '../swapSubmissionProductFlow';

jest.mock('../../../capabilities/path-payment/submitReviewedPathPayment');

const NETWORK = Object.freeze({ id: 'stellar-testnet', networkPassphrase: 'Test SDF Network ; September 2015' });
const ACCOUNT: AccountRecord = Object.freeze({
  id: 'wallet-a',
  address: 'GSOURCE',
  networkId: NETWORK.id,
  identityKind: 'classic',
  label: 'Main',
  hidden: false,
  sortOrder: 0,
  createdAt: new Date(0),
  updatedAt: new Date(0),
});
const SIGNER: SignerRecord = Object.freeze({
  id: 'signer-a',
  publicKey: 'GSIGNER',
  kind: 'protected-software' as const,
  envelopeJson: '{"protected":true}',
  createdAt: new Date(0),
  updatedAt: new Date(0),
});
const REVIEW = Object.freeze({
  transactionXdrBase64: 'unsigned-reviewed-xdr',
  networkId: NETWORK.id,
  source: ACCOUNT.address,
  destination: ACCOUNT.address,
  expiresAtUnixSeconds: 1782001000,
  fee: '100',
}) as PreparedPathPaymentReview;

function pending(overrides: Partial<PendingSubmissionRecord> = {}): PendingSubmissionRecord {
  return {
    id: 'stellar-testnet:hash-1',
    networkId: NETWORK.id,
    accountId: ACCOUNT.id,
    sourceAddress: ACCOUNT.address,
    transactionHash: 'hash-1',
    intentKind: 'path-payment',
    intentKey: 'intent:1',
    state: 'uncertain',
    createdAt: new Date(0),
    updatedAt: new Date(0),
    ...overrides,
  };
}

function fixture() {
  const repository = new InMemoryPendingSubmissionRepository();
  const listSignersForAccount = jest.fn(() => [SIGNER]);
  const reconcile = jest.fn(async (_reason: 'manual-refresh'): Promise<unknown> => [
    { transactionHash: 'hash-1', status: 'still-unknown' },
  ]);
  const deps = {
    network: NETWORK,
    gateway: { network: NETWORK },
    inspector: { network: NETWORK },
    sdk: {},
    signerRepository: { listSignersForAccount },
    recovery: { repository, readInvalidation: { invalidate: jest.fn() }, now: () => new Date() },
    transactionRecovery: { reconcile },
  };
  return { deps, repository, reconcile, listSignersForAccount };
}

describe('Swap-D2c product submission / persisted pending and reconciliation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (submitReviewedPathPayment as jest.Mock).mockResolvedValue({
      status: 'submitted',
      hash: 'hash-1',
      authorization: 'system-auth',
    });
  });

  it('passes the SAME approved unsigned review and captured live guard to existing D1 submit', async () => {
    const { deps, listSignersForAccount } = fixture();
    const guard = jest.fn(() => true);
    await expect(submitSwapReview(deps as never, ACCOUNT, REVIEW, guard)).resolves.toMatchObject({
      status: 'submitted',
      hash: 'hash-1',
    });
    expect(listSignersForAccount).toHaveBeenCalledWith(ACCOUNT.id);
    expect(submitReviewedPathPayment).toHaveBeenCalledWith(
      expect.objectContaining({ isCurrentSession: guard, network: NETWORK }),
      ACCOUNT,
      REVIEW,
      SIGNER,
      undefined,
    );
  });

  it('uses the same exact XDR and signer for explicit passphrase fallback without re-quoting', async () => {
    const { deps } = fixture();
    (submitReviewedPathPayment as jest.Mock)
      .mockResolvedValueOnce({ status: 'passphrase-required' })
      .mockResolvedValueOnce({ status: 'submitted', hash: 'hash-1', authorization: 'passphrase' });
    const guard = () => true;
    await expect(submitSwapReview(deps as never, ACCOUNT, REVIEW, guard)).resolves.toEqual({
      status: 'passphrase-required',
    });
    await expect(submitSwapReview(deps as never, ACCOUNT, REVIEW, guard, 'user-password')).resolves.toMatchObject({
      authorization: 'passphrase',
    });
    expect(submitReviewedPathPayment).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ isCurrentSession: guard }),
      ACCOUNT,
      REVIEW,
      SIGNER,
      undefined,
    );
    expect(submitReviewedPathPayment).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ isCurrentSession: guard }),
      ACCOUNT,
      REVIEW,
      SIGNER,
      'user-password',
    );
  });

  it.each([
    ['stale focused session', ACCOUNT, () => false],
    ['watch-only account', { ...ACCOUNT, hidden: true }, () => true],
    ['mainnet-selected account', { ...ACCOUNT, networkId: 'stellar-mainnet' }, () => true],
    ['contract account', { ...ACCOUNT, identityKind: 'contract' as const }, () => true],
  ])('fails closed for %s before resolving signer', async (_name, account, guard) => {
    const { deps, listSignersForAccount } = fixture();
    await expect(submitSwapReview(deps as never, account, REVIEW, guard)).rejects.toThrow('swap-session-stale');
    expect(listSignersForAccount).not.toHaveBeenCalled();
    expect(submitReviewedPathPayment).not.toHaveBeenCalled();
  });

  it('cannot guess a signer for watch-only or shared/multiple signer accounts', async () => {
    const { deps, listSignersForAccount } = fixture();
    listSignersForAccount.mockReturnValueOnce([]);
    await expect(submitSwapReview(deps as never, ACCOUNT, REVIEW, () => true)).resolves.toEqual({
      status: 'unsupported-signer',
    });
    listSignersForAccount.mockReturnValueOnce([SIGNER, { ...SIGNER, id: 'second' }]);
    await expect(submitSwapReview(deps as never, ACCOUNT, REVIEW, () => true)).resolves.toEqual({
      status: 'unsupported-signer',
    });
    expect(submitReviewedPathPayment).not.toHaveBeenCalled();
  });

  it('does not auto-retry after an uncertain broadcast; the original unresolved hash blocks the next authorization', async () => {
    const { deps, repository } = fixture();
    (submitReviewedPathPayment as jest.Mock).mockImplementationOnce(async () => {
      repository.create(pending());
      return { status: 'uncertain', transactionHash: 'hash-1' };
    });
    await expect(submitSwapReview(deps as never, ACCOUNT, REVIEW, () => true)).resolves.toMatchObject({
      status: 'uncertain',
      transactionHash: 'hash-1',
    });
    await expect(submitSwapReview(deps as never, ACCOUNT, REVIEW, () => true)).rejects.toThrow(
      'swap-unresolved-pending',
    );
    expect(submitReviewedPathPayment).toHaveBeenCalledTimes(1);
  });

  it('propagates user-cancelled System Auth without signing fallback or automatic retry', async () => {
    const { deps, repository } = fixture();
    (submitReviewedPathPayment as jest.Mock).mockRejectedValueOnce(new Error('user-cancel'));
    await expect(submitSwapReview(deps as never, ACCOUNT, REVIEW, () => true)).rejects.toThrow('user-cancel');
    expect(repository.listUnresolved(NETWORK.id)).toEqual([]);
    expect(submitReviewedPathPayment).toHaveBeenCalledTimes(1);
  });

  it('shows pending records persisted for this network/account/Path Payment only after restart', () => {
    const { deps, repository } = fixture();
    repository.create(pending());
    repository.create(
      pending({
        id: 'stellar-testnet:other-wallet',
        transactionHash: 'other-wallet',
        intentKey: 'intent:other-wallet',
        accountId: 'wallet-b',
      }),
    );
    repository.create(
      pending({
        id: 'stellar-testnet:other-kind',
        transactionHash: 'other-kind',
        intentKey: 'intent:other-kind',
        intentKind: 'payment',
      }),
    );
    repository.create(
      pending({
        id: 'stellar-testnet:other-source',
        transactionHash: 'other-source',
        intentKey: 'intent:other-source',
        sourceAddress: 'GOTHER',
      }),
    );
    repository.create(
      pending({
        id: 'stellar-mainnet:other-network',
        networkId: 'stellar-mainnet',
        transactionHash: 'other-network',
        intentKey: 'intent:other-network',
      }),
    );
    const restartedDeps = { ...deps, recovery: { ...deps.recovery, repository } };
    expect(listSwapPending(restartedDeps as never, ACCOUNT, () => true).map(record => record.transactionHash)).toEqual([
      'hash-1',
    ]);
  });

  it('restores confirmed/rejected Swap results from persistent account-scoped records after restart', () => {
    const { deps, repository } = fixture();
    repository.create(pending());
    repository.markConfirmed(NETWORK.id, 'hash-1', new Date('2026-10-22T00:00:00Z'), 73);
    repository.create(
      pending({
        id: 'stellar-testnet:rejected-hash',
        transactionHash: 'rejected-hash',
        intentKey: 'intent:rejected',
        updatedAt: new Date('2026-10-22T01:00:00Z'),
      }),
    );
    repository.markRejected(NETWORK.id, 'rejected-hash', new Date('2026-10-22T01:01:00Z'), 'tx_bad_seq');
    repository.create(
      pending({
        id: 'stellar-testnet:other-account',
        transactionHash: 'other-account',
        accountId: 'another-wallet',
        intentKey: 'intent:other',
      }),
    );
    repository.create(
      pending({
        id: 'stellar-testnet:other-intent',
        transactionHash: 'other-intent',
        intentKind: 'payment',
        intentKey: 'intent:other-payment',
      }),
    );
    const restartedDeps = { ...deps, recovery: { ...deps.recovery, repository } };
    expect(listSwapPending(restartedDeps as never, ACCOUNT, () => true)).toEqual([]);
    expect(listSwapHistory(restartedDeps as never, ACCOUNT, () => true)).toEqual([
      expect.objectContaining({ transactionHash: 'rejected-hash', state: 'rejected', resultCode: 'tx_bad_seq' }),
      expect.objectContaining({ transactionHash: 'hash-1', state: 'confirmed', ledger: 73 }),
    ]);
  });

  it('never authorizes another swap while current account has any unresolved swap submission', async () => {
    const { deps, repository } = fixture();
    repository.create(pending());
    await expect(submitSwapReview(deps as never, ACCOUNT, REVIEW, () => true)).rejects.toThrow(
      'swap-unresolved-pending',
    );
    expect(submitReviewedPathPayment).not.toHaveBeenCalled();
  });

  it('uses existing manual reconciliation only, never rebroadcasts and reports terminal ledger results', async () => {
    const { deps, repository, reconcile } = fixture();
    repository.create(pending());
    reconcile.mockImplementationOnce(async () => {
      repository.markConfirmed(NETWORK.id, 'hash-1', new Date(), 73);
      return [{ transactionHash: 'hash-1', status: 'confirmed' as const }];
    });
    const result = await reconcileSwapPending(deps as never, ACCOUNT, () => true);
    expect(reconcile).toHaveBeenCalledWith('manual-refresh');
    expect(result).toEqual({
      pending: [],
      checked: [
        expect.objectContaining({
          transactionHash: 'hash-1',
          state: 'confirmed',
          ledger: 73,
        }),
      ],
    });
    expect(submitReviewedPathPayment).not.toHaveBeenCalled();
  });

  it('retains unknown result as unresolved after manual refresh, supports later restart', async () => {
    const { deps, repository } = fixture();
    repository.create(pending());
    const result = await reconcileSwapPending(deps as never, ACCOUNT, () => true);
    expect(result.pending).toHaveLength(1);
    expect(result.checked[0]).toMatchObject({ transactionHash: 'hash-1', state: 'uncertain' });
    expect(listSwapPending(deps as never, ACCOUNT, () => true)).toHaveLength(1);
  });

  it('rejects late selection loss after await without exposing another account record', async () => {
    const { deps, repository, reconcile } = fixture();
    repository.create(pending());
    let current = true;
    reconcile.mockImplementationOnce(async () => {
      current = false;
      return [{ transactionHash: 'hash-1', status: 'check-failed' as const }];
    });
    await expect(reconcileSwapPending(deps as never, ACCOUNT, () => current)).rejects.toThrow('swap-session-stale');
  });
});
