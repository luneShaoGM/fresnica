import type { LedgerReadRuntime } from '../readModels/LedgerReadRuntime';

export function createRequestScanLifetime(
  runtime: LedgerReadRuntime,
  subscribeBackground: (retire: () => void) => () => void,
) {
  let closed = false;
  let foregroundEpoch = 0;
  const pending = new Set<() => void>();
  const stopBackground = subscribeBackground(() => {
    foregroundEpoch += 1;
  });
  const unsubscribe = runtime.subscribe(() => {
    if (!runtime.getSnapshot().foreground) return;
    const deliveries = [...pending];
    pending.clear();
    deliveries.forEach(deliver => deliver());
  });

  return {
    capture(source: 'camera' | 'photo', isCurrentRoute: () => boolean): () => boolean {
      const epoch = foregroundEpoch;
      const startedInForeground = runtime.getSnapshot().foreground;
      return () =>
        !closed &&
        startedInForeground &&
        isCurrentRoute() &&
        // A system photo picker may suspend the app; camera frames never survive that transition.
        (source === 'photo' || (epoch === foregroundEpoch && runtime.getSnapshot().foreground));
    },
    deliverWhenForeground(isCurrent: () => boolean, navigate: () => void): void {
      if (closed || !isCurrent()) return;
      const deliver = () => {
        if (!closed && runtime.getSnapshot().foreground && isCurrent()) navigate();
      };
      if (runtime.getSnapshot().foreground) deliver();
      else pending.add(deliver);
    },
    close(): void {
      closed = true;
      pending.clear();
      unsubscribe();
      stopBackground();
    },
  };
}
