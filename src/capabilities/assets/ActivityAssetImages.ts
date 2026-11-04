import type { HistoryAsset } from '../history/types';

// Decorative public metadata only. Never used for asset trust or risk classification.
export interface ActivityAssetImages {
  resolve(networkId: string, asset: HistoryAsset, signal: AbortSignal): Promise<string | undefined>;
}
