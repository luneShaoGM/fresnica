import type { AccountEffectsPort } from '@capabilities/account-sync/AccountEffects';
import type { NodeReadSession } from './createNodeReadSession';

export function bindNodeAccountEffects(
  node: NodeReadSession,
  createEffects: (endpoint: string) => AccountEffectsPort,
): AccountEffectsPort {
  return {
    latest: (address, signal) =>
      node.run((requestSignal, endpoint) => createEffects(endpoint).latest(address, requestSignal), signal),
    open(input) {
      const lease = node.assertReady();
      let stopped = false;
      const current = () => !stopped && node.getSnapshot().generation === lease.generation;
      const stop = createEffects(lease.endpoint).open({
        ...input,
        onOpen: () => {
          if (current()) input.onOpen();
        },
        onEffect: token => {
          if (current()) input.onEffect(token);
        },
        onFailure: (reason, failure) => {
          if (!current()) return;
          if (failure) node.reportFailure(failure, lease.generation);
          input.onFailure(reason, failure);
        },
      });
      return () => {
        if (stopped) return;
        stopped = true;
        stop();
      };
    },
  };
}
