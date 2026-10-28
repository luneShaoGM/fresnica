import type { RequestDeepLinkPort } from '@capabilities/request/RequestDeepLinkPort';

// One session-only latest input; duplicate OS delivery must not reset a user's review.
export function startRequestDeepLinkIntake(
  deps: Readonly<{
    port: RequestDeepLinkPort;
    onCapture: (url: string) => void;
    onFailure: () => void;
  }>,
) {
  let stopped = false;
  let ready = false;
  let warmReceived = false;
  let pending: string | undefined;
  let delivered = false;
  const flush = () => {
    if (stopped || !ready || pending === undefined || delivered) return;
    delivered = true;
    deps.onCapture(pending);
  };
  const capture = (url: string) => {
    if (stopped || pending === url) return;
    pending = url;
    delivered = false;
    flush();
  };
  const unsubscribe = deps.port.subscribe(url => {
    if (stopped) return;
    warmReceived = true;
    capture(url);
  });
  Promise.resolve()
    .then(() => (stopped ? undefined : deps.port.getInitialUrl()))
    .then(url => {
      if (!stopped && !warmReceived && url !== undefined) capture(url);
    })
    .catch(() => {
      if (!stopped) deps.onFailure();
    });
  return {
    setReady(next: boolean) {
      ready = next;
      flush();
    },
    dismiss() {
      // A dismissed session must also ignore an outstanding cold-start URL.
      warmReceived = true;
      pending = undefined;
      delivered = false;
    },
    close() {
      if (stopped) return;
      stopped = true;
      pending = undefined;
      unsubscribe();
    },
  };
}
