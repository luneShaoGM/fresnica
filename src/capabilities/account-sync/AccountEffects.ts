import type { NodeReadError } from '../network/NodeReadError';
// Public event tokens are invalidation hints, never balance or transaction authority.
export type AccountSyncMode = 'paused' | 'connecting' | 'live' | 'polling' | 'inactive';
export type EffectStreamFailure = 'failed' | 'cursor-rejected' | 'rotate';
export interface AccountEffectsPort {
  open(
    input: Readonly<{
      address: string;
      cursor?: string;
      onOpen: () => void;
      onEffect: (token: string) => void;
      onFailure: (reason: EffectStreamFailure, failure?: NodeReadError) => void;
    }>,
  ): () => void;
  latest(address: string, signal: AbortSignal): Promise<string | undefined | null>;
}
