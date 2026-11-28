import type { NetworkId } from '@capabilities/network/networkPreferences';

// A one-shot public app ID, not a URL, bridge proof, account or permission.
export type DappNetworkResume = Readonly<{ catalogId: string; networkId: NetworkId }>;
export type DappNetworkNavigation = Readonly<{
  resume?: DappNetworkResume;
  consume: (resume: DappNetworkResume) => void;
  select: (request: DappNetworkResume, action: () => Promise<void>) => Promise<void>;
}>;
