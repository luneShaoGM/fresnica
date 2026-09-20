import {mkdtempSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import Realm from 'realm';

import {moveAccount, orderAccounts} from '../../../../capabilities/account/accountOrder';
import {setAccountHidden} from '../../../../capabilities/account/accountVisibility';
import {deleteLocalAccount} from '../../../../capabilities/account/deleteLocalAccount';
import type {AccountRecord} from '../../../../capabilities/account/types';
import {historySnapshot, payment} from '../../__tests__/historyCacheRepositoryContract';
import {RealmAccountSignerRepository} from '../RealmAccountSignerRepository';
import {RealmHistoryCacheRepository} from '../RealmHistoryCacheRepository';
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

  it('persists stable account order across Realm reopen', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'fresnica-account-order-'));
    const path = join(directory, 'wallet.realm');
    let activeRealm: Awaited<ReturnType<typeof openWalletRealm>> | undefined;

    try {
      activeRealm = await openWalletRealm({path});
      let repository = new RealmAccountSignerRepository(activeRealm);
      repository.createAccount({...account('account-a'), sortOrder: 0});
      repository.createAccount({...account('account-b'), sortOrder: 1});
      repository.createAccount({...account('account-c'), sortOrder: 2});

      moveAccount({repository, now: () => updatedAt}, 'account-c', 'up');
      activeRealm.close();
      activeRealm = undefined;

      activeRealm = await openWalletRealm({path});
      repository = new RealmAccountSignerRepository(activeRealm);
      const reopened = orderAccounts(repository.listAccounts());
      expect(reopened.map(candidate => candidate.id)).toEqual(['account-a', 'account-c', 'account-b']);
      expect(reopened.map(candidate => candidate.sortOrder)).toEqual([0, 1, 2]);
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
      const historyCache = new RealmHistoryCacheRepository(activeRealm);
      const deletedAccount = account('account-a');
      repository.createAccount(deletedAccount);
      historyCache.replaceSnapshot(
        {networkId: deletedAccount.networkId, accountAddress: deletedAccount.address},
        historySnapshot([payment('history-before-delete')]),
      );

      deleteLocalAccount({repository, pendingSubmissions, historyCache}, deletedAccount.id);

      expect(repository.listAccounts()).toEqual([]);
      expect(
        historyCache.getSnapshot({
          networkId: deletedAccount.networkId,
          accountAddress: deletedAccount.address,
        }),
      ).toBeUndefined();
    } finally {
      activeRealm?.close();
      rmSync(directory, {recursive: true, force: true});
    }
  });
});
