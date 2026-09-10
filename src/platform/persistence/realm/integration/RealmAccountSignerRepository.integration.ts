import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Realm from 'realm';
import type { AccountRecord } from '../../../../capabilities/account/types';
import type { SignerRecord } from '../../../../capabilities/signer/types';
import type { PendingSubmissionRecord } from '../../../../capabilities/transaction/pendingSubmission';
import { reconcilePendingSubmissions } from '../../../../capabilities/transaction/reconcilePendingSubmissions';
import { runAccountSignerRepositoryContract } from '../../__tests__/repositoryContract';
import { RealmAccountSignerRepository } from '../RealmAccountSignerRepository';
import { RealmPendingSubmissionRepository } from '../RealmPendingSubmissionRepository';
import { createRealmRecordId } from '../createRealmRecordId';
import { openWalletRealm } from '../openWalletRealm';

const now = new Date('2026-08-28T00:00:00.000Z');

afterAll(() => {
  Realm.shutdown();
});

function account(id: string): AccountRecord {
  return {
    id,
    address: `G${id}`,
    identityKind: 'classic',
    networkId: 'stellar-testnet',
    label: id,
    sortOrder: 0,
    hidden: false,
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
    recoveryKind: 'mnemonic',
    backupState: 'confirmed',
    createdAt: now,
    updatedAt: now,
  };
}

describe('Realm record id generation', () => {
  it('generates unique ObjectId strings', () => {
    const first = createRealmRecordId();
    const second = createRealmRecordId();

    expect(first).toMatch(/^[0-9a-f]{24}$/);
    expect(second).toMatch(/^[0-9a-f]{24}$/);
    expect(second).not.toBe(first);
  });
});

describe('RealmAccountSignerRepository contract', () => {
  let directory: string;
  let realm: Awaited<ReturnType<typeof openWalletRealm>> | undefined;
  let repository: RealmAccountSignerRepository | undefined;

  beforeEach(async () => {
    directory = mkdtempSync(join(tmpdir(), 'fresnica-realm-contract-'));
    realm = await openWalletRealm({ path: join(directory, 'wallet.realm') });
    repository = new RealmAccountSignerRepository(realm);
  });

  afterEach(() => {
    realm?.close();
    repository = undefined;
    realm = undefined;
    rmSync(directory, { recursive: true, force: true });
  });

  runAccountSignerRepositoryContract(() => {
    if (!repository) {
      throw new Error('realm-repository-not-open');
    }
    return repository;
  });
});

describe('RealmAccountSignerRepository restart integration', () => {
  it('persists relationships across close/reopen and preserves shared signer cleanup semantics', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'fresnica-realm-restart-'));
    const path = join(directory, 'wallet.realm');
    let activeRealm: Awaited<ReturnType<typeof openWalletRealm>> | undefined;

    try {
      activeRealm = await openWalletRealm({ path });
      const firstRepository = new RealmAccountSignerRepository(activeRealm);
      firstRepository.createAccount(account('account-a'));
      firstRepository.createAccount(account('account-b'));
      firstRepository.createSigner(signer('shared'));
      firstRepository.attachSigner('account-a', 'shared', now);
      firstRepository.attachSigner('account-b', 'shared', now);
      activeRealm.close();
      activeRealm = undefined;

      activeRealm = await openWalletRealm({ path });
      const reopenedRepository = new RealmAccountSignerRepository(activeRealm);

      expect(reopenedRepository.getAccount('account-a')).toEqual(account('account-a'));
      expect(reopenedRepository.getAccount('account-b')).toEqual(account('account-b'));
      expect(reopenedRepository.getSigner('shared')).toEqual(signer('shared'));
      expect(reopenedRepository.isWatchOnly('account-a')).toBe(false);
      expect(reopenedRepository.isWatchOnly('account-b')).toBe(false);

      reopenedRepository.deleteAccount('account-a');
      expect(reopenedRepository.getSigner('shared')).toBeDefined();
      expect(reopenedRepository.isWatchOnly('account-b')).toBe(false);

      reopenedRepository.detachSigner('account-b', 'shared');
      expect(reopenedRepository.isWatchOnly('account-b')).toBe(true);
      expect(reopenedRepository.getSigner('shared')).toBeUndefined();
    } finally {
      activeRealm?.close();
      rmSync(directory, { recursive: true, force: true });
    }
  });
});

describe('RealmPendingSubmissionRepository restart integration', () => {
  it('persists public recovery metadata and preserves the duplicate guard after reopen', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'fresnica-realm-pending-'));
    const path = join(directory, 'wallet.realm');
    let activeRealm: Awaited<ReturnType<typeof openWalletRealm>> | undefined;
    const pending: PendingSubmissionRecord = {
      id: 'stellar-testnet:transaction-hash',
      networkId: 'stellar-testnet',
      accountId: 'account-1',
      sourceAddress: 'GSOURCE',
      transactionHash: 'transaction-hash',
      intentKind: 'trustline',
      intentKey: '["trustline","USD","GISSUER","add"]',
      state: 'uncertain',
      createdAt: now,
      updatedAt: now,
    };

    try {
      activeRealm = await openWalletRealm({ path });
      new RealmPendingSubmissionRepository(activeRealm).create(pending);
      activeRealm.close();
      activeRealm = undefined;

      activeRealm = await openWalletRealm({ path });
      const reopened = new RealmPendingSubmissionRepository(activeRealm);

      expect(reopened.findBlockingIntent(pending.networkId, pending.accountId, pending.intentKey)).toEqual(pending);

      expect(() =>
        reopened.create({
          ...pending,
          id: 'stellar-testnet:replacement-hash',
          transactionHash: 'replacement-hash',
        }),
      ).toThrow('pending-submission-intent-blocked');

      const checkedAt = new Date('2026-09-10T00:02:00.000Z');
      reopened.markRejected(pending.networkId, pending.transactionHash, checkedAt, 'tx_bad_seq');
      expect(reopened.listUnresolved()).toEqual([]);
      expect(reopened.get(pending.networkId, pending.transactionHash)).toMatchObject({
        state: 'rejected',
        lastCheckedAt: checkedAt,
        resultCode: 'tx_bad_seq',
      });
    } finally {
      activeRealm?.close();
      rmSync(directory, { recursive: true, force: true });
    }
  });
});

describe('Realm pending-submission reconciliation recovery', () => {
  it('keeps a long-unknown intent blocking across restart until the original hash is confirmed', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'fresnica-realm-long-unknown-'));
    const path = join(directory, 'wallet.realm');
    let activeRealm: Awaited<ReturnType<typeof openWalletRealm>> | undefined;
    const createdAt = new Date('2020-01-01T00:00:00.000Z');
    const checkedAt = new Date('2036-01-01T00:00:00.000Z');
    const pending: PendingSubmissionRecord = {
      id: 'stellar-testnet:long-unknown-hash',
      networkId: 'stellar-testnet',
      accountId: 'account-long-unknown',
      sourceAddress: 'GSOURCE',
      transactionHash: 'long-unknown-hash',
      intentKind: 'payment',
      intentKey: '["payment","GDESTINATION","1.0000000"]',
      state: 'uncertain',
      createdAt,
      updatedAt: createdAt,
    };

    try {
      activeRealm = await openWalletRealm({path});
      new RealmPendingSubmissionRepository(activeRealm).create(pending);
      activeRealm.close();
      activeRealm = undefined;
      activeRealm = await openWalletRealm({path});
      let reopened = new RealmPendingSubmissionRepository(activeRealm);
      await reconcilePendingSubmissions({
        gateway: {
          loadTransactionOutcome: jest.fn().mockResolvedValue({
            status: 'still-unknown',
            transactionHash: pending.transactionHash,
          }),
        },
        repository: reopened,
        readInvalidation: {invalidate: jest.fn()},
        networkId: pending.networkId,
        now: () => checkedAt,
      });

      expect(reopened.findBlockingIntent(pending.networkId, pending.accountId, pending.intentKey)).toMatchObject({
        state: 'uncertain',
        lastCheckedAt: checkedAt,
      });
      expect(() => reopened.create({
        ...pending,
        id: 'stellar-testnet:replacement-hash',
        transactionHash: 'replacement-hash',
        createdAt: checkedAt,
        updatedAt: checkedAt,
      })).toThrow('pending-submission-intent-blocked');
      activeRealm.close();
      activeRealm = undefined;
      activeRealm = await openWalletRealm({path});
      reopened = new RealmPendingSubmissionRepository(activeRealm);
      expect(reopened.findBlockingIntent(pending.networkId, pending.accountId, pending.intentKey)).toBeDefined();

      await reconcilePendingSubmissions({
        gateway: {
          loadTransactionOutcome: jest.fn().mockResolvedValue({
            status: 'confirmed',
            transactionHash: pending.transactionHash,
            ledger: 9001,
          }),
        },
        repository: reopened,
        readInvalidation: {invalidate: jest.fn()},
        networkId: pending.networkId,
        now: () => new Date('2036-01-01T00:01:00.000Z'),
      });
      expect(reopened.findBlockingIntent(pending.networkId, pending.accountId, pending.intentKey)).toBeUndefined();
      expect(reopened.get(pending.networkId, pending.transactionHash)).toMatchObject({
        state: 'confirmed',
        ledger: 9001,
      });
    } finally {
      activeRealm?.close();
      rmSync(directory, {recursive: true, force: true});
    }
  });
  it('releases a restarted pending intent only after a deterministic rejected outcome is observed', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'fresnica-realm-rejected-'));
    const path = join(directory, 'wallet.realm');
    let activeRealm: Awaited<ReturnType<typeof openWalletRealm>> | undefined;
    const pending: PendingSubmissionRecord = {
      id: 'stellar-testnet:rejected-hash',
      networkId: 'stellar-testnet',
      accountId: 'account-rejected',
      sourceAddress: 'GSOURCE',
      transactionHash: 'rejected-hash',
      intentKind: 'trustline',
      intentKey: '["trustline","remove","USD","GISSUER","limit:none"]',
      state: 'uncertain',
      createdAt: now,
      updatedAt: now,
    };

    try {
      activeRealm = await openWalletRealm({path});
      new RealmPendingSubmissionRepository(activeRealm).create(pending);
      activeRealm.close();
      activeRealm = undefined;
      activeRealm = await openWalletRealm({path});
      const reopened = new RealmPendingSubmissionRepository(activeRealm);
      await reconcilePendingSubmissions({
        gateway: {
          loadTransactionOutcome: jest.fn().mockResolvedValue({
            status: 'rejected',
            transactionHash: pending.transactionHash,
            resultCode: 'tx_bad_seq',
          }),
        },
        repository: reopened,
        readInvalidation: {invalidate: jest.fn()},
        networkId: pending.networkId,
        now: () => new Date('2026-09-10T00:03:00.000Z'),
      });

      expect(reopened.findBlockingIntent(pending.networkId, pending.accountId, pending.intentKey)).toBeUndefined();
      expect(reopened.get(pending.networkId, pending.transactionHash)).toMatchObject({
        state: 'rejected',
        resultCode: 'tx_bad_seq',
      });
    } finally {
      activeRealm?.close();
      rmSync(directory, {recursive: true, force: true});
    }
  });
});
