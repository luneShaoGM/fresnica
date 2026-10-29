import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Realm from 'realm';
import {
  balancePartition,
  balanceSnapshot,
  runBalanceCacheRepositoryContract,
} from '../../__tests__/balanceCacheRepositoryContract';
import { historySnapshot, payment } from '../../__tests__/historyCacheRepositoryContract';
import { RealmBalanceCacheRepository } from '../RealmBalanceCacheRepository';
import { RealmHistoryCacheRepository } from '../RealmHistoryCacheRepository';
import { RealmAccountSignerRepository } from '../RealmAccountSignerRepository';
import { RealmPendingSubmissionRepository } from '../RealmPendingSubmissionRepository';
import { RealmDefaultAccountPreferenceStore } from '../RealmDefaultAccountPreferenceStore';
import { RealmLocalePreferenceStore } from '../RealmLocalePreferenceStore';
import { openWalletRealm } from '../openWalletRealm';
import { BALANCE_CACHE_SNAPSHOT_ENTITY, DAPP_CATALOG_CACHE_ENTITY, WALLET_REALM_SCHEMAS } from '../schemas';
import { deleteLocalAccount } from '../../../../capabilities/account/deleteLocalAccount';

describe('Realm Balance cache', () => {
  let directory: string;
  let realm: Realm;
  beforeEach(async () => {
    directory = mkdtempSync(join(tmpdir(), 'fresnica-balance-cache-'));
    realm = await openWalletRealm({ path: join(directory, 'wallet.realm') });
  });
  afterEach(() => {
    if (!realm.isClosed) realm.close();
    rmSync(directory, { recursive: true, force: true });
  });
  afterAll(() => Realm.shutdown());
  runBalanceCacheRepositoryContract(() => new RealmBalanceCacheRepository(realm));

  it('survives close/reopen and atomically preserves the previous cache when a replacement fails', async () => {
    const repository = new RealmBalanceCacheRepository(realm);
    repository.replaceSnapshot(balancePartition, balanceSnapshot());
    const fail = jest.spyOn(realm, 'create').mockImplementationOnce(() => {
      throw new Error('write-failed');
    });
    expect(() =>
      repository.replaceSnapshot(balancePartition, {
        ...balanceSnapshot(),
        balance: { status: 'inactive', address: 'GA' },
      }),
    ).toThrow('write-failed');
    fail.mockRestore();
    const path = realm.path;
    realm.close();
    realm = await openWalletRealm({ path });
    expect(new RealmBalanceCacheRepository(realm).getSnapshot(balancePartition)).toEqual(balanceSnapshot());
  });

  it.each(['json', 'version', 'address', 'oversize'])(
    'clears a corrupt %s partition without clearing another account',
    reason => {
      const repository = new RealmBalanceCacheRepository(realm);
      repository.replaceSnapshot(balancePartition, balanceSnapshot());
      const other = { networkId: balancePartition.networkId, accountAddress: 'GB' };
      repository.replaceSnapshot(other, balanceSnapshot('GB'));
      realm.write(() => {
        const record = realm.objectForPrimaryKey(
          BALANCE_CACHE_SNAPSHOT_ENTITY,
          JSON.stringify(['stellar-testnet', 'GA']),
        )!;
        if (reason === 'json') record.balanceJson = '{';
        if (reason === 'version') record.schemaVersion = 99;
        if (reason === 'address') record.accountAddress = 'GB';
        if (reason === 'oversize') record.balanceJson = 'x'.repeat(2 * 1024 * 1024 + 1);
      });
      expect(repository.getSnapshot(balancePartition)).toBeUndefined();
      expect(realm.objects(BALANCE_CACHE_SNAPSHOT_ENTITY)).toHaveLength(1);
      expect(repository.getSnapshot(other)).toEqual(balanceSnapshot('GB'));
    },
  );

  it('migrates v5 to v7 preserving every existing entity and starts Balance empty', async () => {
    const path = realm.path;
    realm.close();
    Realm.deleteFile({ path });
    realm = await Realm.open({
      path,
      schemaVersion: 5,
      schema: WALLET_REALM_SCHEMAS.filter(
        schema => schema.name !== BALANCE_CACHE_SNAPSHOT_ENTITY && schema.name !== DAPP_CATALOG_CACHE_ENTITY,
      ),
    });
    const date = new Date(0);
    const account = {
      id: 'old',
      address: 'GA',
      networkId: 'stellar-testnet',
      identityKind: 'classic' as const,
      label: 'Original',
      hidden: false,
      sortOrder: 0,
      createdAt: date,
      updatedAt: date,
    };
    const signer = {
      id: 'signer',
      publicKey: 'GSIGNER',
      kind: 'protected-software' as const,
      envelopeJson: '{"opaque":"test-envelope"}',
      envelopeRevision: 'r1',
      recoveryKind: 'secret' as const,
      backupState: 'confirmed' as const,
      createdAt: date,
      updatedAt: date,
    };
    const pending = {
      id: 'stellar-testnet:old-hash',
      networkId: 'stellar-testnet',
      accountId: 'old',
      sourceAddress: 'GA',
      transactionHash: 'old-hash',
      intentKind: 'payment',
      intentKey: 'old-intent',
      state: 'uncertain' as const,
      createdAt: date,
      updatedAt: date,
    };
    const accounts = new RealmAccountSignerRepository(realm);
    accounts.createAccountWithSigner({ account, signer, attachedAt: date });
    new RealmLocalePreferenceStore(realm).setLocale('zh', date);
    new RealmDefaultAccountPreferenceStore(realm).setDefaultAccountId(account.networkId, account.id, date);
    new RealmPendingSubmissionRepository(realm).create(pending);
    const history = historySnapshot([payment('one')]);
    new RealmHistoryCacheRepository(realm).replaceSnapshot(balancePartition, history);
    realm.close();
    realm = await openWalletRealm({ path });
    const migrated = new RealmAccountSignerRepository(realm);
    expect(realm.schemaVersion).toBe(8);
    expect(migrated.getAccount('old')).toEqual(account);
    expect(migrated.getSigner('signer')).toEqual(signer);
    expect(migrated.listSignersForAccount('old')).toEqual([signer]);
    expect(new RealmLocalePreferenceStore(realm).getLocale()).toBe('zh');
    expect(new RealmDefaultAccountPreferenceStore(realm).getDefaultAccountId(account.networkId)).toBe('old');
    expect(new RealmPendingSubmissionRepository(realm).get(account.networkId, 'old-hash')).toEqual(pending);
    expect(new RealmHistoryCacheRepository(realm).getSnapshot(balancePartition)).toEqual(history);
    const balanceCache = new RealmBalanceCacheRepository(realm);
    expect(balanceCache.getSnapshot(balancePartition)).toBeUndefined();
    balanceCache.replaceSnapshot(balancePartition, balanceSnapshot());
    // A confirmed/no-pending account may be deleted; caches disappear but shared recovery is untouched.
    new RealmPendingSubmissionRepository(realm).markConfirmed(account.networkId, 'old-hash', date, 1);
    deleteLocalAccount(
      {
        repository: migrated,
        pendingSubmissions: new RealmPendingSubmissionRepository(realm),
        historyCache: new RealmHistoryCacheRepository(realm),
        balanceCache,
      },
      'old',
    );
    expect(balanceCache.getSnapshot(balancePartition)).toBeUndefined();
    expect(new RealmHistoryCacheRepository(realm).getSnapshot(balancePartition)).toBeUndefined();
    expect(new RealmPendingSubmissionRepository(realm).get(account.networkId, 'old-hash')?.state).toBe('confirmed');
  });
});
