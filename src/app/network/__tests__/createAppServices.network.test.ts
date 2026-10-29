import { createAppServices } from '../../createAppServices';
import { deleteLocalAccount } from '@capabilities/account/deleteLocalAccount';
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
let mockAccounts: { networkId: string; id?: string }[] = [];
const mockRepository = {
  listAccounts: () => mockAccounts,
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
  createRealmRecordId: () => 'id',
}));
jest.mock('../../../platform/persistence/realm/RealmNetworkPreferenceStore', () => ({
  openNetworkPreferences: jest.fn(async () => mockPreferenceRealm),
  RealmNetworkPreferenceStore: jest.fn(() => ({ load: () => mockPreferences, save: mockSave })),
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
  mockSave.mockImplementation(next => {
    mockPreferences = next;
  });
  mockProbe.mockImplementation(async () => NETWORKS['stellar-mainnet'].networkPassphrase);
  mockSdk.verifyProtectedSignerPassphrase.mockImplementation(async () => true);
});
describe('production network composition and retirement', () => {
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
    expect(mockWallet.close).not.toHaveBeenCalled();
    expect(mockPreferenceRealm.close).not.toHaveBeenCalled();
    services.close();
    services.close();
    expect(mockWallet.close).toHaveBeenCalledTimes(1);
    expect(mockPreferenceRealm.close).toHaveBeenCalledTimes(1);
  });
  it('blocks switching while native verification is in progress', async () => {
    let finish!: (verified: boolean) => void;
    mockSdk.verifyProtectedSignerPassphrase.mockImplementationOnce(
      () =>
        new Promise<boolean>(resolve => {
          finish = resolve;
        }),
    );
    const services = await createAppServices();
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
    await expect(
      services.networkSettings?.selectNode('stellar-mainnet', NETWORKS['stellar-mainnet'].horizonUrl),
    ).rejects.toThrow('pending-submission');
    await services.networkSettings?.enableDeveloperMode('fresh');
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
      await expect(services.networkSettings?.enableDeveloperMode('unused')).rejects.toThrow(
        'protected-signer-required',
      );
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
