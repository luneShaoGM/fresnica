import {mkdtempSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import Realm from 'realm';

import {setAccountHidden} from '../../../../capabilities/account/accountVisibility';
import {deleteLocalAccount} from '../../../../capabilities/account/deleteLocalAccount';
import type {AccountRecord} from '../../../../capabilities/account/types';
import {resolveOnboardingBootstrap} from '../../../../features/onboarding/onboardingBootstrap';
import {RealmAccountSignerRepository} from '../RealmAccountSignerRepository';
import {RealmPendingSubmissionRepository} from '../RealmPendingSubmissionRepository';
import {openWalletRealm} from '../openWalletRealm';

const createdAt = new Date('2026-09-11T00:00:00.000Z');
const updatedAt = new Date('2026-09-11T01:00:00.000Z');

function account(id: string): AccountRecord {
  return {
    id,
    address: `G${id}`,
    identityKind: 'classic',
    networkId: 'stellar-testnet',
    label: id,
    sortOrder: 0,
    hidden: false,
    createdAt,
    updatedAt: createdAt,
  };
}

afterAll(() => {
  Realm.shutdown();
});

describe('Realm account lifecycle', () => {
  it('persists hidden state across reopen and can restore the account', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'fresnica-account-visibility-'));
    const path = join(directory, 'wallet.realm');
    let activeRealm: Awaited<ReturnType<typeof openWalletRealm>> | undefined;

    try {
      activeRealm = await openWalletRealm({path});
      let repository = new RealmAccountSignerRepository(activeRealm);
      repository.createAccount(account('account-a'));
      repository.createAccount(account('account-b'));
      setAccountHidden({repository, now: () => updatedAt}, 'account-a', true);
      activeRealm.close();
      activeRealm = undefined;

      activeRealm = await openWalletRealm({path});
      repository = new RealmAccountSignerRepository(activeRealm);
      expect(repository.getAccount('account-a')).toEqual({
        ...account('account-a'),
        hidden: true,
        updatedAt,
      });

      setAccountHidden({repository, now: () => updatedAt}, 'account-a', false);
      expect(repository.getAccount('account-a')?.hidden).toBe(false);
    } finally {
      activeRealm?.close();
      rmSync(directory, {recursive: true, force: true});
    }
  });

  it('returns to onboarding through bootstrap after deleting the final account', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'fresnica-account-delete-'));
    const path = join(directory, 'wallet.realm');
    let activeRealm: Awaited<ReturnType<typeof openWalletRealm>> | undefined;

    try {
      activeRealm = await openWalletRealm({path});
      const repository = new RealmAccountSignerRepository(activeRealm);
      const pendingSubmissions = new RealmPendingSubmissionRepository(activeRealm);
      repository.createAccount(account('account-a'));

      deleteLocalAccount({repository, pendingSubmissions}, 'account-a');

      expect(
        resolveOnboardingBootstrap({
          repository,
          sdk: {} as never,
          createId: () => 'unused',
          now: () => updatedAt,
          networkId: 'stellar-testnet',
        }),
      ).toEqual({kind: 'onboarding'});
    } finally {
      activeRealm?.close();
      rmSync(directory, {recursive: true, force: true});
    }
  });
});
