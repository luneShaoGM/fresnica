import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Realm from 'realm';
import { createNetworkAccountRepository } from '../../../../../capabilities/account/createNetworkAccountRepository';
import { deleteLocalAccount } from '../../../../../capabilities/account/deleteLocalAccount';
import { createWalletSelectionPreferences } from '../../../../../app/createWalletSelectionPreferences';
import type { AccountRecord } from '../../../../../capabilities/account/types';
import { openWalletRealm } from '../../openWalletRealm';
import { RealmAccountSignerRepository } from '../../RealmAccountSignerRepository';
import { RealmDefaultAccountPreferenceStore } from '../../RealmDefaultAccountPreferenceStore';
import { RealmBalanceCacheRepository } from '../../RealmBalanceCacheRepository';
import { RealmHistoryCacheRepository } from '../../RealmHistoryCacheRepository';
import { RealmPendingSubmissionRepository } from '../../RealmPendingSubmissionRepository';

const main = 'stellar-mainnet';
const test = 'stellar-testnet';
const now = new Date('2026-10-29T00:00:00Z');
const account: AccountRecord = {
  id: 'wallet',
  address: 'GADDRESS',
  identityKind: 'classic',
  networkId: main,
  label: 'Original',
  sortOrder: 0,
  hidden: false,
  createdAt: now,
  updatedAt: now,
};
afterAll(() => Realm.shutdown());
describe('persisted identity and per-network runtime contexts', () => {
  it('reopens existing records, metadata, selection, signer references and separate caches without migrating identity', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'fresnica-network-context-'));
    const path = join(directory, 'wallet.realm');
    let realm: Awaited<ReturnType<typeof openWalletRealm>> | undefined;
    try {
      realm = await openWalletRealm({ path });
      let records = new RealmAccountSignerRepository(realm);
      records.createAccountWithSigner({
        account,
        signer: {
          id: 'signer',
          publicKey: account.address,
          kind: 'protected-software',
          envelopeJson: '{opaque-fixture}',
          createdAt: now,
          updatedAt: now,
        },
        attachedAt: now,
      });
      records.createAccount({ ...account, id: 'legacy', networkId: test, label: 'Legacy', hidden: true });
      let view = createNetworkAccountRepository(records, test);
      view.attachSigner('legacy', 'signer', now);
      view.setAccountLabel(account.id, 'Renamed', now);
      createWalletSelectionPreferences(new RealmDefaultAccountPreferenceStore(realm), view).setDefaultAccountId(
        test,
        account.id,
      );
      const cache = new RealmBalanceCacheRepository(realm);
      for (const networkId of [main, test])
        cache.replaceSnapshot(
          { networkId, accountAddress: account.address },
          {
            schemaVersion: 1,
            lastSuccessfulUpdateAt: now,
            balance:
              networkId === test
                ? { status: 'inactive', address: account.address }
                : {
                    status: 'active',
                    address: account.address,
                    balances: [{ asset: { kind: 'native', code: 'XLM' }, balance: '23' }],
                    hiddenLiquidityPoolShareCount: 0,
                  },
          },
        );
      realm.close();
      realm = await openWalletRealm({ path });
      records = new RealmAccountSignerRepository(realm);
      view = createNetworkAccountRepository(records, test);
      expect(records.getAccount(account.id)).toEqual({ ...account, label: 'Renamed' });
      expect(records.getAccount('legacy')).toMatchObject({ networkId: test, label: 'Legacy', hidden: true });
      expect(view.getAccount(account.id)).toMatchObject({ id: account.id, networkId: test, label: 'Renamed' });
      expect(records.listAccounts()).toHaveLength(2);
      expect(records.listSigners()).toHaveLength(1);
      expect(view.listSignersForAccount('legacy')[0].id).toBe('signer');
      const mainView = createNetworkAccountRepository(records, main);
      expect(
        createWalletSelectionPreferences(new RealmDefaultAccountPreferenceStore(realm), mainView).getDefaultAccountId(
          main,
        ),
      ).toBe(account.id);
      expect(
        new RealmBalanceCacheRepository(realm).getSnapshot({ networkId: main, accountAddress: account.address })
          ?.balance.status,
      ).toBe('active');
      expect(
        new RealmBalanceCacheRepository(realm).getSnapshot({ networkId: test, accountAddress: account.address })
          ?.balance.status,
      ).toBe('inactive');
      view.deleteAccount('legacy');
      expect(records.getSigner('signer')).toBeDefined();
    } finally {
      realm?.close();
      rmSync(directory, { recursive: true, force: true });
    }
  });
  it('blocks removal for another network pending hash, then removes both caches without destroying a shared signer', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'fresnica-network-delete-'));
    let realm: Awaited<ReturnType<typeof openWalletRealm>> | undefined;
    try {
      realm = await openWalletRealm({ path: join(directory, 'wallet.realm') });
      const records = new RealmAccountSignerRepository(realm);
      records.createAccountWithSigner({
        account,
        signer: { id: 'shared', publicKey: account.address, kind: 'external', createdAt: now, updatedAt: now },
        attachedAt: now,
      });
      records.createAccount({ ...account, id: 'other', address: 'GOTHER' });
      records.attachSigner('other', 'shared', now);
      const view = createNetworkAccountRepository(records, test);
      const pendingSubmissions = new RealmPendingSubmissionRepository(realm);
      pendingSubmissions.create({
        id: `${main}:original-hash`,
        networkId: main,
        accountId: account.id,
        sourceAddress: account.address,
        transactionHash: 'original-hash',
        intentKind: 'payment',
        intentKey: 'intent',
        state: 'uncertain',
        createdAt: now,
        updatedAt: now,
      });
      const balanceCache = new RealmBalanceCacheRepository(realm);
      for (const networkId of [main, test])
        balanceCache.replaceSnapshot(
          { networkId, accountAddress: account.address },
          { schemaVersion: 1, lastSuccessfulUpdateAt: now, balance: { status: 'inactive', address: account.address } },
        );
      const deps = {
        repository: view,
        pendingSubmissions,
        balanceCache,
        historyCache: new RealmHistoryCacheRepository(realm),
        cacheNetworkIds: [main, test],
      };
      expect(() => deleteLocalAccount(deps, account.id)).toThrow('account-delete-blocked-by-pending-submission');
      expect(pendingSubmissions.get(main, 'original-hash')?.state).toBe('uncertain');
      pendingSubmissions.markConfirmed(main, 'original-hash', now);
      deleteLocalAccount(deps, account.id);
      expect(records.getAccount(account.id)).toBeUndefined();
      expect(records.getSigner('shared')).toBeDefined();
      for (const networkId of [main, test])
        expect(balanceCache.getSnapshot({ networkId, accountAddress: account.address })).toBeUndefined();
    } finally {
      realm?.close();
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
