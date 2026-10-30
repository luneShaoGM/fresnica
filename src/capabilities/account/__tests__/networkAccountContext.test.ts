import { InMemoryAccountSignerRepository } from '../../../platform/persistence/memory/InMemoryAccountSignerRepository';
import { InMemoryBalanceCacheRepository } from '../../../platform/persistence/memory/InMemoryBalanceCacheRepository';
import { InMemoryPendingSubmissionRepository } from '../../../platform/persistence/memory/InMemoryPendingSubmissionRepository';
import { cacheBalanceSnapshotBestEffort, readBalanceCacheBestEffort } from '../../balance/BalanceCacheHydration';
import { loadBalanceSnapshot } from '../../balance/loadBalanceSnapshot';
import { selectableAccountsForNetwork } from '../../../app/navigation/accountSelection';
import { importSecretAccount } from '../provisionAccount';
import type { FresnicaSdkPort } from '../../ports/FresnicaSdkPort';
import { createNetworkAccountRepository } from '../createNetworkAccountRepository';
import { deleteLocalAccount } from '../deleteLocalAccount';
import type { AccountRecord } from '../types';

const main = 'stellar-mainnet';
const test = 'stellar-testnet';
const now = new Date('2026-10-29T00:00:00Z');
const account: AccountRecord = {
  id: 'wallet',
  address: 'GADDRESS',
  identityKind: 'classic',
  networkId: main,
  label: 'My wallet',
  hidden: false,
  sortOrder: 0,
  createdAt: now,
  updatedAt: now,
};
function setup() {
  const records = new InMemoryAccountSignerRepository();
  records.createAccount(account);
  return {
    records,
    mainnet: createNetworkAccountRepository(records, main),
    testnet: createNetworkAccountRepository(records, test),
  };
}
describe('Classic identity with separate network account contexts', () => {
  it('retains public identity, ID and metadata without mutating or cloning stored rows', () => {
    const { records, mainnet, testnet } = setup();
    expect(mainnet.getAccount(account.id)).toEqual(account);
    expect(testnet.getAccount(account.id)).toEqual({ ...account, networkId: test });
    expect(selectableAccountsForNetwork(testnet.listAccounts(), test).map(item => item.id)).toEqual([account.id]);
    expect(records.listAccounts()).toEqual([account]);
    expect(records.listSigners()).toEqual([]);
    testnet.setAccountLabel(account.id, 'Renamed', now);
    expect(mainnet.getAccount(account.id)?.label).toBe('Renamed');
    testnet.setAccountHidden(account.id, true, now);
    expect(selectableAccountsForNetwork(mainnet.listAccounts(), main)).toEqual([]);
    expect(selectableAccountsForNetwork(testnet.listAccounts(), test)).toEqual([]);
  });
  it('does not project deployed contract identities into another network', () => {
    const { records, testnet } = setup();
    records.createAccount({ ...account, id: 'contract', address: 'CCONTRACT', identityKind: 'contract' });
    expect(testnet.getAccount('contract')?.networkId).toBe(main);
    expect(selectableAccountsForNetwork(testnet.listAccounts(), test).map(item => item.id)).toEqual([account.id]);
  });
  it('keeps legacy same-address records and their distinct metadata and signer references', () => {
    const { records, mainnet, testnet } = setup();
    const legacy = { ...account, id: 'legacy', networkId: test, label: 'Old test wallet', hidden: true };
    records.createAccount(legacy);
    records.createSigner({
      id: 'external',
      publicKey: account.address,
      kind: 'external',
      createdAt: now,
      updatedAt: now,
    });
    records.attachSigner(legacy.id, 'external', now);
    expect(testnet.listAccounts()).toHaveLength(2);
    expect(mainnet.getAccount('legacy')).toMatchObject({ label: legacy.label, hidden: true, networkId: main });
    expect(mainnet.listSignersForAccount(account.id)).toEqual([]);
    expect(testnet.listSignersForAccount(legacy.id).map(item => item.id)).toEqual(['external']);
    expect(records.getAccount('legacy')).toEqual(legacy);
  });
  it('rejects new duplicate imports and incorrect network registrations without adding records', () => {
    const { records, testnet } = setup();
    expect(() => testnet.createAccount({ ...account, id: 'new', networkId: test })).toThrow(
      'duplicate-account-identity',
    );
    expect(() => testnet.createAccount({ ...account, id: 'new', address: 'GOTHER' })).toThrow('network-mismatch');
    expect(records.listAccounts()).toEqual([account]);
  });
  it('upgrades an existing watch-only identity from the new network without cloning its signer', async () => {
    const { records, testnet } = setup();
    const sdk = {
      protectSecret: jest.fn(async () => ({ signerPublicKey: account.address, envelopeJson: '{protected}' })),
      parseAccount: jest.fn(async () => ({ address: account.address, kind: 'classic' })),
    } as unknown as FresnicaSdkPort;
    await importSecretAccount(
      { sdk, repository: testnet, createId: kind => `${kind}-new`, now: () => now },
      {
        secret: 'test-input',
        appPassphrase: 'test-only',
        networkId: test,
      },
    );
    expect(records.listAccounts()).toEqual([account]);
    expect(records.listSigners()).toHaveLength(1);
    expect(testnet.listSignersForAccount(account.id)).toHaveLength(1);
  });
  it('refuses ambiguous legacy watch-only upgrades without picking a signer relationship', async () => {
    const { records, testnet } = setup();
    records.createAccount({ ...account, id: 'legacy', networkId: test });
    const sdk = {
      protectSecret: jest.fn(async () => ({ signerPublicKey: account.address, envelopeJson: '{protected}' })),
      parseAccount: jest.fn(async () => ({ address: account.address, kind: 'classic' })),
    } as unknown as FresnicaSdkPort;
    await expect(
      importSecretAccount(
        { sdk, repository: testnet, createId: kind => `${kind}-new`, now: () => now },
        {
          secret: 'test-input',
          appPassphrase: 'test-only',
          networkId: test,
        },
      ),
    ).rejects.toThrow('account-already-exists');
    expect(records.listSigners()).toEqual([]);
    expect(records.listAccounts()).toHaveLength(2);
  });
  it('reads independent active/inactive states and caches; failures never create an inactive result', async () => {
    const { mainnet, testnet } = setup();
    const cache = new InMemoryBalanceCacheRepository();
    const a = mainnet.getAccount(account.id)!;
    const b = testnet.getAccount(account.id)!;
    const gatewayA = {
      loadAccountBalances: jest.fn(async () => ({
        status: 'active' as const,
        address: account.address,
        balances: [{ kind: 'native' as const, balance: '10' }],
      })),
    };
    const gatewayB = {
      loadAccountBalances: jest.fn(async () => ({ status: 'inactive' as const, address: account.address })),
    };
    const depsA = { networkId: main, gateway: gatewayA, cache, now: () => now };
    const depsB = { networkId: test, gateway: gatewayB, cache, now: () => now };
    const active = await loadBalanceSnapshot(depsA, a);
    cacheBalanceSnapshotBestEffort(depsA, a, active, now);
    expect(readBalanceCacheBestEffort(depsB, b)).toBeUndefined();
    const inactive = await loadBalanceSnapshot(depsB, b);
    expect(inactive.status).toBe('inactive');
    cacheBalanceSnapshotBestEffort(depsB, b, inactive, now);
    expect(readBalanceCacheBestEffort(depsA, a)?.balance).toEqual(active);
    gatewayB.loadAccountBalances.mockRejectedValueOnce(new Error('offline'));
    await expect(loadBalanceSnapshot(depsB, b)).rejects.toThrow('offline');
    await expect(loadBalanceSnapshot(depsB, a)).rejects.toThrow('balance-network-mismatch');
    expect(gatewayB.loadAccountBalances).toHaveBeenCalledTimes(2);
  });
  it('protects unresolved transactions across all contexts and clears both network caches on removal', () => {
    const { records, testnet } = setup();
    const pendingSubmissions = new InMemoryPendingSubmissionRepository();
    pendingSubmissions.create({
      id: `${main}:hash`,
      networkId: main,
      accountId: account.id,
      sourceAddress: account.address,
      transactionHash: 'hash',
      intentKind: 'payment',
      intentKey: 'intent',
      state: 'uncertain',
      createdAt: now,
      updatedAt: now,
    });
    const deps = {
      repository: testnet,
      pendingSubmissions,
      cacheNetworkIds: [main, test],
      balanceCache: { clearPartition: jest.fn() },
      historyCache: { clearPartition: jest.fn() },
    };
    expect(() => deleteLocalAccount(deps, account.id)).toThrow('account-delete-blocked-by-pending-submission');
    expect(deps.balanceCache.clearPartition).not.toHaveBeenCalled();
    pendingSubmissions.markConfirmed(main, 'hash', now);
    deleteLocalAccount(deps, account.id);
    expect(records.getAccount(account.id)).toBeUndefined();
    for (const networkId of [main, test]) {
      expect(deps.balanceCache.clearPartition).toHaveBeenCalledWith({ networkId, accountAddress: account.address });
      expect(deps.historyCache.clearPartition).toHaveBeenCalledWith({ networkId, accountAddress: account.address });
    }
  });
});
