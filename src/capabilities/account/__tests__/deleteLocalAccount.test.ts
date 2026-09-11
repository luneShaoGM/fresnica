import {InMemoryAccountSignerRepository} from '../../../platform/persistence/memory/InMemoryAccountSignerRepository';
import {InMemoryPendingSubmissionRepository} from '../../../platform/persistence/memory/InMemoryPendingSubmissionRepository';
import type {SignerRecord} from '../../signer/types';
import type {PendingSubmissionRecord} from '../../transaction/pendingSubmission';
import {deleteLocalAccount} from '../deleteLocalAccount';
import type {AccountRecord} from '../types';

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

function pending(
  accountId: string,
  state: 'submitting' | 'uncertain',
): PendingSubmissionRecord {
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
  };
}

describe('deleteLocalAccount', () => {
  it.each(['submitting', 'uncertain'] as const)(
    'blocks deletion while a %s submission is unresolved',
    state => {
      const deps = dependencies();
      deps.repository.createAccount(account('account-a'));
      deps.pendingSubmissions.create(pending('account-a', state));

      expect(() => deleteLocalAccount(deps, 'account-a')).toThrow(
        'account-delete-blocked-by-pending-submission',
      );
      expect(deps.repository.getAccount('account-a')).toBeDefined();
    },
  );

  it('allows deletion after the pending submission is resolved', () => {
    const deps = dependencies();
    deps.repository.createAccount(account('account-a'));
    const record = pending('account-a', 'uncertain');
    deps.pendingSubmissions.create(record);
    deps.pendingSubmissions.markConfirmed(
      record.networkId,
      record.transactionHash,
      now,
      123,
    );

    deleteLocalAccount(deps, 'account-a');

    expect(deps.repository.getAccount('account-a')).toBeUndefined();
  });

  it('refuses to delete the last visible account while hidden accounts remain', () => {
    const deps = dependencies();
    deps.repository.createAccount(account('account-a'));
    deps.repository.createAccount(account('account-b', true));

    expect(() => deleteLocalAccount(deps, 'account-a')).toThrow(
      'account-delete-requires-visible-account',
    );
    expect(deps.repository.getAccount('account-a')).toBeDefined();
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

  it('allows deleting the final total account', () => {
    const deps = dependencies();
    deps.repository.createAccount(account('account-a'));

    deleteLocalAccount(deps, 'account-a');

    expect(deps.repository.listAccounts()).toEqual([]);
  });

  it('fails closed for a missing account', () => {
    const deps = dependencies();
    expect(() => deleteLocalAccount(deps, 'missing')).toThrow('account-not-found');
  });
});
