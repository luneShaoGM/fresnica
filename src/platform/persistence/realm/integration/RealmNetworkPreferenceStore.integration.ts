import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Realm from 'realm';
import { DEFAULT_NETWORK_PREFERENCES } from '@capabilities/network/networkPreferences';
import { openNetworkPreferences, RealmNetworkPreferenceStore } from '../RealmNetworkPreferenceStore';
import { openWalletRealm } from '../openWalletRealm';
import { RealmAccountSignerRepository } from '../RealmAccountSignerRepository';
import { RealmPendingSubmissionRepository } from '../RealmPendingSubmissionRepository';

describe('durable network preferences alongside unchanged wallet partitions', () => {
  let directory: string;
  let wallet: Realm;
  let preferences: Realm;
  beforeEach(async () => {
    directory = mkdtempSync(join(tmpdir(), 'fresnica-network-'));
    wallet = await openWalletRealm({ path: join(directory, 'wallet.realm') });
    preferences = await openNetworkPreferences(wallet.path);
  });
  afterEach(() => {
    if (!wallet.isClosed) wallet.close();
    if (!preferences.isClosed) preferences.close();
    rmSync(directory, { recursive: true, force: true });
  });
  afterAll(() => Realm.shutdown());
  it('reopens mode/node selection and retains original accounts and uncertain hashes across Mainnet/Testnet preferences', async () => {
    const accounts = new RealmAccountSignerRepository(wallet);
    const now = new Date();
    for (const networkId of ['stellar-mainnet', 'stellar-testnet'])
      accounts.createAccount({
        id: networkId,
        address: 'GPUBLIC',
        networkId,
        identityKind: 'classic',
        label: networkId,
        sortOrder: 0,
        hidden: false,
        createdAt: now,
        updatedAt: now,
      });
    new RealmPendingSubmissionRepository(wallet).create({
      id: 'stellar-testnet:hash',
      networkId: 'stellar-testnet',
      accountId: 'stellar-testnet',
      sourceAddress: 'GPUBLIC',
      transactionHash: 'hash',
      intentKind: 'payment',
      intentKey: 'intent',
      state: 'uncertain',
      createdAt: now,
      updatedAt: now,
    });
    const next = {
      ...DEFAULT_NETWORK_PREFERENCES,
      developerMode: true,
      networkId: 'stellar-testnet' as const,
      endpoints: { ...DEFAULT_NETWORK_PREFERENCES.endpoints, 'stellar-testnet': 'https://custom.test' },
      customNodes: { ...DEFAULT_NETWORK_PREFERENCES.customNodes, 'stellar-testnet': ['https://custom.test'] },
    };
    new RealmNetworkPreferenceStore(preferences).save(next);
    const path = wallet.path;
    wallet.close();
    preferences.close();
    wallet = await openWalletRealm({ path });
    preferences = await openNetworkPreferences(path);
    expect(new RealmNetworkPreferenceStore(preferences).load()).toEqual(next);
    new RealmNetworkPreferenceStore(preferences).save(DEFAULT_NETWORK_PREFERENCES);
    expect(
      new RealmAccountSignerRepository(wallet)
        .listAccounts()
        .map(a => a.networkId)
        .sort(),
    ).toEqual(['stellar-mainnet', 'stellar-testnet']);
    expect(new RealmPendingSubmissionRepository(wallet).listUnresolved('stellar-testnet')).toHaveLength(1);
    expect(new RealmPendingSubmissionRepository(wallet).listUnresolved('stellar-mainnet')).toHaveLength(0);
  });
  it('rolls back a failed preference write and rejects corrupted persisted state', () => {
    const store = new RealmNetworkPreferenceStore(preferences);
    expect(store.load()).toBeUndefined();
    store.save(DEFAULT_NETWORK_PREFERENCES);
    const fail = jest.spyOn(preferences, 'create').mockImplementationOnce(() => {
      throw new Error('disk-full');
    });
    expect(() => store.save({ ...DEFAULT_NETWORK_PREFERENCES, developerMode: true })).toThrow('disk-full');
    fail.mockRestore();
    expect(store.load()).toEqual(DEFAULT_NETWORK_PREFERENCES);
    preferences.write(() => {
      preferences.create(
        'NetworkSettingsEntity',
        { id: 'primary', preferencesJson: '{broken' },
        Realm.UpdateMode.Modified,
      );
    });
    expect(() => store.load()).toThrow();
  });
});
