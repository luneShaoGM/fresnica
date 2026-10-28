export type NetworkId = 'stellar-mainnet' | 'stellar-testnet';
export const NETWORKS = Object.freeze({
  'stellar-mainnet': Object.freeze({
    id: 'stellar-mainnet' as const,
    isMainnet: true,
    horizonUrl: 'https://horizon.stellar.org',
    networkPassphrase: 'Public Global Stellar Network ; September 2015',
  }),
  'stellar-testnet': Object.freeze({
    id: 'stellar-testnet' as const,
    isMainnet: false,
    horizonUrl: 'https://horizon-testnet.stellar.org',
    networkPassphrase: 'Test SDF Network ; September 2015',
  }),
});
export type NetworkProfile = Readonly<{
  id: NetworkId;
  isMainnet: boolean;
  horizonUrl: string;
  networkPassphrase: string;
}>;
export type NetworkPreferences = Readonly<{
  developerMode: boolean;
  selectionConfirmed: boolean;
  networkId: NetworkId;
  endpoints: Readonly<Record<NetworkId, string>>;
  customNodes: Readonly<Record<NetworkId, readonly string[]>>;
}>;
export type NetworkPreferenceStore = Readonly<{
  load: () => NetworkPreferences | undefined;
  save: (preferences: NetworkPreferences) => void;
}>;
export const DEFAULT_NETWORK_PREFERENCES: NetworkPreferences = Object.freeze({
  developerMode: false,
  selectionConfirmed: true,
  networkId: 'stellar-mainnet',
  endpoints: Object.freeze({
    'stellar-mainnet': NETWORKS['stellar-mainnet'].horizonUrl,
    'stellar-testnet': NETWORKS['stellar-testnet'].horizonUrl,
  }),
  customNodes: Object.freeze({ 'stellar-mainnet': Object.freeze([]), 'stellar-testnet': Object.freeze([]) }),
});
export function normalizeHorizonEndpoint(input: string): string {
  if (typeof input !== 'string' || input.length > 2048 || !input.trim()) throw new Error('invalid-endpoint');
  const url = new URL(input.trim());
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash)
    throw new Error('invalid-endpoint');
  return url.toString().replace(/\/+$/, '');
}
export function validateNetworkPreferences(value: unknown): NetworkPreferences {
  const fail = (): never => {
    throw new Error('invalid-network-preferences');
  };
  if (!value || typeof value !== 'object') return fail();
  const v = value as Record<string, unknown>;
  if (
    typeof v.selectionConfirmed !== 'boolean' ||
    typeof v.developerMode !== 'boolean' ||
    (v.networkId !== 'stellar-mainnet' && v.networkId !== 'stellar-testnet')
  )
    return fail();
  if (!v.endpoints || typeof v.endpoints !== 'object' || !v.customNodes || typeof v.customNodes !== 'object')
    return fail();
  const endpoints = {} as Record<NetworkId, string>;
  const customNodes = {} as Record<NetworkId, readonly string[]>;
  for (const id of Object.keys(NETWORKS) as NetworkId[]) {
    const nodes = (v.customNodes as Record<string, unknown>)[id];
    const selected = (v.endpoints as Record<string, unknown>)[id];
    if (!Array.isArray(nodes) || nodes.length > 20 || typeof selected !== 'string') return fail();
    try {
      const normalized = nodes.map(node => {
        if (typeof node !== 'string') return fail();
        return normalizeHorizonEndpoint(node);
      });
      if (new Set(normalized).size !== normalized.length || normalized.includes(NETWORKS[id].horizonUrl)) return fail();
      endpoints[id] = normalizeHorizonEndpoint(selected);
      if (![NETWORKS[id].horizonUrl, ...normalized].includes(endpoints[id])) return fail();
      customNodes[id] = Object.freeze(normalized);
    } catch {
      return fail();
    }
  }
  if (
    !v.developerMode &&
    (v.networkId !== 'stellar-mainnet' || endpoints['stellar-mainnet'] !== NETWORKS['stellar-mainnet'].horizonUrl)
  )
    return fail();
  return Object.freeze({
    developerMode: v.developerMode,
    selectionConfirmed: v.selectionConfirmed,
    networkId: v.networkId,
    endpoints: Object.freeze(endpoints),
    customNodes: Object.freeze(customNodes),
  });
}
export function selectedNetwork(preferences: NetworkPreferences): NetworkProfile {
  return Object.freeze({
    ...NETWORKS[preferences.networkId],
    horizonUrl: preferences.endpoints[preferences.networkId],
  }) as NetworkProfile;
}
