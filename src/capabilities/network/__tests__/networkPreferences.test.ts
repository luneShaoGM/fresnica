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
  it('retains only the built-in Testnet path without granting developer/custom-node authority', () => {
    const retained = validateNetworkPreferences({
      ...DEFAULT_NETWORK_PREFERENCES,
      retainedTestnet: true,
      networkId: 'stellar-testnet',
    });
    expect(selectedNetwork(retained)).toEqual(NETWORKS['stellar-testnet']);
    expect(isNodeAvailable(retained, 'stellar-testnet', NETWORKS['stellar-testnet'].horizonUrl)).toBe(true);
    expect(isNodeAvailable(retained, 'stellar-testnet', 'https://custom.test')).toBe(false);
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
