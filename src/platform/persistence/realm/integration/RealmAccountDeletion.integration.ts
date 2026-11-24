import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Realm from 'realm';

import { createNetworkAccountRepository } from '../../../../capabilities/account/createNetworkAccountRepository';
import { deleteLocalAccount } from '../../../../capabilities/account/deleteLocalAccount';
import type { AccountRecord } from '../../../../capabilities/account/types';
import {
  createClaimableProduct,
  type ClaimableReadPort,
} from '../../../../capabilities/claimable/createClaimableProduct';
import { mapClaimableRecord } from '../../../../capabilities/claimable/records';
import { balanceSnapshot } from '../../__tests__/balanceCacheRepositoryContract';
import { historySnapshot, payment } from '../../__tests__/historyCacheRepositoryContract';
import { RealmAccountSignerRepository } from '../RealmAccountSignerRepository';
import { RealmBalanceCacheRepository } from '../RealmBalanceCacheRepository';
import { RealmClaimableCacheStore } from '../RealmClaimableCacheStore';
import { RealmContactStore } from '../RealmContactStore';
import { RealmDappPermissionStore } from '../RealmDappPermissionStore';
import { RealmHistoryCacheRepository } from '../RealmHistoryCacheRepository';
import { RealmPendingSubmissionRepository } from '../RealmPendingSubmissionRepository';
import { openWalletRealm } from '../openWalletRealm';

const main = 'stellar-mainnet';
const test = 'stellar-testnet';
const networks = [main, test];
const now = new Date('2026-11-24T00:00:00Z');
const claimId = '00000000' + 'a'.repeat(64);
const orphanRiskId = '00000000' + 'f'.repeat(64);
const origins = ['https://dex.example.org', 'https://pay.example.org'];
const account = (id: string, letter: string): AccountRecord => ({
  id,
  address: 'G' + letter.repeat(55),
  networkId: test,
  identityKind: 'classic',
  label: id,
  sortOrder: 0,
  hidden: false,
  createdAt: now,
  updatedAt: now,
});
const a = account('wallet-A', 'A');
const b = account('wallet-B', 'B');

function dependencies(realm: Realm) {
  const stored = new RealmAccountSignerRepository(realm);
  return {
    stored,
    repository: createNetworkAccountRepository(stored, test),
    pendingSubmissions: new RealmPendingSubmissionRepository(realm),
    balanceCache: new RealmBalanceCacheRepository(realm),
    historyCache: new RealmHistoryCacheRepository(realm),
    claimableCache: new RealmClaimableCacheStore(realm),
    dappPermissions: new RealmDappPermissionStore(realm),
    cacheNetworkIds: networks,
  };
}

function claim(target: AccountRecord) {
  return mapClaimableRecord(
    {
      id: claimId,
      asset: 'native',
      amount: '2.0000000',
      sponsor: 'G' + 'C'.repeat(55),
      claimants: [{ destination: target.address, predicate: { unconditional: true } }],
    },
    target.address,
  );
}

function seedAddress(deps: ReturnType<typeof dependencies>, target: AccountRecord) {
  for (const networkId of networks) {
    const partition = { networkId, accountAddress: target.address };
    deps.balanceCache.replaceSnapshot(partition, balanceSnapshot(target.address));
    deps.historyCache.replaceSnapshot(partition, historySnapshot([payment(target.id)]));
    deps.claimableCache.replace({
      networkId,
      address: target.address,
      savedAt: now.getTime(),
      records: [claim(target)],
      everSeen: true,
    });
    deps.claimableCache.setUserSpam(networkId, target.address, claimId, true);
    deps.claimableCache.setUserSpam(networkId, target.address, orphanRiskId, false);
  }
}

function seedGrants(deps: ReturnType<typeof dependencies>, target: AccountRecord) {
  for (const networkId of networks) {
    for (const origin of origins) deps.dappPermissions.grant({ networkId, origin, accountId: target.id });
  }
}

function expectAddressCleared(deps: ReturnType<typeof dependencies>, target: AccountRecord) {
  for (const networkId of networks) {
    const partition = { networkId, accountAddress: target.address };
    expect(deps.balanceCache.getSnapshot(partition)).toBeUndefined();
    expect(deps.historyCache.getSnapshot(partition)).toBeUndefined();
    expect(deps.claimableCache.read(networkId, target.address)).toBeUndefined();
    expect(deps.claimableCache.userSpam(networkId, target.address, claimId)).toBeUndefined();
    expect(deps.claimableCache.userSpam(networkId, target.address, orphanRiskId)).toBeUndefined();
  }
}

function expectAddressPreserved(deps: ReturnType<typeof dependencies>, target: AccountRecord) {
  for (const networkId of networks) {
    const partition = { networkId, accountAddress: target.address };
    expect(deps.balanceCache.getSnapshot(partition)).toEqual(balanceSnapshot(target.address));
    expect(deps.historyCache.getSnapshot(partition)).toEqual(historySnapshot([payment(target.id)]));
    expect(deps.claimableCache.read(networkId, target.address)?.records).toEqual([claim(target)]);
    expect(deps.claimableCache.userSpam(networkId, target.address, claimId)).toBe(true);
    expect(deps.claimableCache.userSpam(networkId, target.address, orphanRiskId)).toBe(false);
  }
}

describe('Account deletion across actual Realm partitions', () => {
  let directory: string;
  let path: string;
  let realm: Realm;
  beforeEach(async () => {
    directory = mkdtempSync(join(tmpdir(), 'fresnica-account-cleanup-'));
    path = join(directory, 'wallet.realm');
    realm = await openWalletRealm({ path });
  });
  afterEach(() => {
    if (!realm.isClosed) realm.close();
    rmSync(directory, { recursive: true, force: true });
  });
  afterAll(() => Realm.shutdown());

  it('removes all address caches, risk marks and account grants across reopen while retaining other accounts and Contacts', async () => {
    let deps = dependencies(realm);
    deps.stored.createAccountWithSigner({
      account: a,
      signer: { id: 'orphan', publicKey: a.address, kind: 'external', createdAt: now, updatedAt: now },
      attachedAt: now,
    });
    deps.stored.createAccount(b);
    for (const target of [a, b]) {
      seedAddress(deps, target);
      seedGrants(deps, target);
    }
    const contact = {
      id: 'address-book-A',
      networkId: main,
      name: 'Saved receiving address',
      address: a.address,
      memo: { type: 'id' as const, value: '7' },
    };
    new RealmContactStore(realm).save(contact);
    deps.pendingSubmissions.create({
      id: `${main}:other-pending`,
      networkId: main,
      accountId: b.id,
      sourceAddress: b.address,
      transactionHash: 'other-pending',
      intentKind: 'payment',
      intentKey: 'other-intent',
      state: 'uncertain',
      createdAt: now,
      updatedAt: now,
    });
    const event = jest.fn();
    deps.dappPermissions.subscribe(event);

    deleteLocalAccount(deps, a.id);
    expect(event).toHaveBeenCalledWith({ kind: 'account-revoked', accountId: a.id });
    deps.dappPermissions.close();
    realm.close();
    realm = await openWalletRealm({ path });
    deps = dependencies(realm);

    expect(deps.stored.getAccount(a.id)).toBeUndefined();
    expect(deps.stored.getSigner('orphan')).toBeUndefined();
    expect(deps.stored.getAccount(b.id)).toEqual(b);
    expectAddressCleared(deps, a);
    expectAddressPreserved(deps, b);
    for (const networkId of networks) {
      expect(deps.dappPermissions.list(networkId).map(grant => grant.accountId)).toEqual([b.id, b.id]);
      for (const origin of origins) {
        expect(deps.dappPermissions.has({ networkId, origin, accountId: a.id })).toBe(false);
        expect(deps.dappPermissions.has({ networkId, origin, accountId: b.id })).toBe(true);
      }
      expect(new RealmContactStore(realm).list(networkId)).toEqual([contact]);
    }
    expect(deps.pendingSubmissions.get(main, 'other-pending')?.state).toBe('uncertain');
  });

  it('retains a hidden legacy address alias and shared signer until the last reference is deleted', async () => {
    let deps = dependencies(realm);
    const legacy = { ...a, id: 'legacy-A', networkId: main, hidden: true };
    deps.stored.createAccountWithSigner({
      account: a,
      signer: { id: 'shared', publicKey: a.address, kind: 'external', createdAt: now, updatedAt: now },
      attachedAt: now,
    });
    deps.stored.createAccount(legacy);
    deps.stored.createAccount(b);
    deps.stored.attachSigner(legacy.id, 'shared', now);
    seedAddress(deps, a);
    for (const target of [a, legacy, b]) seedGrants(deps, target);

    deleteLocalAccount(deps, a.id);
    deps.dappPermissions.close();
    realm.close();
    realm = await openWalletRealm({ path });
    deps = dependencies(realm);
    expect(deps.stored.getAccount(a.id)).toBeUndefined();
    expect(deps.stored.getAccount(legacy.id)).toEqual(legacy);
    expect(deps.stored.listSignersForAccount(legacy.id).map(signer => signer.id)).toEqual(['shared']);
    expectAddressPreserved(deps, a);
    for (const networkId of networks) {
      expect(deps.dappPermissions.has({ networkId, origin: origins[0], accountId: a.id })).toBe(false);
      expect(deps.dappPermissions.has({ networkId, origin: origins[0], accountId: legacy.id })).toBe(true);
    }

    deleteLocalAccount(deps, legacy.id);
    deps.dappPermissions.close();
    realm.close();
    realm = await openWalletRealm({ path });
    deps = dependencies(realm);
    expectAddressCleared(deps, a);
    expect(deps.stored.getSigner('shared')).toBeUndefined();
    expect(deps.stored.getAccount(b.id)).toEqual(b);
    for (const networkId of networks) {
      expect(deps.dappPermissions.list(networkId).map(grant => grant.accountId)).toEqual([b.id, b.id]);
    }
  });

  it('cannot repopulate deleted Claimable data or risk marks from a late production-product response', async () => {
    let deps = dependencies(realm);
    deps.stored.createAccount(a);
    deps.stored.createAccount(b);
    seedAddress(deps, a);
    seedGrants(deps, a);
    const accountForSession = deps.repository.getAccount(a.id)!;
    let resolve!: (value: Awaited<ReturnType<ClaimableReadPort['page']>>) => void;
    const page = jest.fn(() => new Promise<Awaited<ReturnType<ClaimableReadPort['page']>>>(done => {
      resolve = done;
    }));
    // The actual product consults the live network-context repository, as App
    // composition does; deletion changes that authority without a test flag.
    const product = createClaimableProduct({
      networkId: test,
      cache: deps.claimableCache,
      now: () => now.getTime(),
      read: { page, byId: async () => undefined },
      getRevision: target => JSON.stringify(
        deps.repository.listAccounts()
          .filter(candidate => candidate.networkId === test && candidate.address === target.address)
          .map(candidate => candidate.id),
      ),
      isAccountCurrent: target => {
        const current = deps.repository.getAccount(target.id);
        return (
          current?.address === target.address && current.identityKind === 'classic' &&
          current.networkId === test && !current.hidden
        );
      },
    });
    const replace = jest.spyOn(deps.claimableCache, 'replace');
    const request = product.refresh(accountForSession, true);
    const retired = expect(request).rejects.toThrow('claimable-reader-retired');
    deleteLocalAccount(deps, a.id);
    resolve({ records: [claim(a)] });
    await retired;
    expect(replace).not.toHaveBeenCalled();
    expect(product.readCached(accountForSession)).toBeUndefined();
    await expect(product.refresh(accountForSession, true)).rejects.toThrow('claimable-account-retired');
    expect(() => product.markSpam(accountForSession, claimId, true)).toThrow('claimable-account-retired');
    expect(page).toHaveBeenCalledTimes(1);
    expectAddressCleared(deps, a);
    product.close();
    deps.dappPermissions.close();
    realm.close();
    realm = await openWalletRealm({ path });
    deps = dependencies(realm);
    expectAddressCleared(deps, a);
    expect(deps.stored.getAccount(a.id)).toBeUndefined();
    expect(deps.stored.getAccount(b.id)).toEqual(b);
  });
});
