import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import Realm from 'realm';

import type { AccountRecord } from '../../../../capabilities/account/types';
import {
  cacheHistoryOnlineEntriesBestEffort,
  cacheHistoryReadyDetailBestEffort,
  readCachedHistoryDetail,
  readHistoryCacheSnapshotBestEffort,
  type HistoryProductDependencies,
} from '../../../../capabilities/history/HistoryCacheHydration';
import {
  HISTORY_CACHE_SCHEMA_VERSION,
  type HistoryCachePartition,
} from '../../../../capabilities/history/HistoryCacheRepository';
import type { HistoryEntry } from '../../../../capabilities/history/types';
import type { SignerRecord } from '../../../../capabilities/signer/types';
import type { PendingSubmissionRecord } from '../../../../capabilities/transaction/pendingSubmission';
import {
  historySnapshot,
  payment,
  runHistoryCacheRepositoryContract,
} from '../../__tests__/historyCacheRepositoryContract';
import { RealmAccountSignerRepository } from '../RealmAccountSignerRepository';
import { RealmDefaultAccountPreferenceStore } from '../RealmDefaultAccountPreferenceStore';
import { RealmHistoryCacheRepository } from '../RealmHistoryCacheRepository';
import { RealmLocalePreferenceStore } from '../RealmLocalePreferenceStore';
import { RealmPendingSubmissionRepository } from '../RealmPendingSubmissionRepository';
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

  it('hydrates list and ready detail through product helpers after Realm close and reopen', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'fresnica-history-cache-product-reopen-'));
    const path = join(directory, 'wallet.realm');
    let realm: Awaited<ReturnType<typeof openWalletRealm>> | undefined;
    const currentAccount = historyAccount();
    const currentEntry = historyEntry('42', currentAccount.address);
    const updatedAt = new Date('2026-09-21T01:00:00.000Z');

    try {
      realm = await openWalletRealm({ path });
      let dependencies = historyProductDependencies(new RealmHistoryCacheRepository(realm), updatedAt);
      expect(cacheHistoryOnlineEntriesBestEffort(dependencies, currentAccount, [currentEntry], updatedAt)).toBe(true);
      expect(cacheHistoryReadyDetailBestEffort(dependencies, currentAccount, currentEntry)).toBe(true);

      realm.close();
      realm = undefined;

      realm = await openWalletRealm({ path });
      dependencies = historyProductDependencies(new RealmHistoryCacheRepository(realm), updatedAt);
      const restored = readHistoryCacheSnapshotBestEffort(dependencies, currentAccount);
      expect(restored?.entries).toEqual([currentEntry]);
      expect(restored?.lastSuccessfulHorizonUpdateAt).toEqual(updatedAt);
      expect(readCachedHistoryDetail(restored, currentEntry.id)).toEqual(currentEntry);
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

  it('clears only a partition whose persisted entry has an invalid occurredAt timestamp', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'fresnica-history-cache-invalid-time-'));
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
        record.entriesJson = JSON.stringify([
          {
            ...payment('a'),
            occurredAt: 'not-a-date',
          },
        ]);
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

  it('migrates every Realm v4 wallet entity to v5 while History starts empty', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'fresnica-history-cache-v4-migration-'));
    const path = join(directory, 'wallet.realm');
    let realm: Realm | undefined;
    const migratedAt = new Date('2026-09-20T08:00:00Z');
    const account: AccountRecord = {
      id: 'existing-account',
      address: 'GEXISTING',
      identityKind: 'classic',
      networkId: 'stellar-testnet',
      label: 'Existing',
      sortOrder: 0,
      hidden: false,
      createdAt: migratedAt,
      updatedAt: migratedAt,
    };
    const signer: SignerRecord = {
      id: 'existing-signer',
      publicKey: 'GEXISTINGSIGNER',
      kind: 'protected-software',
      envelopeJson: '{"opaque":"envelope"}',
      envelopeRevision: 'rev-1',
      recoveryKind: 'secret',
      backupState: 'confirmed',
      createdAt: migratedAt,
      updatedAt: migratedAt,
    };
    const pending: PendingSubmissionRecord = {
      id: 'stellar-testnet:existing-hash',
      networkId: 'stellar-testnet',
      accountId: account.id,
      sourceAddress: account.address,
      transactionHash: 'existing-hash',
      intentKind: 'payment',
      intentKey: '["payment","existing-account"]',
      state: 'uncertain',
      createdAt: migratedAt,
      updatedAt: migratedAt,
      lastCheckedAt: migratedAt,
    };

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
      const accountRepository = new RealmAccountSignerRepository(realm);
      accountRepository.createAccountWithSigner({
        account,
        signer,
        attachedAt: migratedAt,
      });
      new RealmLocalePreferenceStore(realm).setLocale('zh-TW', migratedAt);
      new RealmDefaultAccountPreferenceStore(realm).setDefaultAccountId(account.networkId, account.id, migratedAt);
      new RealmPendingSubmissionRepository(realm).create(pending);
      realm.close();
      realm = undefined;

      realm = await openWalletRealm({ path });
      const migratedAccounts = new RealmAccountSignerRepository(realm);
      expect(migratedAccounts.getAccount(account.id)).toEqual(account);
      expect(migratedAccounts.getSigner(signer.id)).toEqual(signer);
      expect(migratedAccounts.listSignersForAccount(account.id)).toEqual([signer]);
      expect(new RealmLocalePreferenceStore(realm).getLocale()).toBe('zh-TW');
      expect(new RealmDefaultAccountPreferenceStore(realm).getDefaultAccountId(account.networkId)).toBe(account.id);
      expect(new RealmPendingSubmissionRepository(realm).get(pending.networkId, pending.transactionHash)).toEqual(
        pending,
      );
      expect(realm.objects(HISTORY_CACHE_SNAPSHOT_ENTITY)).toHaveLength(0);
    } finally {
      realm?.close();
      rmSync(directory, { recursive: true, force: true });
    }
  });
});

function historyProductDependencies(cache: RealmHistoryCacheRepository, now: Date): HistoryProductDependencies {
  return {
    gateway: {
      loadAccountOperations: jest.fn(),
      loadOperation: jest.fn(),
    },
    networkId: 'stellar-testnet',
    cache,
    now: () => now,
  };
}

function historyAccount(): AccountRecord {
  const timestamp = new Date('2026-09-21T00:00:00.000Z');
  return {
    id: 'history-account',
    address: 'GACCOUNT-A',
    identityKind: 'classic',
    networkId: 'stellar-testnet',
    label: 'History account',
    sortOrder: 0,
    hidden: false,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

function historyEntry(id: string, sourceAccount: string): HistoryEntry {
  return {
    id,
    pagingToken: id,
    operationType: 'future_operation',
    occurredAt: '2026-09-20T23:00:00.000Z',
    transactionHash: `tx-${id}`,
    sourceAccount,
    kind: 'unsupported',
    reason: 'operation-type',
  };
}
