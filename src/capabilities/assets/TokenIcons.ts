import type { TokenAssetIdentity } from './TokenMetadataCache';

export type TokenIconState = Readonly<{ enabled: boolean; revision: number }>;

export interface TokenIconPort {
  readonly available: boolean;
  getSnapshot(): TokenIconState;
  subscribe(callback: () => void): () => void;
  setEnabled(value: boolean): void;
  readIcon(asset: TokenAssetIdentity): string | undefined;
  loadIcon(asset: TokenAssetIdentity, signal: AbortSignal): Promise<string | undefined>;
  close(): void;
}
