import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Realm from 'realm';
import type { ContractTokenRecord } from '@capabilities/assets/contractAssets';
import { RealmContractAssetStore } from '../RealmContractAssetStore';
import { openWalletRealm } from '../openWalletRealm';
import { CONTRACT_ASSET_ENTITY, WALLET_REALM_SCHEMAS } from '../schemas';
import { RealmAccountSignerRepository } from '../RealmAccountSignerRepository';

const record: ContractTokenRecord = {
  networkId: 'stellar-testnet',
  accountAddress: 'G' + 'A'.repeat(55),
  contractId: 'C' + 'A'.repeat(55),
  metadata: { name: 'Token', symbol: 'TOK', decimals: 7 },
  trackedAt: 100,
  attemptedAt: 101,
  balance: { baseUnits: '1234567890123456789012345678', ledger: 100, observedAt: 101 },
  balanceUnavailable: false,
};

describe('contract tracking on actual Realm', () => {
  let directory: string;
  let path: string;
  let realm: Realm | undefined;
  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), 'fresnica-contract-assets-'));
    path = join(directory, 'wallet.realm');
  });
  afterEach(() => {
    realm?.close();
    realm = undefined;
    rmSync(directory, { recursive: true, force: true });
  });
  afterAll(() => Realm.shutdown());

  it('migrates real v14 data without altering accounts and persists exact partitioned observations across reopen', async () => {
    realm = await Realm.open({
      path,
      schema: [...WALLET_REALM_SCHEMAS.filter(s => s.name !== CONTRACT_ASSET_ENTITY)],
      schemaVersion: 14,
    });
    const account = {
      id: 'a',
      address: record.accountAddress,
      identityKind: 'classic' as const,
      networkId: record.networkId,
      label: 'Preserve',
      sortOrder: 1,
      hidden: false,
      createdAt: new Date(0),
      updatedAt: new Date(0),
    };
    new RealmAccountSignerRepository(realm).createAccount(account);
    realm.close();
    realm = await openWalletRealm({ path });
    expect(realm.schemaVersion).toBe(15);
    expect(new RealmAccountSignerRepository(realm).getAccount('a')).toEqual(account);
    let store = new RealmContractAssetStore(realm);
    const other = { ...record, accountAddress: 'G' + 'B'.repeat(55) };
    const main = { ...record, networkId: 'stellar-mainnet' as const };
    store.replace(record);
    store.replace(other);
    store.replace(main);
    realm.close();
    realm = await openWalletRealm({ path });
    store = new RealmContractAssetStore(realm);
    expect(store.list(record.networkId, record.accountAddress)).toEqual([record]);
    expect(store.list(main.networkId, main.accountAddress)).toEqual([main]);
    store.clearPartition(record.networkId, record.accountAddress);
    expect(store.list(record.networkId, record.accountAddress)).toEqual([]);
    expect(store.list(other.networkId, other.accountAddress)).toEqual([other]);
    expect(store.list(main.networkId, main.accountAddress)).toEqual([main]);
    store.remove(main.networkId, main.accountAddress, main.contractId);
    expect(store.list(main.networkId, main.accountAddress)).toEqual([]);
  });
});
