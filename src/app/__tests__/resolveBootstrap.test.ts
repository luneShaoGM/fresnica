import { deleteLocalAccount } from '../../capabilities/account/deleteLocalAccount';
import type { AccountRecord } from '../../capabilities/account/types';
import { InMemoryAccountSignerRepository } from '../../platform/persistence/memory/InMemoryAccountSignerRepository';
import { InMemoryPendingSubmissionRepository } from '../../platform/persistence/memory/InMemoryPendingSubmissionRepository';
import { resolveAppBootstrap } from '../resolveBootstrap';

const now = new Date('2026-09-14T00:00:00.000Z');

function account(): AccountRecord {
  return {
    id: 'account-a',
    address: 'GACCOUNT',
    identityKind: 'classic',
    networkId: 'stellar-testnet',
    label: 'Wallet',
    sortOrder: 0,
    hidden: false,
    createdAt: now,
    updatedAt: now,
  };
}

function onboarding(repository: InMemoryAccountSignerRepository) {
  return {
    repository,
    sdk: {} as never,
    createId: () => 'unused',
    now: () => now,
    networkId: 'stellar-testnet',
  };
}

describe('resolveAppBootstrap account selection cleanup', () => {
  it('clears the network default after final account deletion enters onboarding', () => {
    const repository = new InMemoryAccountSignerRepository();
    const pendingSubmissions = new InMemoryPendingSubmissionRepository();
    const clearDefaultAccountId = jest.fn();
    repository.createAccount(account());

    deleteLocalAccount({ repository, pendingSubmissions }, 'account-a');

    expect(
      resolveAppBootstrap({
        onboarding: onboarding(repository),
        accountSelectionPreferences: { clearDefaultAccountId },
      }),
    ).toEqual({ kind: 'onboarding' });
    expect(clearDefaultAccountId).toHaveBeenCalledWith('stellar-testnet');
  });

  it('does not clear a default while the wallet remains ready', () => {
    const repository = new InMemoryAccountSignerRepository();
    const clearDefaultAccountId = jest.fn();
    repository.createAccount(account());

    expect(
      resolveAppBootstrap({
        onboarding: onboarding(repository),
        accountSelectionPreferences: { clearDefaultAccountId },
      }).kind,
    ).toBe('ready');
    expect(clearDefaultAccountId).not.toHaveBeenCalled();
  });

  it('still enters onboarding if clearing a stale default fails', () => {
    const repository = new InMemoryAccountSignerRepository();
    const error = new Error('write-failed');
    const onPreferenceFailure = jest.fn();

    expect(
      resolveAppBootstrap({
        onboarding: onboarding(repository),
        accountSelectionPreferences: {
          clearDefaultAccountId: () => {
            throw error;
          },
        },
        onPreferenceFailure,
      }),
    ).toEqual({ kind: 'onboarding' });
    expect(onPreferenceFailure).toHaveBeenCalledWith('stellar-testnet', error);
  });
});
