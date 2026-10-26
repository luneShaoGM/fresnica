export type NodeReadFailure =
  | 'timeout'
  | 'rate-limited'
  | 'unavailable'
  | 'wrong-network'
  | 'protocol'
  | 'request'
  | 'paused'
  | 'superseded'
  | 'cooldown';

// Safe diagnostic metadata only; never carries raw Horizon payloads or request bodies.
export class NodeReadError extends Error {
  constructor(
    readonly kind: NodeReadFailure,
    readonly retryAfterMs?: number,
  ) {
    super(`node-read-${kind}`);
    this.name = 'NodeReadError';
  }
}
export function isNodeFault(error: unknown): error is NodeReadError {
  return (
    error instanceof NodeReadError &&
    ['timeout', 'rate-limited', 'unavailable', 'wrong-network', 'protocol'].includes(error.kind)
  );
}
