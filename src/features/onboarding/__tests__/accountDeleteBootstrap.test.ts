import {deleteLocalAccount} from '../../../capabilities/account/deleteLocalAccount';
import type {AccountRecord} from '../../../capabilities/account/types';
import {InMemoryAccountSignerRepository} from '../../../platform/persistence/memory/InMemoryAccountSignerRepository';
import {InMemoryPendingSubmissionRepository} from '../../../platform/persistence/memory/InMemoryPendingSubmissionRepository';
import {resolveOnboardingBootstrap} from '../onboardingBootstrap';

const now = new Date('2026-09-11T01:00:00.000Z');

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

describe('account delete bootstrap', () => {
  it('uses the existing bootstrap to enter onboarding after the final account is deleted', () => {
    const repository = new InMemoryAccountSignerRepository();
    const pendingSubmissions = new InMemoryPendingSubmissionRepository();
    repository.createAccount(account());

    deleteLocalAccount({repository, pendingSubmissions}, 'account-a');

    expect(
      resolveOnboardingBootstrap({
        repository,
        sdk: {} as never,
        createId: () => 'unused',
        now: () => now,
      }),
    ).toEqual({kind: 'onboarding'});
  });
});
