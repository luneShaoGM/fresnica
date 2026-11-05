import type { DappCatalogEntry } from './catalog';
import type { PublicDappDetail } from './dappDetails';

export type PublicDappDetailResult = Readonly<{
  detail: PublicDappDetail;
  fromCache: boolean;
  stale: boolean;
  refreshFailed: boolean;
}>;

export type PublicDappIconState = Readonly<{ enabled: boolean; revision: number }>;

export interface DappPublicMediaPort {
  readonly available: boolean;
  readCachedDetail(appId: string): PublicDappDetailResult | undefined;
  loadDetail(appId: string, signal: AbortSignal, forceRefresh?: boolean): Promise<PublicDappDetailResult>;
  getIconState(): PublicDappIconState;
  subscribeIcons(listener: () => void): () => void;
  setIconsEnabled(value: boolean): void;
  readIcon(entry: DappCatalogEntry): string | undefined;
  loadIcon(entry: DappCatalogEntry, signal: AbortSignal): Promise<string | undefined>;
  close(): void;
}
