import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Realm from 'realm';
import { openWalletRealm } from '../openWalletRealm';
import {
  ACCOUNT_ENTITY,
  PENDING_SUBMISSION_ENTITY,
  CLAIMABLE_CACHE_ENTITY,
  CLAIMABLE_RISK_OVERRIDE_ENTITY,
  WALLET_REALM_SCHEMAS,
} from '../schemas';
import { RealmClaimableCacheStore } from '../RealmClaimableCacheStore';
import { mapClaimableRecord, type ClaimableSnapshot } from '../../../../capabilities/claimable/records';

const address = 'G' + 'A'.repeat(55);
const second = 'G' + 'B'.repeat(55);
const claimId = '00000000' + 'b'.repeat(64);
const networkId = 'stellar-testnet';

describe('S11 Realm v12 to v13 Claimable public cache migration', () => {
  afterAll(() => Realm.shutdown());

  it('preserves old account and uncertain intent, then stores only isolated public claims and spam override', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'fresnica-s11-'));
    const path = join(directory, 'wallet.realm');
    let realm: Realm | undefined;
    try {
      realm = await Realm.open({
        path,
        schemaVersion: 12,
        schema: WALLET_REALM_SCHEMAS.filter(
          item => item.name !== CLAIMABLE_CACHE_ENTITY && item.name !== CLAIMABLE_RISK_OVERRIDE_ENTITY,
        ),
      });
      realm.write(() => {
        realm!.create(ACCOUNT_ENTITY, {
          id: 'old-account',
          address,
          identityKind: 'classic',
          networkId,
          label: 'Retained',
          sortOrder: 0,
          hidden: false,
          createdAt: new Date(1000),
          updatedAt: new Date(1000),
        });
        realm!.create(PENDING_SUBMISSION_ENTITY, {
          id: 'pending-old',
          networkId,
          accountId: 'old-account',
          sourceAddress: address,
          transactionHash: 'old-hash',
          intentKind: 'send',
          intentKey: 'old-intent',
          state: 'uncertain',
          createdAt: new Date(2000),
          updatedAt: new Date(2000),
        });
      });
      realm.close();
      realm = await openWalletRealm({ path });
      expect(realm.schemaVersion).toBe(13);
      expect(realm.objectForPrimaryKey(ACCOUNT_ENTITY, 'old-account')?.label).toBe('Retained');
      expect(realm.objectForPrimaryKey(PENDING_SUBMISSION_ENTITY, 'pending-old')?.state).toBe('uncertain');
      const cache = new RealmClaimableCacheStore(realm);
      expect(cache.read(networkId, address)).toBeUndefined();

      const record = mapClaimableRecord(
        {
          id: claimId,
          amount: '2.0000000',
          asset: 'native',
          sponsor: second,
          claimants: [{ destination: address, predicate: { unconditional: true } }],
        },
        address,
      );
      const snapshot: ClaimableSnapshot = { networkId, address, savedAt: 3000, records: [record] };
      cache.replace(snapshot);
      cache.setUserSpam(networkId, address, claimId, true);
      expect(cache.read(networkId, address)?.records).toHaveLength(1);
      expect(cache.read('stellar-mainnet', address)).toBeUndefined();
      expect(cache.read(networkId, second)).toBeUndefined();
      expect(cache.userSpam(networkId, address, claimId)).toBe(true);
      expect(cache.userSpam('stellar-mainnet', address, claimId)).toBeUndefined();

      realm.close();
      realm = await openWalletRealm({ path });
      const reopened = new RealmClaimableCacheStore(realm);
      expect(reopened.read(networkId, address)?.records[0].id).toBe(claimId);
      expect(reopened.userSpam(networkId, address, claimId)).toBe(true);
      expect(realm.objectForPrimaryKey(PENDING_SUBMISSION_ENTITY, 'pending-old')?.state).toBe('uncertain');

      realm.write(() => {
        const row = realm!.objectForPrimaryKey(CLAIMABLE_CACHE_ENTITY, JSON.stringify([networkId, address]));
        if (row) row.payloadJson = '{not valid';
      });
      expect(reopened.read(networkId, address)).toBeUndefined();
      expect(reopened.userSpam(networkId, address, claimId)).toBe(true);
      expect(realm.objectForPrimaryKey(ACCOUNT_ENTITY, 'old-account')?.label).toBe('Retained');
    } finally {
      if (realm && !realm.isClosed) realm.close();
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
