import { createAppServices } from '../../createAppServices';
import {
  NETWORKS,
  DEFAULT_NETWORK_PREFERENCES,
  type NetworkPreferences,
} from '@capabilities/network/networkPreferences';

const mockWallet = { path: '/tmp/wallet.realm', close: jest.fn() };
const mockPreferenceRealm = { close: jest.fn() };
let mockPreferences: NetworkPreferences | undefined;
let mockUnresolved: unknown[] = [];
const mockSigners = [
  { id: 's', publicKey: 'GS', kind: 'protected-software', envelopeJson: '{encrypted}', backupState: 'confirmed' },
];
let mockAccounts: { networkId: string }[] = [];
const mockRepository = { listAccounts: () => mockAccounts, listSigners: () => mockSigners };
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
  mockUnresolved = [];
  mockSave.mockImplementation(next => {
    mockPreferences = next;
  });
  mockProbe.mockImplementation(async () => NETWORKS['stellar-mainnet'].networkPassphrase);
  mockSdk.verifyProtectedSignerPassphrase.mockImplementation(async () => true);
});
describe('production network composition and retirement', () => {
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
