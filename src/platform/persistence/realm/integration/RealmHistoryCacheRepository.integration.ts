import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import Realm from 'realm';

import {
  HISTORY_CACHE_SCHEMA_VERSION,
  type HistoryCachePartition,
} from '../../../../capabilities/history/HistoryCacheRepository';
import {
  historySnapshot,
  payment,
  runHistoryCacheRepositoryContract,
} from '../../__tests__/historyCacheRepositoryContract';
import { RealmHistoryCacheRepository } from '../RealmHistoryCacheRepository';
import {
  ACCOUNT_SCHEMA,
  ACCOUNT_SIGNER_REFERENCE_SCHEMA,
  DEFAULT_ACCOUNT_PREFERENCE_SCHEMA,
  HISTORY_CACHE_SNAPSHOT_ENTITY,
  LOCALE_PREFERENCE_SCHEMA,
  PENDING_SUBMISSION_SCHEMA,
  SIGNER_SCHEMA,
} from '../schemas';
import { openWalletRealm } from '../openWalletRealm';

const partitionA: HistoryCachePartition = {
  networkId: 'stellar-testnet',
  accountAddress: 'GACCOUNT-A',
};
const partitionB: HistoryCachePartition = {
  networkId: 'stellar-testnet',
  accountAddress: 'GACCOUNT-B',
};

describe('RealmHistoryCacheRepository contract', () => {
  const directory = mkdtempSync(join(tmpdir(), 'fresnica-history-cache-contract-'));
  const path = join(directory, 'wallet.realm');
  let realm: Awaited<ReturnType<typeof openWalletRealm>>;
  let repository: RealmHistoryCacheRepository;

  beforeAll(async () => {
    realm = await openWalletRealm({ path });
    repository = new RealmHistoryCacheRepository(realm);
  });

  beforeEach(() => {
    realm.write(() => {
      realm.delete(realm.objects(HISTORY_CACHE_SNAPSHOT_ENTITY));
    });
  });

  afterAll(() => {
    realm.close();
    Realm.shutdown();
    rmSync(directory, { recursive: true, force: true });
  });

  runHistoryCacheRepositoryContract(() => repository);
});

describe('RealmHistoryCacheRepository persistence', () => {
  afterEach(() => {
    Realm.shutdown();
  });

  it('restores the same normalized snapshot after Realm close and reopen', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'fresnica-history-cache-reopen-'));
    const path = join(directory, 'wallet.realm');
    let realm: Awaited<ReturnType<typeof openWalletRealm>> | undefined;
    const snapshot = historySnapshot([payment('2'), payment('1')], [{ operationId: '2', entry: payment('2') }]);

    try {
      realm = await openWalletRealm({ path });
      new RealmHistoryCacheRepository(realm).replaceSnapshot(partitionA, snapshot);
      realm.close();
      realm = undefined;

      realm = await openWalletRealm({ path });
      expect(new RealmHistoryCacheRepository(realm).getSnapshot(partitionA)).toEqual(snapshot);
    } finally {
      realm?.close();
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it('keeps the previous durable snapshot when a Realm write cannot start', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'fresnica-history-cache-write-failure-'));
    const path = join(directory, 'wallet.realm');
    let realm: Awaited<ReturnType<typeof openWalletRealm>> | undefined;

    try {
      realm = await openWalletRealm({ path });
      const repository = new RealmHistoryCacheRepository(realm);
      const original = historySnapshot([payment('original')]);
      repository.replaceSnapshot(partitionA, original);

      realm.close();
      realm = undefined;
      expect(() => repository.replaceSnapshot(partitionA, historySnapshot([payment('replacement')]))).toThrow();

      realm = await openWalletRealm({ path });
      expect(new RealmHistoryCacheRepository(realm).getSnapshot(partitionA)).toEqual(original);
    } finally {
      realm?.close();
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it('clears only the corrupted partition and keeps another partition readable', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'fresnica-history-cache-corrupt-'));
    const path = join(directory, 'wallet.realm');
    let realm: Awaited<ReturnType<typeof openWalletRealm>> | undefined;

    try {
      realm = await openWalletRealm({ path });
      const repository = new RealmHistoryCacheRepository(realm);
      repository.replaceSnapshot(partitionA, historySnapshot([payment('a')]));
      repository.replaceSnapshot(partitionB, historySnapshot([payment('b')]));

      realm.write(() => {
        const record = realm!
          .objects(HISTORY_CACHE_SNAPSHOT_ENTITY)
          .filtered(
            'networkId == $0 AND accountAddress == $1',
            partitionA.networkId,
            partitionA.accountAddress,
          )[0] as unknown as { entriesJson: string };
        record.entriesJson = '{not-json';
      });

      expect(repository.getSnapshot(partitionA)).toBeUndefined();
      expect(repository.getSnapshot(partitionB)?.entries.map(entry => entry.id)).toEqual(['b']);
      expect(realm.objects(HISTORY_CACHE_SNAPSHOT_ENTITY)).toHaveLength(1);
    } finally {
      realm?.close();
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it('clears only a partition with an incompatible History cache schema version', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'fresnica-history-cache-schema-'));
    const path = join(directory, 'wallet.realm');
    let realm: Awaited<ReturnType<typeof openWalletRealm>> | undefined;

    try {
      realm = await openWalletRealm({ path });
      const repository = new RealmHistoryCacheRepository(realm);
      repository.replaceSnapshot(partitionA, historySnapshot([payment('a')]));
      repository.replaceSnapshot(partitionB, historySnapshot([payment('b')]));

      realm.write(() => {
        const record = realm!
          .objects(HISTORY_CACHE_SNAPSHOT_ENTITY)
          .filtered(
            'networkId == $0 AND accountAddress == $1',
            partitionA.networkId,
            partitionA.accountAddress,
          )[0] as unknown as { schemaVersion: number };
        record.schemaVersion = HISTORY_CACHE_SCHEMA_VERSION + 1;
      });

      expect(repository.getSnapshot(partitionA)).toBeUndefined();
      expect(repository.getSnapshot(partitionB)?.entries.map(entry => entry.id)).toEqual(['b']);
    } finally {
      realm?.close();
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it('migrates Realm v4 to v5 without touching existing wallet entities', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'fresnica-history-cache-v4-migration-'));
    const path = join(directory, 'wallet.realm');
    let realm: Realm | undefined;

    try {
      realm = await Realm.open({
        path,
        schema: [
          ACCOUNT_SCHEMA,
          SIGNER_SCHEMA,
          ACCOUNT_SIGNER_REFERENCE_SCHEMA,
          LOCALE_PREFERENCE_SCHEMA,
          DEFAULT_ACCOUNT_PREFERENCE_SCHEMA,
          PENDING_SUBMISSION_SCHEMA,
        ],
        schemaVersion: 4,
      });
      realm.write(() => {
        realm!.create(ACCOUNT_SCHEMA.name, {
          id: 'existing-account',
          address: 'GEXISTING',
          identityKind: 'classic',
          networkId: 'stellar-testnet',
          label: 'Existing',
          sortOrder: 0,
          hidden: false,
          createdAt: new Date('2026-09-20T08:00:00Z'),
          updatedAt: new Date('2026-09-20T08:00:00Z'),
        });
      });
      realm.close();
      realm = undefined;

      realm = await openWalletRealm({ path });
      expect(realm.objectForPrimaryKey(ACCOUNT_SCHEMA.name, 'existing-account')).toBeDefined();
      expect(realm.objects(HISTORY_CACHE_SNAPSHOT_ENTITY)).toHaveLength(0);
    } finally {
      realm?.close();
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
