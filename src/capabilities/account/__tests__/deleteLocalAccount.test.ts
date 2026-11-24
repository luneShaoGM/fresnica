import { InMemoryAccountSignerRepository } from '../../../platform/persistence/memory/InMemoryAccountSignerRepository';
import { InMemoryHistoryCacheRepository } from '../../../platform/persistence/memory/InMemoryHistoryCacheRepository';
import { InMemoryBalanceCacheRepository } from '../../../platform/persistence/memory/InMemoryBalanceCacheRepository';
import { InMemoryPendingSubmissionRepository } from '../../../platform/persistence/memory/InMemoryPendingSubmissionRepository';
import { HISTORY_CACHE_SCHEMA_VERSION } from '../../history/HistoryCacheRepository';
import type { SignerRecord } from '../../signer/types';
import type { PendingSubmissionRecord } from '../../transaction/pendingSubmission';
import { deleteLocalAccount } from '../deleteLocalAccount';
import type { AccountRecord } from '../types';

const now = new Date('2026-09-11T01:00:00.000Z');

function account(id: string, hidden = false): AccountRecord {
  return {
    id,
    address: `G${id}`,
    identityKind: 'classic',
    networkId: 'stellar-testnet',
    label: id,
    sortOrder: 0,
    hidden,
    createdAt: now,
    updatedAt: now,
  };
}

function signer(id: string): SignerRecord {
  return {
    id,
    publicKey: `G${id}`,
    kind: 'protected-software',
    envelopeJson: '{opaque-envelope}',
    envelopeRevision: 'rev-1',
    recoveryKind: 'secret',
    backupState: 'not-required',
    createdAt: now,
    updatedAt: now,
  };
}

function pending(accountId: string, state: 'submitting' | 'uncertain'): PendingSubmissionRecord {
  const hash = `${accountId}-${state}`;
  return {
    id: `stellar-testnet:${hash}`,
    networkId: 'stellar-testnet',
    accountId,
    sourceAddress: `G${accountId}`,
    transactionHash: hash,
    intentKind: 'payment',
    intentKey: JSON.stringify(['payment', accountId, state]),
    state,
    createdAt: now,
    updatedAt: now,
  };
}

function dependencies() {
  return {
    repository: new InMemoryAccountSignerRepository(),
    pendingSubmissions: new InMemoryPendingSubmissionRepository(),
    historyCache: new InMemoryHistoryCacheRepository(),
    balanceCache: new InMemoryBalanceCacheRepository(),
    claimableCache: { clearPartition: jest.fn() },
    dappPermissions: { revokeAccount: jest.fn() },
    onDeleted: jest.fn(),
  };
}

describe('deleteLocalAccount', () => {
  it.each(['submitting', 'uncertain'] as const)('blocks deletion while a %s submission is unresolved', state => {
    const deps = dependencies();
    const balanceClear = jest.spyOn(deps.balanceCache, 'clearPartition');
    const historyClear = jest.spyOn(deps.historyCache, 'clearPartition');
    deps.repository.createAccount(account('account-a'));
    deps.pendingSubmissions.create(pending('account-a', state));

    expect(() => deleteLocalAccount(deps, 'account-a')).toThrow('account-delete-blocked-by-pending-submission');
    expect(deps.repository.getAccount('account-a')).toBeDefined();
    expect(balanceClear).not.toHaveBeenCalled();
    expect(historyClear).not.toHaveBeenCalled();
    expect(deps.claimableCache.clearPartition).not.toHaveBeenCalled();
    expect(deps.dappPermissions.revokeAccount).not.toHaveBeenCalled();
    expect(deps.onDeleted).not.toHaveBeenCalled();
  });

  it('allows deletion after the pending submission is resolved', () => {
    const deps = dependencies();
    deps.repository.createAccount(account('account-a'));
    const record = pending('account-a', 'uncertain');
    deps.pendingSubmissions.create(record);
    deps.pendingSubmissions.markConfirmed(record.networkId, record.transactionHash, now, 123);

    deleteLocalAccount(deps, 'account-a');

    expect(deps.repository.getAccount('account-a')).toBeUndefined();
  });

  it('refuses to delete the last visible account while hidden accounts remain', () => {
    const deps = dependencies();
    deps.repository.createAccount(account('account-a'));
    deps.repository.createAccount(account('account-b', true));

    expect(() => deleteLocalAccount(deps, 'account-a')).toThrow('account-delete-requires-visible-account');
    expect(deps.repository.getAccount('account-a')).toBeDefined();
    expect(deps.claimableCache.clearPartition).not.toHaveBeenCalled();
    expect(deps.dappPermissions.revokeAccount).not.toHaveBeenCalled();
  });

  it('preserves a shared signer until the final account reference is deleted', () => {
    const deps = dependencies();
    deps.repository.createAccount(account('account-a'));
    deps.repository.createAccount(account('account-b'));
    deps.repository.createSigner(signer('shared'));
    deps.repository.attachSigner('account-a', 'shared', now);
    deps.repository.attachSigner('account-b', 'shared', now);

    deleteLocalAccount(deps, 'account-a');
    expect(deps.repository.getSigner('shared')).toBeDefined();

    deleteLocalAccount(deps, 'account-b');
    expect(deps.repository.getSigner('shared')).toBeUndefined();
  });

  it('clears the matching History cache partition before deleting a classic account', () => {
    const deps = dependencies();
    const record = account('account-a');
    deps.repository.createAccount(record);
    deps.historyCache.replaceSnapshot(
      { networkId: record.networkId, accountAddress: record.address },
      {
        schemaVersion: HISTORY_CACHE_SCHEMA_VERSION,
        lastSuccessfulHorizonUpdateAt: now,
        entries: [
          {
            id: 'history-1',
            pagingToken: 'history-1',
            operationType: 'future_operation',
            occurredAt: '2026-09-20T08:00:00Z',
            transactionHash: 'tx-history-1',
            sourceAccount: record.address,
            kind: 'unsupported',
            reason: 'operation-type',
          },
        ],
        details: [],
      },
    );

    deleteLocalAccount(deps, record.id);

    expect(
      deps.historyCache.getSnapshot({
        networkId: record.networkId,
        accountAddress: record.address,
      }),
    ).toBeUndefined();
    expect(deps.repository.getAccount(record.id)).toBeUndefined();
  });

  it.each(['balance', 'history', 'claimable', 'permissions'] as const)(
    'keeps the account and signer when %s cleanup fails, then allows an explicit retry',
    step => {
      const deps = dependencies();
      const record = account('account-a');
      const protectedSigner = signer('account-signer');
      deps.repository.createAccountWithSigner({ account: record, signer: protectedSigner, attachedAt: now });
      const cleanup = {
        balance: jest.spyOn(deps.balanceCache, 'clearPartition'),
        history: jest.spyOn(deps.historyCache, 'clearPartition'),
        claimable: deps.claimableCache.clearPartition,
        permissions: deps.dappPermissions.revokeAccount,
      };
      cleanup[step].mockImplementationOnce(() => {
        throw new Error(`${step}-cleanup-failed`);
      });

      expect(() => deleteLocalAccount(deps, record.id)).toThrow(`${step}-cleanup-failed`);
      expect(deps.repository.getAccount(record.id)).toEqual(record);
      expect(deps.repository.listSignersForAccount(record.id)).toEqual([protectedSigner]);
      expect(deps.onDeleted).not.toHaveBeenCalled();

      deleteLocalAccount(deps, record.id);
      expect(deps.repository.getAccount(record.id)).toBeUndefined();
      expect(deps.repository.getSigner(protectedSigner.id)).toBeUndefined();
      expect(deps.onDeleted).toHaveBeenCalledTimes(1);
    },
  );

  it('clears every configured network once and revokes grants before deleting the account', () => {
    const deps = dependencies();
    const record = account('account-a');
    deps.repository.createAccount(record);
    const balanceClear = jest.spyOn(deps.balanceCache, 'clearPartition');
    const historyClear = jest.spyOn(deps.historyCache, 'clearPartition');
    const remove = jest.spyOn(deps.repository, 'deleteAccount');
    deleteLocalAccount({ ...deps, cacheNetworkIds: ['stellar-mainnet', 'stellar-testnet', 'stellar-mainnet'] }, record.id);
    expect(balanceClear.mock.calls).toEqual([
      [{ networkId: 'stellar-mainnet', accountAddress: record.address }],
      [{ networkId: 'stellar-testnet', accountAddress: record.address }],
    ]);
    expect(historyClear.mock.calls).toEqual(balanceClear.mock.calls);
    expect(deps.claimableCache.clearPartition.mock.calls).toEqual([
      ['stellar-mainnet', record.address],
      ['stellar-testnet', record.address],
    ]);
    expect(deps.dappPermissions.revokeAccount).toHaveBeenCalledWith(record.id);
    expect(deps.claimableCache.clearPartition.mock.invocationCallOrder[1]).toBeLessThan(
      deps.dappPermissions.revokeAccount.mock.invocationCallOrder[0],
    );
    expect(deps.dappPermissions.revokeAccount.mock.invocationCallOrder[0]).toBeLessThan(
      remove.mock.invocationCallOrder[0],
    );
    expect(remove.mock.invocationCallOrder[0]).toBeLessThan(deps.onDeleted.mock.invocationCallOrder[0]);
  });

  it('preserves shared address caches and signer for a hidden legacy account, but revokes only the deleted account ID', () => {
    const deps = dependencies();
    const original = account('account-a');
    const legacy = { ...account('account-b', true), address: original.address, networkId: 'stellar-mainnet' };
    deps.repository.createAccount(original);
    deps.repository.createAccount(legacy);
    deps.repository.createAccount(account('visible-other'));
    deps.repository.createSigner(signer('shared'));
    deps.repository.attachSigner(original.id, 'shared', now);
    deps.repository.attachSigner(legacy.id, 'shared', now);
    const balanceClear = jest.spyOn(deps.balanceCache, 'clearPartition');
    const historyClear = jest.spyOn(deps.historyCache, 'clearPartition');
    const deletion = { ...deps, cacheNetworkIds: ['stellar-testnet', 'stellar-mainnet'] };

    deleteLocalAccount(deletion, original.id);
    expect(balanceClear).not.toHaveBeenCalled();
    expect(historyClear).not.toHaveBeenCalled();
    expect(deps.claimableCache.clearPartition).not.toHaveBeenCalled();
    expect(deps.dappPermissions.revokeAccount.mock.calls).toEqual([[original.id]]);
    expect(deps.repository.getAccount(legacy.id)).toEqual(legacy);
    expect(deps.repository.listSignersForAccount(legacy.id)).toEqual([signer('shared')]);

    deleteLocalAccount(deletion, legacy.id);
    expect(balanceClear).toHaveBeenCalledTimes(2);
    expect(historyClear).toHaveBeenCalledTimes(2);
    expect(deps.claimableCache.clearPartition).toHaveBeenCalledTimes(2);
    expect(deps.dappPermissions.revokeAccount.mock.calls).toEqual([[original.id], [legacy.id]]);
    expect(deps.repository.getSigner('shared')).toBeUndefined();
    expect(deps.repository.getAccount('visible-other')).toBeDefined();
  });

  it('allows deleting the final total account', () => {
    const deps = dependencies();
    deps.repository.createAccount(account('account-a'));

    deleteLocalAccount(deps, 'account-a');

    expect(deps.repository.listAccounts()).toEqual([]);
  });

  it('fails closed for a missing account', () => {
    const deps = dependencies();
    expect(() => deleteLocalAccount(deps, 'missing')).toThrow('account-not-found');
    expect(deps.claimableCache.clearPartition).not.toHaveBeenCalled();
    expect(deps.dappPermissions.revokeAccount).not.toHaveBeenCalled();
  });
});
