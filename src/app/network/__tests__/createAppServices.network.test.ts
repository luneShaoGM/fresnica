import { leaseSessionServices } from '../../leaseSessionServices';
import { NativeModules } from 'react-native';
import { createAppServices } from '../../createAppServices';
import * as ledgerReadRuntimeModule from '../../readModels/LedgerReadRuntime';
import { deleteLocalAccount } from '@capabilities/account/deleteLocalAccount';
import type { AccountRecord } from '@capabilities/account/types';
import type { ClaimableSnapshot } from '@capabilities/claimable/records';
import {
  NETWORKS,
  DEFAULT_NETWORK_PREFERENCES,
  type NetworkPreferences,
} from '@capabilities/network/networkPreferences';

const mockWallet = { path: '/tmp/wallet.realm', close: jest.fn() };
const mockPreferenceRealm = { close: jest.fn() };
let mockPreferences: NetworkPreferences | undefined;
let mockUnresolved: unknown[] = [];
let mockSigners: { id: string; publicKey: string; kind: string; envelopeJson?: string; backupState?: string }[] = [
  { id: 's', publicKey: 'GS', kind: 'protected-software', envelopeJson: '{encrypted}', backupState: 'confirmed' },
];
let mockAccounts: (Pick<AccountRecord, 'networkId'> & Partial<AccountRecord>)[] = [];
const mockRepository = {
  listAccounts: () => mockAccounts,
  findAccountIdByAddress: (address: string, networkId: string) =>
    mockAccounts.find(account =>
      account.address === address && (account.identityKind === 'classic' || account.networkId === networkId),
    )?.id,
  listSigners: () => mockSigners,
  getAccount: (id: string) => mockAccounts.find(account => account.id === id),
  deleteAccount: (id: string) => {
    mockAccounts = mockAccounts.filter(account => account.id !== id);
  },
};
const mockCatalogRead = jest.fn((networkId: string) => {
  if (networkId !== 'stellar-mainnet') return undefined;
  return {
    schemaVersion: 1 as const,
    networkId,
    savedAtUnixMs: 20,
    entries: [
      { id: 'main', title: 'Main', description: 'Public', category: 'Tools', websiteUrl: 'https://main.example.org/' },
    ],
  };
});
const mockSave = jest.fn((next: NetworkPreferences) => {
  mockPreferences = next;
});
const mockSdk = { verifyProtectedSignerPassphrase: jest.fn(async () => true) };
const mockGateway = {
  isClassicAccountAddress: jest.fn(() => true),
  loadAccountBalances: jest.fn(async () => ({ status: 'inactive', address: 'G' })),
};
const mockStellarConfig = jest.fn();
const mockPathConfig = jest.fn();
const mockProbe = jest.fn(async () => NETWORKS['stellar-mainnet'].networkPassphrase as string);
const mockClaimableSnapshots = new Map<string, ClaimableSnapshot>();
const mockClaimablePage = jest.fn(async () => ({ records: [] }));

jest.mock('@react-native-clipboard/clipboard', () => ({ getString: jest.fn(), setString: jest.fn() }));
jest.mock('react-native-permissions', () => ({
  check: jest.fn(),
  request: jest.fn(),
  openSettings: jest.fn(),
  PERMISSIONS: { IOS: {}, ANDROID: {} },
  RESULTS: {},
}));
jest.mock('../../../platform/fresnica/native', () => ({
  loadNativeFresnicaModule: () => ({}),
  ReactNativeFresnicaSdk: jest.fn(() => mockSdk),
}));
jest.mock('../../../platform/persistence/realm/RealmContactStore', () => ({
  RealmContactStore: jest.fn(() => ({
    list: () => [],
    save: jest.fn(),
    remove: jest.fn(),
    getRevision: () => 0,
    subscribe: () => () => {},
  })),
}));
jest.mock('../../../platform/persistence/realm', () => ({
  openWalletRealm: async () => mockWallet,
  RealmAccountSignerRepository: jest.fn(() => mockRepository),
  RealmLocalePreferenceStore: jest.fn(),
  RealmDefaultAccountPreferenceStore: jest.fn(),
  RealmPendingSubmissionRepository: jest.fn(() => ({
    listUnresolved: (id?: string) =>
      mockUnresolved.filter(record => id === undefined || (record as { networkId: string }).networkId === id),
  })),
  RealmHistoryCacheRepository: jest.fn(),
  RealmBalanceCacheRepository: jest.fn(),
  RealmDappCatalogRepository: jest.fn(() => ({ read: mockCatalogRead, replace: jest.fn() })),
  RealmDappDetailCacheRepository: jest.fn(() => ({ read: jest.fn(), replace: jest.fn() })),
  RealmCuratedSourceCacheRepository: jest.fn(() => ({ read: jest.fn(), replace: jest.fn() })),
  RealmTokenMetadataRepository: jest.fn(() => ({ read: jest.fn(), replace: jest.fn() })),
  RealmDappPermissionStore: jest.fn(() => ({
    close: jest.fn(),
    has: () => false,
    grant: jest.fn(),
    revoke: jest.fn(),
    revokeAccount: jest.fn(),
    list: () => [],
    subscribe: () => () => undefined,
    getRevision: () => 0,
  })),
  createRealmRecordId: () => 'id',
}));
jest.mock('../../../platform/persistence/realm/RealmGeneralPreferenceStore', () => ({ openGeneralPreferences: jest.fn(async () => ({ close: jest.fn() })), RealmGeneralPreferenceStore: jest.fn(() => ({ load: () => undefined, save: jest.fn() })), RealmSecurityPreferenceStore: jest.fn(() => ({ load: () => undefined, save: jest.fn() })) }));
jest.mock('../../../platform/persistence/realm/RealmNetworkPreferenceStore', () => ({
  openNetworkPreferences: jest.fn(async () => mockPreferenceRealm),
  RealmNetworkPreferenceStore: jest.fn(() => ({ load: () => mockPreferences, save: mockSave })),
}));
jest.mock('../../../platform/persistence/realm/RealmClaimableCacheStore', () => ({
  RealmClaimableCacheStore: jest.fn(() => ({
    read: (networkId: string, address: string) => mockClaimableSnapshots.get(JSON.stringify([networkId, address])),
    replace: (snapshot: ClaimableSnapshot) => {
      mockClaimableSnapshots.set(JSON.stringify([snapshot.networkId, snapshot.address]), snapshot);
    },
    userSpam: () => undefined,
    setUserSpam: jest.fn(),
    clearPartition: (networkId: string, address: string) => {
      mockClaimableSnapshots.delete(JSON.stringify([networkId, address]));
    },
  })),
}));
jest.mock('../../../platform/stellar/StellarSdkGateway', () => ({
  StellarSdkGateway: jest.fn((config: unknown) => {
    mockStellarConfig(config);
    return mockGateway;
  }),
}));
jest.mock('../../../platform/stellar/StellarPathPaymentSdkGateway', () => ({
  StellarPathPaymentSdkGateway: jest.fn((config: unknown) => {
    mockPathConfig(config);
    return {};
  }),
}));
jest.mock('../../../platform/stellar/HorizonPublicReadGateway', () => ({
  createHorizonPublicReadGateway: () => ({ probe: mockProbe }),
}));
jest.mock('../../../platform/stellar/HorizonClaimableGateway', () => ({
  createHorizonClaimableGateway: () => ({ page: mockClaimablePage, byId: jest.fn() }),
}));
jest.mock('../../readModels/createForegroundAccountSync', () => ({
  createForegroundAccountSync: () => ({ close: jest.fn() }),
}));
jest.mock('../../readModels/startPostSubmitReadConvergence', () => ({
  startPostSubmitReadConvergence: () => jest.fn(),
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockPreferences = undefined;
  mockAccounts = [];
  mockSigners = [
    { id: 's', publicKey: 'GS', kind: 'protected-software', envelopeJson: '{encrypted}', backupState: 'confirmed' },
  ];
  mockUnresolved = [];
  mockClaimableSnapshots.clear();
  mockClaimablePage.mockReset().mockResolvedValue({ records: [] });
  mockSave.mockImplementation(next => {
    mockPreferences = next;
  });
  mockProbe.mockImplementation(async () => NETWORKS['stellar-mainnet'].networkPassphrase);
  mockSdk.verifyProtectedSignerPassphrase.mockImplementation(async () => true);
});

describe('production Claimable revision composition', () => {
  const account: AccountRecord = {
    id: 'claimable-account',
    networkId: 'stellar-mainnet',
    address: 'G' + 'A'.repeat(55),
    identityKind: 'classic',
    label: 'Claimable account',
    hidden: false,
    sortOrder: 0,
    createdAt: new Date(0),
    updatedAt: new Date(0),
  };
  const snapshot: ClaimableSnapshot = {
    networkId: account.networkId,
    address: account.address,
    savedAt: 1_000,
    records: [],
    everSeen: false,
  };

  beforeEach(() => {
    const createRuntime = ledgerReadRuntimeModule.createLedgerReadRuntime;
    jest.spyOn(ledgerReadRuntimeModule, 'createLedgerReadRuntime').mockImplementation(() => {
      const runtime = createRuntime();
      // Start with real accounts and no node-recovery invalidation events.
      runtime.update({ foreground: true, connectivity: 'offline' });
      return runtime;
    });
    jest.spyOn(Date, 'now').mockReturnValue(2_000);
    mockAccounts = [account];
    mockClaimableSnapshots.set(JSON.stringify([account.networkId, account.address]), snapshot);
  });

  afterEach(() => jest.restoreAllMocks());

  it('reuses a one-second-old persisted snapshot before and after service recreation without invalidation', async () => {
    for (let restart = 0; restart < 2; restart += 1) {
      const services = await createAppServices();
      try {
        expect(services.ledgerReadInvalidation.getRevision(account.networkId, account.id)).toBe(0);
        expect(services.claimables.readCached(account)).toEqual({ snapshot, stale: false, refreshFailed: false });
        expect(await services.claimables.refresh(account)).toEqual({ snapshot, stale: false, refreshFailed: false });
        expect(mockClaimablePage).not.toHaveBeenCalled();
        expect(mockProbe).not.toHaveBeenCalled();
      } finally {
        services.close();
      }
    }
  });

  it('honors invalidation before the first cache read and permits a new revision to bypass failure cooldown', async () => {
    const services = await createAppServices();
    try {
      const invalidation = {
        networkId: account.networkId,
        accountId: account.id,
        transactionHash: 'a'.repeat(64),
      };
      services.ledgerReadInvalidation.invalidate(invalidation);
      expect(services.claimables.readCached(account)).toEqual({ snapshot, stale: true, refreshFailed: false });

      const ready = new Promise<void>(resolve => {
        const stop = services.nodeReadSession.subscribe(() => {
          if (services.nodeReadSession.getSnapshot().phase === 'healthy') {
            stop();
            resolve();
          }
        });
      });
      services.ledgerReadRuntime.update({ foreground: true, connectivity: 'online' });
      await ready;
      mockClaimablePage.mockRejectedValueOnce(new Error('claimable-read-failed'));
      expect(await services.claimables.refresh(account)).toEqual({ snapshot, stale: true, refreshFailed: true });
      expect(await services.claimables.refresh(account)).toEqual({ snapshot, stale: true, refreshFailed: true });
      expect(mockClaimablePage).toHaveBeenCalledTimes(1);

      services.ledgerReadInvalidation.invalidate({ ...invalidation, transactionHash: 'b'.repeat(64) });
      const refreshed = await services.claimables.refresh(account);
      expect(refreshed).toEqual({ snapshot: { ...snapshot, savedAt: 2_000 }, stale: false, refreshFailed: false });
      expect(await services.claimables.refresh(account)).toEqual(refreshed);
      expect(mockClaimablePage).toHaveBeenCalledTimes(2);
    } finally {
      services.close();
    }
  });

  it('tracks every same-address alias while keeping other addresses and networks isolated', async () => {
    const alias = { ...account, id: 'claimable-alias' };
    const other = { ...account, id: 'other-account', address: 'G' + 'B'.repeat(55) };
    mockAccounts = [account, alias, other];
    const services = await createAppServices();
    try {
      expect(services.claimables.readCached(account)?.stale).toBe(false);
      services.ledgerReadInvalidation.refresh({
        networkId: 'stellar-testnet', accountId: account.id, reason: 'manual-refresh',
      });
      services.ledgerReadInvalidation.refresh({
        networkId: other.networkId, accountId: other.id, reason: 'manual-refresh',
      });
      expect(services.claimables.readCached(account)?.stale).toBe(false);

      services.ledgerReadInvalidation.refresh({
        networkId: alias.networkId, accountId: alias.id, reason: 'account-effects',
      });
      expect(services.claimables.readCached(account)?.stale).toBe(true);
      expect(services.claimables.readCached(alias)?.stale).toBe(true);
    } finally {
      services.close();
    }
  });
});

describe('production network composition and retirement', () => {
  it('wires default-on external icons to wallet-wide privacy preference across service restart', async () => {
    const modules = NativeModules as Record<string, unknown>;
    const original = modules.SecureAssetFetch;
    const openIconCache = jest.fn(async () => 'lease');
    const closeIconCache = jest.fn(async () => {
      throw new Error('failed cache purge');
    });
    modules.SecureAssetFetch = {
      fetch: jest.fn(),
      cancel: jest.fn(),
      openIconCache,
      closeIconCache,
      readIconCache: jest.fn(),
      writeIconCache: jest.fn(),
      removeIconCache: jest.fn(),
    };
    const settleCache = () => new Promise<void>(resolve => setImmediate(resolve));
    try {
      const first = await createAppServices();
      expect(first.tokenIcons.available).toBe(true);
      expect(first.tokenIcons.getSnapshot().enabled).toBe(true);
      const settings = first.networkSettings;
      expect(settings).toBeDefined();
      await settleCache();
      expect(openIconCache).toHaveBeenCalledWith('0');
      await settings?.setExternalTokenImagesEnabled(false);
      expect(first.tokenIcons.getSnapshot().enabled).toBe(false);
      expect(mockSave).toHaveBeenCalledWith(
        expect.objectContaining({ externalTokenImagesEnabled: false, tokenIconCacheEpoch: 1 }),
      );
      await settleCache();
      expect(closeIconCache).toHaveBeenCalledWith('lease', true);
      await settings?.setExternalTokenImagesEnabled(true);
      first.close();

      openIconCache.mockClear();
      const restarted = await createAppServices();
      expect(restarted.tokenIcons.available).toBe(true);
      expect(restarted.tokenIcons.getSnapshot().enabled).toBe(true);
      await settleCache();
      expect(openIconCache.mock.calls).toEqual([['1']]);
      restarted.close();
    } finally {
      if (original === undefined) delete modules.SecureAssetFetch;
      else modules.SecureAssetFetch = original;
    }
  });

  it('exposes current Classic contexts to every consumer without fabricating retained Testnet access', async () => {
    mockPreferences = { ...DEFAULT_NETWORK_PREFERENCES, developerMode: true, networkId: 'stellar-testnet' };
    mockAccounts = [
      {
        id: 'main-wallet',
        networkId: 'stellar-mainnet',
        identityKind: 'classic',
        address: 'GMAIN',
      } as (typeof mockAccounts)[number],
    ];
    const services = await createAppServices();
    expect(services.onboarding.repository.getAccount('main-wallet')).toMatchObject({
      networkId: 'stellar-testnet',
      address: 'GMAIN',
    });
    expect(services.send.repository).toBe(services.onboarding.repository);
    expect(services.trustline.repository).toBe(services.onboarding.repository);
    expect(services.swapExecution.signerRepository).toBe(services.onboarding.repository);
    expect(services.accountManagement.repository).toBe(services.onboarding.repository);
    expect(services.networkSettings?.getSnapshot().preferences.retainedTestnet).toBeUndefined();
    expect(mockAccounts[0].networkId).toBe('stellar-mainnet');
    services.close();
  });
  it.each([false, true])(
    'revokes retention after deleting the last Testnet account (Mainnet account=%s)',
    async mainnet => {
      mockPreferences = { ...DEFAULT_NETWORK_PREFERENCES, networkId: 'stellar-testnet', retainedTestnet: true };
      mockAccounts = [
        { id: 'old', networkId: 'stellar-testnet' },
        ...(mainnet ? [{ id: 'main', networkId: 'stellar-mainnet' }] : []),
      ];
      mockUnresolved = [
        { accountId: 'main', networkId: 'stellar-mainnet', transactionHash: 'unchanged', state: 'uncertain' },
      ];
      const changed = jest.fn();
      const services = await createAppServices({ onNetworkChanged: changed });
      deleteLocalAccount(services.accountManagement, 'old');
      expect(changed).toHaveBeenCalledTimes(1);
      expect(() =>
        services.onboarding.sdk.verifyProtectedSignerPassphrase({
          envelopeJson: '',
          appPassphrase: '',
          expectedSignerPublicKey: '',
        }),
      ).toThrow('network-session-retired');
      const reopened = await createAppServices();
      expect(reopened.onboarding.networkId).toBe('stellar-mainnet');
      expect(reopened.networkSettings?.getSnapshot().preferences.selectionConfirmed).toBe(false);
      expect(mockPreferences?.retainedTestnet).toBeUndefined();
      expect(mockPreferences?.networkId).toBe('stellar-mainnet');
      await expect(
        reopened.networkSettings?.selectNode('stellar-testnet', NETWORKS['stellar-testnet'].horizonUrl),
      ).rejects.toThrow('developer-mode-required');
      expect(mockUnresolved).toEqual([
        { accountId: 'main', networkId: 'stellar-mainnet', transactionHash: 'unchanged', state: 'uncertain' },
      ]);
      reopened.close();
      const relaunched = await createAppServices();
      expect(relaunched.onboarding.networkId).toBe('stellar-mainnet');
      relaunched.close();
    },
  );
  it('reconciles a stale flag on cold start and fails closed if saving that correction fails', async () => {
    mockPreferences = { ...DEFAULT_NETWORK_PREFERENCES, networkId: 'stellar-testnet', retainedTestnet: true };
    mockSave.mockImplementationOnce(() => {
      throw new Error('disk-full');
    });
    await expect(createAppServices()).rejects.toThrow('disk-full');
    expect(mockStellarConfig).not.toHaveBeenCalled();
    const services = await createAppServices();
    expect(services.onboarding.networkId).toBe('stellar-mainnet');
    expect(mockPreferences?.retainedTestnet).toBeUndefined();
    services.close();
  });
  it('keeps an accountless unresolved Testnet record intact and blocks startup rather than abandoning it', async () => {
    mockPreferences = { ...DEFAULT_NETWORK_PREFERENCES, networkId: 'stellar-testnet', retainedTestnet: true };
    mockUnresolved = [{ networkId: 'stellar-testnet', transactionHash: 'original', state: 'uncertain' }];
    await expect(createAppServices()).rejects.toThrow('pending-submission');
    expect(mockSave).not.toHaveBeenCalled();
    expect(mockUnresolved).toHaveLength(1);
  });
  it('preserves retained access and recovery when another Testnet account remains, and blocks deleting its pending account', async () => {
    mockPreferences = { ...DEFAULT_NETWORK_PREFERENCES, networkId: 'stellar-testnet', retainedTestnet: true };
    mockAccounts = [
      { id: 'old', networkId: 'stellar-testnet' },
      { id: 'remaining', networkId: 'stellar-testnet' },
    ];
    mockUnresolved = [
      { accountId: 'remaining', networkId: 'stellar-testnet', transactionHash: 'original', state: 'uncertain' },
    ];
    const changed = jest.fn();
    const services = await createAppServices({ onNetworkChanged: changed });
    deleteLocalAccount(services.accountManagement, 'old');
    expect(() => deleteLocalAccount(services.accountManagement, 'remaining')).toThrow(
      'account-delete-blocked-by-pending-submission',
    );
    expect(changed).not.toHaveBeenCalled();
    expect(services.networkSettings?.getSnapshot().preferences.retainedTestnet).toBe(true);
    expect(mockUnresolved).toHaveLength(1);
    services.close();
  });
  it('keeps authenticated Developer Mode Testnet onboarding after the last account is deleted', async () => {
    mockPreferences = {
      ...DEFAULT_NETWORK_PREFERENCES,
      developerMode: true,
      networkId: 'stellar-testnet',
      retainedTestnet: true,
    };
    mockAccounts = [{ id: 'old', networkId: 'stellar-testnet' }];
    const services = await createAppServices();
    deleteLocalAccount(services.accountManagement, 'old');
    const reopened = await createAppServices();
    expect(reopened.onboarding.networkId).toBe('stellar-testnet');
    expect(mockPreferences).toMatchObject({ developerMode: true, networkId: 'stellar-testnet' });
    expect(mockPreferences?.retainedTestnet).toBeUndefined();
    reopened.close();
  });
  it('binds public dApp cache to the selected network profile and closes it with its service generation', async () => {
    const mainnet = await createAppServices();
    expect(mainnet.networkProfile.id).toBe('stellar-mainnet');
    expect(mainnet.dappCatalog.readCached?.()).toMatchObject({
      kind: 'ready',
      stale: true,
      entries: [{ id: 'main' }],
    });
    expect(mockCatalogRead).toHaveBeenLastCalledWith('stellar-mainnet');
    mainnet.close();
    expect(mainnet.dappCatalog.readCached?.()).toEqual({ kind: 'unavailable' });

    mockPreferences = {
      ...DEFAULT_NETWORK_PREFERENCES,
      networkId: 'stellar-testnet',
      developerMode: true,
    };
    const testnet = await createAppServices();
    expect(testnet.networkProfile.id).toBe('stellar-testnet');
    expect(testnet.dappCatalog.readCached?.()).toEqual({ kind: 'unavailable' });
    expect(mockCatalogRead).toHaveBeenLastCalledWith('stellar-testnet');
    testnet.close();
  });

  it('binds every transaction consumer and the public-read session to the same Mainnet profile', async () => {
    const services = await createAppServices();
    const network = { id: 'stellar-mainnet', networkPassphrase: NETWORKS['stellar-mainnet'].networkPassphrase };
    expect(mockStellarConfig).toHaveBeenCalledWith({ network, horizonUrl: NETWORKS['stellar-mainnet'].horizonUrl });
    expect(mockPathConfig).toHaveBeenCalledWith({ network, horizonUrl: NETWORKS['stellar-mainnet'].horizonUrl });
    for (const consumer of [
      services.send,
      services.trustline,
      services.request,
      services.swapPreview,
      services.swapExecution,
    ])
      expect(consumer.network).toEqual(network);
    expect(services.swapPreview.balance.gateway).toBe(services.send.gateway);
    expect(services.trustline.gateway).toBe(services.send.gateway);
    expect(services.request.gateway).toBe(services.send.gateway);
    expect(services.swapExecution.gateway).toBe(services.send.gateway);
    expect(services.nodeReadSession.getSnapshot().endpoint).toBe(services.networkProfile.horizonUrl);
    services.close();
    services.close();
    expect(mockWallet.close).toHaveBeenCalledTimes(1);
    expect(mockPreferenceRealm.close).toHaveBeenCalledTimes(1);
  });
  it('retains unresolved Testnet recovery, blocks leaving it, and allows verified same-network fallback', async () => {
    mockPreferences = {
      ...DEFAULT_NETWORK_PREFERENCES,
      developerMode: true,
      networkId: 'stellar-testnet',
      endpoints: { ...DEFAULT_NETWORK_PREFERENCES.endpoints, 'stellar-testnet': 'https://custom.test' },
      customNodes: { ...DEFAULT_NETWORK_PREFERENCES.customNodes, 'stellar-testnet': ['https://custom.test'] },
    };
    mockProbe.mockImplementation(async () => NETWORKS['stellar-testnet'].networkPassphrase);
    const changed = jest.fn();
    const services = await createAppServices({ onNetworkChanged: changed });
    expect(mockStellarConfig).toHaveBeenCalledWith({
      network: services.send.network,
      horizonUrl: 'https://custom.test',
    });
    expect(mockPathConfig).toHaveBeenCalledWith({ network: services.send.network, horizonUrl: 'https://custom.test' });
    mockUnresolved = [{ networkId: 'stellar-testnet', transactionHash: 'original', state: 'uncertain' }];
    await expect(
      services.networkSettings?.selectNode('stellar-mainnet', NETWORKS['stellar-mainnet'].horizonUrl),
    ).rejects.toThrow('pending-submission');
    expect(changed).not.toHaveBeenCalled();
    expect(mockSave).not.toHaveBeenCalled();
    await services.networkSettings?.selectNode('stellar-testnet', NETWORKS['stellar-testnet'].horizonUrl);
    expect(changed).toHaveBeenCalledTimes(1);
    expect(mockUnresolved).toEqual([{ networkId: 'stellar-testnet', transactionHash: 'original', state: 'uncertain' }]);
    expect(() => services.send.gateway.isClassicAccountAddress('G')).toThrow('network-session-retired');
    expect(() =>
      services.contacts.store.save({ id: 'late', networkId: 'stellar-testnet', address: 'G', name: 'Late' }),
    ).toThrow('network-session-retired');
    expect(() => services.contacts.store.remove('stellar-testnet', 'late')).toThrow('network-session-retired');
    expect(services.contacts.isClassicAccountAddress('G')).toBe(false);
    expect(services.contacts.store.getRevision()).toBe(0);
    expect(mockWallet.close).not.toHaveBeenCalled();
    expect(mockPreferenceRealm.close).not.toHaveBeenCalled();
    services.close();
    services.close();
    expect(mockWallet.close).toHaveBeenCalledTimes(1);
    expect(mockPreferenceRealm.close).toHaveBeenCalledTimes(1);
  });
  it('blocks switching while native verification is in progress', async () => {
    const services = await createAppServices();
    services.applicationSession?.setForeground(true);
    await services.applicationSession?.unlock('fixture App Passphrase');
    let finish!: (verified: boolean) => void;
    mockSdk.verifyProtectedSignerPassphrase.mockImplementationOnce(
      () =>
        new Promise<boolean>(resolve => {
          finish = resolve;
        }),
    );
    const verification = services.security.sdk.verifyProtectedSignerPassphrase({
      envelopeJson: '{encrypted}',
      appPassphrase: 'fresh',
      expectedSignerPublicKey: 'GS',
    });
    await expect(
      services.networkSettings?.selectNode('stellar-mainnet', NETWORKS['stellar-mainnet'].horizonUrl),
    ).rejects.toThrow('network-session-busy');
    finish(true);
    await verification;
    services.close();
  });
  it('requires an explicit first network choice for legacy Testnet accounts and preserves pending recovery', async () => {
    mockAccounts = [{ networkId: 'stellar-testnet' }];
    mockUnresolved = [{ networkId: 'stellar-testnet', transactionHash: 'old', state: 'uncertain' }];
    const services = await createAppServices();
    expect(services.networkSettings?.getSnapshot().preferences.selectionConfirmed).toBe(false);
    services.applicationSession?.setForeground(true);
    await services.applicationSession?.unlock('fixture App Passphrase');
    await expect(
      services.networkSettings?.selectNode('stellar-mainnet', NETWORKS['stellar-mainnet'].horizonUrl),
    ).rejects.toThrow('pending-submission');
    await services.networkSettings?.enableDeveloperMode();
    expect(mockPreferences?.selectionConfirmed).toBe(false);
    mockProbe.mockImplementation(async () => NETWORKS['stellar-testnet'].networkPassphrase);
    await services.networkSettings?.selectNode('stellar-testnet', NETWORKS['stellar-testnet'].horizonUrl);
    expect(mockPreferences).toMatchObject({ selectionConfirmed: true, networkId: 'stellar-testnet' });
    expect(mockUnresolved).toHaveLength(1);
  });
  it.each([
    ['watch-only', false],
    ['watch-only', true],
    ['external-only', false],
    ['external-only', true],
  ] as const)(
    'restores an existing %s Testnet partition without Developer Mode (pending=%s)',
    async (kind, pending) => {
      mockAccounts = [{ networkId: 'stellar-testnet' }];
      mockSigners = kind === 'watch-only' ? [] : [{ id: 'hardware', publicKey: 'GX', kind: 'external' }];
      mockUnresolved = pending
        ? [{ networkId: 'stellar-testnet', transactionHash: 'original', state: 'uncertain' }]
        : [];
      const accounts = mockAccounts;
      const signers = mockSigners;
      const unresolved = mockUnresolved;
      const services = await createAppServices();
      expect(services.networkSettings?.getSnapshot().preferences).toMatchObject({
        selectionConfirmed: false,
        developerMode: false,
        retainedTestnet: true,
      });
      if (pending)
        await expect(
          services.networkSettings?.selectNode('stellar-mainnet', NETWORKS['stellar-mainnet'].horizonUrl),
        ).rejects.toThrow('pending-submission');
      mockProbe.mockImplementation(async () => NETWORKS['stellar-testnet'].networkPassphrase);
      await services.networkSettings?.selectNode('stellar-testnet', NETWORKS['stellar-testnet'].horizonUrl);
      expect(mockPreferences).toMatchObject({
        networkId: 'stellar-testnet',
        selectionConfirmed: true,
        developerMode: false,
        retainedTestnet: true,
      });
      const reopened = await createAppServices();
      expect(reopened.networkProfile).toEqual(NETWORKS['stellar-testnet']);
      expect(reopened.networkSettings?.getSnapshot().preferences.selectionConfirmed).toBe(true);
      await expect(reopened.networkSettings?.addNode('stellar-testnet', 'https://custom.test')).rejects.toThrow(
        'developer-mode-required',
      );
      expect(mockSdk.verifyProtectedSignerPassphrase).not.toHaveBeenCalled();
      expect(mockAccounts).toBe(accounts);
      expect(mockSigners).toBe(signers);
      expect(mockUnresolved).toBe(unresolved);
      reopened.close();
    },
  );
  it('keeps helper network choice explicit and separate from production preferences', async () => {
    const services = await createAppServices({ fixedNetwork: 'stellar-testnet' });
    expect(services.send.network.id).toBe('stellar-testnet');
    expect(services.networkSettings).toBeUndefined();
    expect(mockPathConfig).toHaveBeenCalledWith({
      network: services.send.network,
      horizonUrl: NETWORKS['stellar-testnet'].horizonUrl,
    });
    services.close();
  });
});

it('wires independent default-OFF account avatars to durable permission and app retirement', async () => {
  const modules = NativeModules as Record<string, unknown>;
  const original = modules.SecureAssetFetch;
  const fetch = jest.fn();
  modules.SecureAssetFetch = { fetch, cancel: jest.fn() };
  try {
    const first = await createAppServices();
    expect(first.accountAvatars?.getSnapshot().enabled).toBe(false);
    await first.networkSettings?.setExternalTokenImagesEnabled(false);
    expect(first.accountAvatars?.getSnapshot().enabled).toBe(false);
    await first.networkSettings?.setExternalAccountAvatarsEnabled(true, true);
    expect(first.accountAvatars?.getSnapshot()).toMatchObject({ enabled: true, readable: true });
    first.ledgerReadRuntime.update({ foreground: false, connectivity: 'online' });
    expect(first.accountAvatars?.getSnapshot().readable).toBe(false);
    first.close();
    expect(first.accountAvatars?.getSnapshot().enabled).toBe(false);
    const restarted = await createAppServices();
    expect(restarted.accountAvatars?.getSnapshot().enabled).toBe(true);
    expect(restarted.tokenIcons.getSnapshot().enabled).toBe(false);
    restarted.ledgerReadRuntime.update({ foreground: true, connectivity: 'offline' });
    expect(restarted.accountAvatars?.getSnapshot().readable).toBe(false);
    restarted.ledgerReadRuntime.update({ foreground: true, connectivity: 'online' });
    expect(restarted.accountAvatars?.getSnapshot().readable).toBe(true);
    await restarted.networkSettings?.setExternalAccountAvatarsEnabled(false);
    restarted.close();
    const off = await createAppServices();
    expect(off.accountAvatars?.getSnapshot().enabled).toBe(false);
    off.close();
    expect(fetch).not.toHaveBeenCalled();
  } finally {
    if (original === undefined) delete modules.SecureAssetFetch;
    else modules.SecureAssetFetch = original;
  }
});

it('production SDK is inaccessible before session unlock and after manual lock', async () => {
  const services = await createAppServices();
  expect(services.applicationSession?.getSnapshot().locked).toBe(true);
  const input = { envelopeJson: '{encrypted}', appPassphrase: 'fixture phrase', expectedSignerPublicKey: 'GS' };
  expect(() => services.security.sdk.verifyProtectedSignerPassphrase(input)).toThrow('application-session-locked');
  expect(mockSdk.verifyProtectedSignerPassphrase).not.toHaveBeenCalled();
  services.applicationSession?.setForeground(true);
  await services.applicationSession?.unlock('fixture phrase');
  await expect(services.security.sdk.verifyProtectedSignerPassphrase(input)).resolves.toBe(true);
  services.applicationSession?.lock();
  expect(() => services.security.sdk.verifyProtectedSignerPassphrase(input)).toThrow('application-session-locked');
  services.close();
});

it('leases every product SDK before work so an old screen cannot reuse a later unlock', async () => {
  const services = await createAppServices();
  const access = services.applicationSession!;
  access.setForeground(true);
  await access.unlock('fixture phrase');
  const old = leaseSessionServices(services, access.getSnapshot().revision);
  access.lock();
  await access.unlock('fixture phrase');
  const input = { envelopeJson: '{encrypted}', appPassphrase: 'fixture phrase', expectedSignerPublicKey: 'GS' };
  const before = mockSdk.verifyProtectedSignerPassphrase.mock.calls.length;
  for (const dependencies of [
    old.onboarding,
    old.security,
    old.send,
    old.trustline,
    old.swapExecution,
    old.claimableTransaction,
  ]) {
    expect(() => dependencies.sdk.verifyProtectedSignerPassphrase(input)).toThrow('session-retired');
  }
  expect(mockSdk.verifyProtectedSignerPassphrase).toHaveBeenCalledTimes(before);
  const fresh = leaseSessionServices(services, access.getSnapshot().revision);
  await expect(fresh.send.sdk.verifyProtectedSignerPassphrase(input)).resolves.toBe(true);
  services.close();
});

it('confirmed network selection preserves App browsing access, retires old services and cold relaunch still locks', async () => {
  mockPreferences = { ...DEFAULT_NETWORK_PREFERENCES, developerMode: true };
  const changed = jest.fn();
  const previous = await createAppServices({ onNetworkChanged: changed });
  previous.applicationSession!.setForeground(true);
  await previous.applicationSession!.unlock('fixture phrase');
  mockSdk.verifyProtectedSignerPassphrase.mockClear();
  mockProbe.mockResolvedValueOnce(NETWORKS['stellar-testnet'].networkPassphrase);
  await previous.networkSettings!.selectNode('stellar-testnet', NETWORKS['stellar-testnet'].horizonUrl);
  const continuation = changed.mock.calls[0][0];
  expect(continuation).toBeDefined();
  const next = await createAppServices({ networkAccessContinuation: continuation });
  next.applicationSession!.setForeground(true);
  expect(next.networkProfile.id).toBe('stellar-testnet');
  expect(next.applicationSession!.getSnapshot().locked).toBe(false);
  expect(mockSdk.verifyProtectedSignerPassphrase).not.toHaveBeenCalled();
  expect(() => previous.security.sdk.verifyProtectedSignerPassphrase({} as never)).toThrow('network-session-retired');
  const cold = await createAppServices();
  expect(cold.applicationSession!.getSnapshot().locked).toBe(true);
  previous.close();
  next.close();
  cold.close();
});

it.each(['protected-software', 'watch-only', 'external-only'])(
  'enables Developer Mode for %s without SDK authorization, network restart or granting App access',
  async kind => {
    if (kind === 'watch-only') mockSigners = [];
    if (kind === 'external-only') mockSigners = [{ id: 'external', publicKey: 'GX', kind: 'external' }];
    mockPreferences = { ...DEFAULT_NETWORK_PREFERENCES };
    const changed = jest.fn();
    const services = await createAppServices({ onNetworkChanged: changed });
    const locked = services.applicationSession!.getSnapshot().locked;
    mockSdk.verifyProtectedSignerPassphrase.mockClear();
    await services.networkSettings!.enableDeveloperMode();
    expect(mockPreferences).toMatchObject({ developerMode: true, networkId: 'stellar-mainnet' });
    expect(mockSdk.verifyProtectedSignerPassphrase).not.toHaveBeenCalled();
    expect(services.applicationSession!.getSnapshot().locked).toBe(locked);
    expect(changed).not.toHaveBeenCalled();
    services.close();
  },
);

it('composes saved uniform avatar policy without changing account or token authority', async () => {
  const original = NativeModules.SecureAssetFetch;
  const fetch = jest.fn();
  NativeModules.SecureAssetFetch = { fetch, cancel: jest.fn() };
  const account: AccountRecord = {
    id: 'avatar-first', address: 'G' + 'A'.repeat(55), identityKind: 'classic',
    networkId: 'stellar-mainnet', label: 'First', sortOrder: 0, hidden: false,
    createdAt: new Date(0), updatedAt: new Date(0),
  };
  const second: AccountRecord = { ...account, id: 'avatar-second', address: 'G' + 'B'.repeat(55) };
  mockAccounts = [account, second];
  mockPreferences = { ...DEFAULT_NETWORK_PREFERENCES, externalAccountAvatarsEnabled: true, externalAccountAvatarsConsentVersion: 2 };
  try {
    const first = await createAppServices();
    const displayed = [account.address, second.address, 'G' + 'C'.repeat(55), 'M' + 'D'.repeat(68)];
    for (const address of displayed) expect(first.accountAvatars?.allowsOnline(address)).toBe(true);
    expect(first.tokenIcons.getSnapshot().enabled).toBe(true);
    first.close();
    const restored = await createAppServices();
    expect(restored.accountAvatars?.allowsOnline(account.address)).toBe(true);
    await restored.networkSettings?.setExternalAccountAvatarsEnabled(false);
    for (const address of displayed) expect(restored.accountAvatars?.allowsOnline(address)).toBe(false);
    restored.close();
    expect(fetch).not.toHaveBeenCalled();
  } finally {
    if (original === undefined) delete NativeModules.SecureAssetFetch;
    else NativeModules.SecureAssetFetch = original;
  }
});
