import {
  DEFAULT_NETWORK_PREFERENCES,
  isNodeAvailable,
  NETWORKS,
  normalizeHorizonEndpoint,
  selectedNetwork,
  validateNetworkPreferences,
} from '../networkPreferences';
describe('network preference trust boundary', () => {
  it('defaults to frozen Mainnet and never relabels accounts', () => {
    expect(selectedNetwork(DEFAULT_NETWORK_PREFERENCES)).toEqual(NETWORKS['stellar-mainnet']);
    expect(Object.isFrozen(validateNetworkPreferences(DEFAULT_NETWORK_PREFERENCES))).toBe(true);
  });
  it('upgrades legacy preferences to automatic public icons without losing a saved user opt-out', () => {
    const legacy = { ...DEFAULT_NETWORK_PREFERENCES, externalTokenImagesEnabled: undefined };
    expect(validateNetworkPreferences(legacy).externalTokenImagesEnabled).toBe(true);
    expect(
      validateNetworkPreferences({ ...legacy, externalTokenImagesEnabled: false }).externalTokenImagesEnabled,
    ).toBe(false);
    expect(validateNetworkPreferences({ ...legacy, externalTokenImagesEnabled: true }).externalTokenImagesEnabled).toBe(
      true,
    );
    expect(() => validateNetworkPreferences({ ...legacy, externalTokenImagesEnabled: 'false' })).toThrow(
      'invalid-network-preferences',
    );
  });

  it('retains only the built-in Testnet path without granting developer/custom-node authority', () => {
    const retained = validateNetworkPreferences({
      ...DEFAULT_NETWORK_PREFERENCES,
      retainedTestnet: true,
      networkId: 'stellar-testnet',
    });
    expect(selectedNetwork(retained)).toEqual(NETWORKS['stellar-testnet']);
    expect(isNodeAvailable(retained, 'stellar-testnet', NETWORKS['stellar-testnet'].horizonUrl)).toBe(true);
    expect(isNodeAvailable(retained, 'stellar-testnet', 'https://custom.test')).toBe(false);
    const mainnetCustom = validateNetworkPreferences({
      ...DEFAULT_NETWORK_PREFERENCES,
      endpoints: { ...DEFAULT_NETWORK_PREFERENCES.endpoints, 'stellar-mainnet': 'https://custom.example' },
      customNodes: { ...DEFAULT_NETWORK_PREFERENCES.customNodes, 'stellar-mainnet': ['https://custom.example'] },
    });
    expect(isNodeAvailable(mainnetCustom, 'stellar-mainnet', 'https://custom.example')).toBe(true);
    expect(selectedNetwork(mainnetCustom).horizonUrl).toBe('https://custom.example');
    expect(
      isNodeAvailable(DEFAULT_NETWORK_PREFERENCES, 'stellar-testnet', NETWORKS['stellar-testnet'].horizonUrl),
    ).toBe(false);
    expect(() => validateNetworkPreferences({ ...retained, retainedTestnet: 'true' })).toThrow(
      'invalid-network-preferences',
    );
    expect(() =>
      validateNetworkPreferences({
        ...retained,
        endpoints: { ...retained.endpoints, 'stellar-testnet': 'https://custom.test' },
        customNodes: { ...retained.customNodes, 'stellar-testnet': ['https://custom.test'] },
      }),
    ).toThrow('invalid-network-preferences');
  });
  it('normalizes HTTPS endpoints without allowing embedded credentials or API tokens', () => {
    expect(normalizeHorizonEndpoint(' https://NODE.example/horizon/// ')).toBe('https://node.example/horizon');
    for (const value of [
      '',
      'http://node.test',
      'https://user:pass@node.test',
      'https://node.test?key=x',
      'https://node.test#x',
      'x'.repeat(2049),
    ])
      expect(() => normalizeHorizonEndpoint(value)).toThrow();
  });
  it('fails closed on corrupted state, hidden Testnet activation and unregistered endpoints', () => {
    for (const value of [
      null,
      {},
      { ...DEFAULT_NETWORK_PREFERENCES, developerMode: 'true' },
      { ...DEFAULT_NETWORK_PREFERENCES, networkId: 'stellar-testnet' },
      {
        ...DEFAULT_NETWORK_PREFERENCES,
        endpoints: { ...DEFAULT_NETWORK_PREFERENCES.endpoints, 'stellar-mainnet': 'https://unknown.test' },
      },
      {
        ...DEFAULT_NETWORK_PREFERENCES,
        customNodes: { 'stellar-mainnet': ['https://same.test/', 'https://same.test'], 'stellar-testnet': [] },
      },
    ])
      expect(() => validateNetworkPreferences(value)).toThrow('invalid-network-preferences');
  });
});

it('keeps legacy account avatars OFF without coupling Token image permission', () => {
  expect(validateNetworkPreferences(DEFAULT_NETWORK_PREFERENCES).externalAccountAvatarsEnabled).not.toBe(true);
  for (const token of [true, false]) {
    expect(
      validateNetworkPreferences({ ...DEFAULT_NETWORK_PREFERENCES, externalTokenImagesEnabled: token })
        .externalAccountAvatarsEnabled,
    ).not.toBe(true);
    expect(
      validateNetworkPreferences({
        ...DEFAULT_NETWORK_PREFERENCES,
        externalTokenImagesEnabled: token,
        externalAccountAvatarsEnabled: true,
        externalAccountAvatarsConsentVersion: 1,
      }).externalAccountAvatarsEnabled,
    ).toBe(true);
  }
  expect(() =>
    validateNetworkPreferences({ ...DEFAULT_NETWORK_PREFERENCES, externalAccountAvatarsEnabled: 'true' }),
  ).toThrow('invalid-network-preferences');
});

it('migrates legacy default-on and explicit-on without disclosure to OFF', () => {
  expect(
    validateNetworkPreferences({ ...DEFAULT_NETWORK_PREFERENCES, externalAccountAvatarsEnabled: true })
      .externalAccountAvatarsEnabled,
  ).toBe(false);
  expect(
    validateNetworkPreferences({
      ...DEFAULT_NETWORK_PREFERENCES,
      externalAccountAvatarsEnabled: false,
      externalAccountAvatarsConsentVersion: 1,
    }).externalAccountAvatarsEnabled,
  ).toBe(false);
  expect(() =>
    validateNetworkPreferences({ ...DEFAULT_NETWORK_PREFERENCES, externalAccountAvatarsConsentVersion: 2 }),
  ).toThrow('invalid-network-preferences');
});
