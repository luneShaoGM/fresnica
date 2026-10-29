import type Realm from 'realm';

import { RealmDappPermissionStore } from '../RealmDappPermissionStore';
import { DAPP_PERMISSION_GRANT_ENTITY } from '../schemas';

function fakeRealm() {
  const records = new Map<string, Record<string, unknown>>();
  let failWrite = false;
  const realm = {
    objectForPrimaryKey: (_entity: string, id: string) => records.get(id) ?? null,
    objects: () => Array.from(records.values()),
    write: (fn: () => void) => {
      if (failWrite) throw new Error('realm-write-failed');
      fn();
    },
    create: (_entity: string, row: Record<string, unknown>) => {
      records.set(row.id as string, row);
    },
    delete: (row: Record<string, unknown>) => {
      records.delete(row.id as string);
    },
  };
  return {
    realm: realm as unknown as Realm,
    records,
    failWrites: () => {
      failWrite = true;
    },
  };
}

const demo = { origin: 'https://demo.example.org', accountId: 'wallet-1', networkId: 'stellar-testnet' };

describe('S17 durable read grants', () => {
  it('persists only exact origin/account/network tuples and supports precise revoke', () => {
    const fake = fakeRealm();
    const store = new RealmDappPermissionStore(fake.realm);
    expect(store.has(demo)).toBe(false);
    const notifications: string[] = [];
    store.subscribe(event => notifications.push(event.kind));
    store.grant(demo);
    store.grant(demo); // idempotent
    expect(store.has(demo)).toBe(true);
    expect(store.has({ ...demo, origin: 'https://evil.example.org' })).toBe(false);
    expect(store.has({ ...demo, accountId: 'wallet-2' })).toBe(false);
    expect(store.has({ ...demo, networkId: 'stellar-mainnet' })).toBe(false);
    expect(store.list('stellar-mainnet')).toHaveLength(0);
    expect(store.list('stellar-testnet')).toMatchObject([{ origin: demo.origin, accountId: demo.accountId }]);
    expect(notifications).toEqual(['granted']);
    store.revoke(demo);
    expect(store.has(demo)).toBe(false);
    expect(notifications).toEqual(['granted', 'revoked']);
    expect(fake.records.size).toBe(0);
  });

  it('rejects unsafe/noncanonical origins and malformed identities without writing', () => {
    const fake = fakeRealm();
    const store = new RealmDappPermissionStore(fake.realm);
    for (const origin of [
      'http://demo.example.org',
      'https://127.0.0.1',
      'https://demo.example.org/private',
      'https://demo.example.org/',
      'https://localhost',
    ]) {
      expect(() => store.grant({ ...demo, origin })).toThrow('dapp-permission-unavailable');
      expect(store.has({ ...demo, origin })).toBe(false);
    }
    expect(() => store.grant({ ...demo, accountId: 'wallet\n2' })).toThrow('dapp-permission-unavailable');
    expect(fake.records.size).toBe(0);
  });

  it('never notifies a grant or revoke on failed Realm writes and filters corrupted records', () => {
    const fake = fakeRealm();
    const store = new RealmDappPermissionStore(fake.realm);
    const events: string[] = [];
    store.subscribe(event => events.push(event.kind));
    fake.failWrites();
    expect(() => store.grant(demo)).toThrow('realm-write-failed');
    expect(() => store.revoke(demo)).toThrow('realm-write-failed');
    expect(store.has(demo)).toBe(false);
    expect(store.getRevision()).toBe(0);
    expect(events).toEqual([]);
    fake.records.set('tampered', { id: 'tampered', ...demo, createdAt: new Date() });
    expect(store.list('stellar-testnet')).toHaveLength(0);
  });

  it('fails closed when retired and promptly notifies old browser listeners', () => {
    const store = new RealmDappPermissionStore(fakeRealm().realm);
    const events: string[] = [];
    store.subscribe(event => events.push(event.kind));
    store.grant(demo);
    store.close();
    expect(events).toEqual(['granted', 'closed']);
    expect(store.has(demo)).toBe(false);
    expect(() => store.list(demo.networkId)).toThrow('dapp-permission-unavailable');
    expect(() => store.grant(demo)).toThrow('dapp-permission-unavailable');
    expect(() => store.revoke(demo)).toThrow('dapp-permission-unavailable');
  });

  it('does not misreport a committed write when a subscriber throws', () => {
    const store = new RealmDappPermissionStore(fakeRealm().realm);
    store.subscribe(() => {
      throw new Error('observer-error');
    });
    expect(() => store.grant(demo)).not.toThrow();
    expect(store.has(demo)).toBe(true);
    expect(() => store.revoke(demo)).not.toThrow();
    expect(store.has(demo)).toBe(false);
  });

  it('surfaces read failure for the Settings manager instead of falsely reporting no connections', () => {
    const fake = fakeRealm();
    const store = new RealmDappPermissionStore(fake.realm);
    store.grant(demo);
    jest.spyOn(fake.realm, 'objects').mockImplementationOnce(() => {
      throw new Error('realm-unavailable');
    });
    expect(() => store.list('stellar-testnet')).toThrow('dapp-permission-unavailable');
    expect(store.has(demo)).toBe(true);
  });

  it('uses a separate storage entity, never cached catalog data', () => {
    const fake = fakeRealm();
    const store = new RealmDappPermissionStore(fake.realm);
    store.grant(demo);
    const row = [...fake.records.values()][0];
    expect(row.id).toBe(JSON.stringify([demo.networkId, demo.accountId, demo.origin]));
    expect(row).not.toHaveProperty('transactionXdr');
    expect(row).not.toHaveProperty('signer');
    expect(DAPP_PERMISSION_GRANT_ENTITY).not.toBe('DappCatalogCacheEntity');
  });
});
