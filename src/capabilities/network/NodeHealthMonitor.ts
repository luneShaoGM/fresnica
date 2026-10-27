import type { NodeReadFailure } from './NodeReadError';

// Public diagnostic state only; health does not authorize a transaction or a network change.
export type NodeHealthSnapshot = Readonly<{
  endpoint: string;
  generation: number;
  phase: 'checking' | 'healthy' | 'cooldown' | 'wrong-network' | 'paused' | 'closed';
  failure?: NodeReadFailure;
}>;

export type NodeHealthMonitor = Readonly<{
  getSnapshot: () => NodeHealthSnapshot;
  subscribe: (listener: () => void) => () => void;
  retry: () => void;
}>;
