import { controlCases, controlRecord, controlSource } from '../../../../capabilities/history/__tests__/classicControlHistory.fixtures';
import { mapHistoryEntry } from '../../../../capabilities/history/loadHistoryPage';
import {
  trustSponsorshipRecord,
  trustSponsorshipTypes,
  trustIssuer,
  trustor,
  trustForeign,
} from '../../../../capabilities/history/__tests__/trustSponsorshipHistory.fixtures';
import {
  maintenanceRecord,
  maintenanceSource,
  maintenanceForeign,
  maintenanceTypes,
} from '../../../../capabilities/history/__tests__/maintenanceHistory.fixtures';
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
  normalizeHistoryCacheSnapshot,
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

it('persists exact settled path legs and legacy unsupported paths through real Realm close/reopen', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'fresnica-path-history-reopen-'));
  const path = join(directory, 'wallet.realm');
  const address = 'G' + 'A'.repeat(55);
  const issuer = 'G' + 'B'.repeat(55);
  const partition = { networkId: 'stellar-testnet', accountAddress: address };
  const entry = mapHistoryEntry(
    {
      id: 'path-1',
      pagingToken: '100',
      type: 'path_payment_strict_send',
      occurredAt: '2026-11-03T00:00:00Z',
      transactionHash: 'path-tx',
      sourceAccount: address,
      successful: true,
      from: address,
      to: address,
      sourceAmount: '922337203685.4775807',
      sourceAsset: { kind: 'native' },
      amount: '0.0000001',
      asset: { kind: 'credit', code: 'XLM', issuer },
    },
    address,
  );
  const legacy: HistoryEntry = { ...entry, id: 'old-path', kind: 'unsupported', reason: 'operation-type' };
  const snapshot = historySnapshot([entry, legacy], [{ operationId: entry.id, entry }]);
  let realm: Awaited<ReturnType<typeof openWalletRealm>> | undefined;
  try {
    realm = await openWalletRealm({ path });
    new RealmHistoryCacheRepository(realm).replaceSnapshot(partition, snapshot);
    realm.close();
    realm = undefined;
    realm = await openWalletRealm({ path });
    const repository = new RealmHistoryCacheRepository(realm);
    expect(repository.getSnapshot(partition)).toEqual(normalizeHistoryCacheSnapshot(snapshot));
    expect(repository.getSnapshot({ ...partition, networkId: 'stellar-mainnet' })).toBeUndefined();
    expect(repository.getSnapshot({ ...partition, accountAddress: issuer })).toBeUndefined();
  } finally {
    realm?.close();
    Realm.shutdown();
    rmSync(directory, { recursive: true, force: true });
  }
});

it('persists exact offer intents, actual pool legs and legacy families through real Realm close/reopen', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'fresnica-offer-pool-history-reopen-'));
  const path = join(directory, 'wallet.realm');
  const address = 'G' + 'A'.repeat(55);
  const issuer = 'G' + 'B'.repeat(55);
  const partition = { networkId: 'stellar-testnet', accountAddress: address };
  const base = {
    id: 'offer',
    pagingToken: '100',
    type: 'manage_buy_offer',
    occurredAt: '2026-11-03T00:00:00Z',
    transactionHash: 'tx',
    sourceAccount: address,
    successful: true,
  };
  const offer = mapHistoryEntry(
    {
      ...base,
      buyingAsset: { kind: 'native' },
      sellingAsset: { kind: 'credit', code: 'XLM', issuer },
      amount: '922337203685.4775807',
      price: { n: 2147483647, d: 3 },
      offerId: '9223372036854775807',
    },
    address,
  );
  const deposit = mapHistoryEntry(
    {
      ...base,
      id: 'pool',
      type: 'liquidity_pool_deposit',
      poolId: 'a'.repeat(64),
      shares: '0.0000001',
      reserves: [
        { asset: { kind: 'native' }, amount: '0' },
        { asset: { kind: 'credit', code: 'XLM', issuer }, amount: '922337203685.4775807' },
      ],
    },
    address,
  );
  const legacy = { ...offer, id: 'legacy-offer', kind: 'unsupported', reason: 'operation-type' } as HistoryEntry;
  const snapshot = historySnapshot(
    [offer, deposit, legacy],
    [
      { operationId: offer.id, entry: offer },
      { operationId: deposit.id, entry: deposit },
    ],
  );
  let realm: Awaited<ReturnType<typeof openWalletRealm>> | undefined;
  try {
    realm = await openWalletRealm({ path });
    new RealmHistoryCacheRepository(realm).replaceSnapshot(partition, snapshot);
    realm.close();
    realm = undefined;
    realm = await openWalletRealm({ path });
    const repository = new RealmHistoryCacheRepository(realm);
    expect(repository.getSnapshot(partition)).toEqual(normalizeHistoryCacheSnapshot(snapshot, partition));
    expect(repository.getSnapshot({ ...partition, networkId: 'stellar-mainnet' })).toBeUndefined();
    expect(repository.getSnapshot({ ...partition, accountAddress: issuer })).toBeUndefined();
    const detached = repository.getSnapshot(partition)!;
    expect(() => {
      (detached.entries as HistoryEntry[]).push(offer);
    }).toThrow();
    expect(repository.getSnapshot(partition)?.entries).toHaveLength(3);
  } finally {
    realm?.close();
    Realm.shutdown();
    rmSync(directory, { recursive: true, force: true });
  }
});

it('reopens all four claimable/clawback v1 payloads with roles/predicates/exact IDs and isolated partitions', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'fresnica-history-claimable-'));
  const path = join(directory, 'wallet.realm');
  const address = `G${'A'.repeat(55)}`;
  const issuer = `G${'B'.repeat(55)}`;
  const claimant = `G${'C'.repeat(55)}`;
  const partition = { networkId: 'stellar-testnet', accountAddress: address };
  const entries = ['create_claimable_balance', 'claim_claimable_balance', 'clawback', 'clawback_claimable_balance'].map(
    (type, index) =>
      mapHistoryEntry(
        {
          id: String(index),
          pagingToken: String(index),
          type,
          occurredAt: '2026-11-03T00:00:00Z',
          transactionHash: 'hash',
          sourceAccount: type === 'clawback' ? issuer : address,
          successful: true,
          asset: { kind: 'credit', code: 'USD', issuer },
          amount: '922337203685.4775807',
          claimants: [
            {
              destination: claimant,
              predicate: { or: [{ absBefore: '+39121901036-03-29T15:30:22Z' }, { rel_before: '-1' }] },
            },
          ],
          from: address,
          claimant: address,
          balanceId: `00000000${'c'.repeat(64)}`,
        },
        address,
      ),
  );
  expect(entries.every(entry => entry.kind !== 'unsupported')).toBe(true);
  const snapshot = historySnapshot(
    entries,
    entries.map(entry => ({ operationId: entry.id, entry })),
  );
  let realm: Awaited<ReturnType<typeof openWalletRealm>> | undefined;
  try {
    realm = await openWalletRealm({ path });
    new RealmHistoryCacheRepository(realm).replaceSnapshot(partition, snapshot);
    realm.close();
    realm = undefined;
    realm = await openWalletRealm({ path });
    const repository = new RealmHistoryCacheRepository(realm);
    const reopened = repository.getSnapshot(partition)!;
    expect(reopened).toEqual(normalizeHistoryCacheSnapshot(snapshot, partition));
    expect(reopened.entries).toHaveLength(4);
    expect(repository.getSnapshot({ ...partition, networkId: 'stellar-mainnet' })).toBeUndefined();
    expect(repository.getSnapshot({ ...partition, accountAddress: claimant })).toBeUndefined();
    const create = reopened.entries[0];
    if (create.kind !== 'claimable-create') throw new Error('expected-create');
    expect(Object.isFrozen(create.claimants[0].predicate)).toBe(true);
    expect(() => {
      (create.claimants as unknown[]).push({});
    }).toThrow();
    expect(() => repository.replaceSnapshot(partition, historySnapshot([{ ...create, role: 'claimant' }]))).toThrow();
    expect(repository.getSnapshot(partition)).toEqual(reopened);
  } finally {
    realm?.close();
    Realm.shutdown();
    rmSync(directory, { recursive: true, force: true });
  }
});

it('reopens contract identity and ordered exact i128 routed events in the original partition', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'fresnica-contract-history-'));
  const path = join(directory, 'wallet.realm');
  const address = `G${'A'.repeat(55)}`;
  const recipient = `G${'B'.repeat(55)}`;
  const partition = { networkId: 'stellar-testnet', accountAddress: address };
  const entries = mapHistoryEntry(
    {
      id: 'contract',
      pagingToken: 'contract',
      type: 'invoke_host_function',
      occurredAt: '2026-11-03T00:00:00Z',
      transactionHash: 'hash',
      sourceAccount: address,
      successful: true,
      hostFunction: 'HostFunctionTypeHostFunctionTypeInvokeContract',
      contractId: `C${'A'.repeat(55)}`,
      functionName: 'transfer',
      assetBalanceChanges: [
        {
          type: 'transfer',
          asset: { kind: 'native' },
          amount: '17014118346046923173168730371588.4105727',
          from: address,
          to: recipient,
          destinationMuxedId: '18446744073709551615',
        },
        { type: 'burn', asset: { kind: 'credit', code: 'XLM', issuer: recipient }, amount: '0', from: address },
      ],
    },
    address,
  );
  const variants = [
    entries,
    ...(['create', 'upload'] as const).map(host =>
      mapHistoryEntry(
        {
          id: `contract-${host}`,
          pagingToken: `contract-${host}`,
          type: 'invoke_host_function',
          occurredAt: '2026-11-03T00:00:00Z',
          transactionHash: 'hash',
          sourceAccount: address,
          successful: true,
          hostFunction:
            host === 'create'
              ? 'HostFunctionTypeHostFunctionTypeCreateContract'
              : 'HostFunctionTypeHostFunctionTypeUploadContractWasm',
          contractId: `C${'A'.repeat(55)}`,
        },
        address,
      ),
    ),
  ];
  const snapshot = historySnapshot(
    variants,
    variants.map(entry => ({ operationId: entry.id, entry })),
  );
  let realm: Awaited<ReturnType<typeof openWalletRealm>> | undefined;
  try {
    realm = await openWalletRealm({ path });
    new RealmHistoryCacheRepository(realm).replaceSnapshot(partition, snapshot);
    realm.close();
    realm = undefined;
    realm = await openWalletRealm({ path });
    const repository = new RealmHistoryCacheRepository(realm);
    expect(repository.getSnapshot(partition)).toEqual(normalizeHistoryCacheSnapshot(snapshot, partition));
    expect(repository.getSnapshot({ ...partition, networkId: 'stellar-mainnet' })).toBeUndefined();
    expect(repository.getSnapshot({ ...partition, accountAddress: recipient })).toBeUndefined();
    expect(() => repository.replaceSnapshot({ ...partition, accountAddress: recipient }, snapshot)).toThrow();
  } finally {
    realm?.close();
    Realm.shutdown();
    rmSync(directory, { recursive: true, force: true });
  }
});

it('reopens exact maintenance targets and source-only partitions without monetary fields', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'fresnica-maintenance-history-'));
  const path = join(directory, 'wallet.realm');
  const partition = { networkId: 'test', accountAddress: maintenanceSource };
  const entries = maintenanceTypes.map(type => mapHistoryEntry(maintenanceRecord(type), maintenanceSource));
  const snapshot = historySnapshot(
    entries,
    entries.map(entry => ({ operationId: entry.id, entry })),
  );
  let realm: Awaited<ReturnType<typeof openWalletRealm>> | undefined;
  try {
    realm = await openWalletRealm({ path });
    new RealmHistoryCacheRepository(realm).replaceSnapshot(partition, snapshot);
    realm.close();
    realm = undefined;
    realm = await openWalletRealm({ path });
    const repository = new RealmHistoryCacheRepository(realm);
    expect(repository.getSnapshot(partition)).toEqual(normalizeHistoryCacheSnapshot(snapshot, partition));
    expect(repository.getSnapshot({ ...partition, networkId: 'other' })).toBeUndefined();
    expect(repository.getSnapshot({ ...partition, accountAddress: maintenanceForeign })).toBeUndefined();
    expect(() => repository.replaceSnapshot({ ...partition, accountAddress: maintenanceForeign }, snapshot)).toThrow();
    expect(repository.getSnapshot(partition)).toEqual(normalizeHistoryCacheSnapshot(snapshot, partition));
  } finally {
    realm?.close();
    Realm.shutdown();
    rmSync(directory, { recursive: true, force: true });
  }
});

it('reopens trust permissions and both sponsorship roles without mixing partitions', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'fresnica-trust-sponsorship-'));
  const path = join(directory, 'wallet.realm');
  const snapshots = [trustIssuer, trustor].map(address => {
    const entries = trustSponsorshipTypes.map(type => mapHistoryEntry(trustSponsorshipRecord(type), address));
    return {
      partition: { networkId: 'test', accountAddress: address },
      snapshot: historySnapshot(
        entries,
        entries.map(entry => ({ operationId: entry.id, entry })),
      ),
    };
  });
  let realm: Awaited<ReturnType<typeof openWalletRealm>> | undefined;
  try {
    realm = await openWalletRealm({ path });
    for (const { partition, snapshot } of snapshots)
      new RealmHistoryCacheRepository(realm).replaceSnapshot(partition, snapshot);
    realm.close();
    realm = undefined;
    realm = await openWalletRealm({ path });
    const repository = new RealmHistoryCacheRepository(realm);
    for (const { partition, snapshot } of snapshots) {
      expect(repository.getSnapshot(partition)).toEqual(normalizeHistoryCacheSnapshot(snapshot, partition));
      expect(repository.getSnapshot({ ...partition, networkId: 'other' })).toBeUndefined();
      expect(repository.getSnapshot({ ...partition, accountAddress: trustForeign })).toBeUndefined();
      expect(() => repository.replaceSnapshot({ ...partition, accountAddress: trustForeign }, snapshot)).toThrow();
    }
  } finally {
    realm?.close();
    Realm.shutdown();
    rmSync(directory, { recursive: true, force: true });
  }
});

it('reopens classic controls without losing parameters or partition isolation', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'fresnica-classic-controls-'));
  const partition = { networkId: 'test', accountAddress: controlSource };
  const entries = controlCases.map(([type, parameters], index) => mapHistoryEntry(controlRecord(type, parameters, { id: String(index) }), controlSource));
  const snapshot = historySnapshot(entries, entries.map(entry => ({ operationId: entry.id, entry })));
  let realm: Awaited<ReturnType<typeof openWalletRealm>> | undefined;
  try {
    const path = join(directory, 'wallet.realm');
    realm = await openWalletRealm({ path });
    new RealmHistoryCacheRepository(realm).replaceSnapshot(partition, snapshot);
    realm.close(); realm = undefined;
    realm = await openWalletRealm({ path });
    const repository = new RealmHistoryCacheRepository(realm);
    expect(repository.getSnapshot(partition)).toEqual(normalizeHistoryCacheSnapshot(snapshot, partition));
    expect(repository.getSnapshot({ ...partition, networkId: 'other' })).toBeUndefined();
    expect(repository.getSnapshot({ ...partition, accountAddress: `G${'Z'.repeat(55)}` })).toBeUndefined();
  } finally { realm?.close(); Realm.shutdown(); rmSync(directory, { recursive: true, force: true }); }
});
