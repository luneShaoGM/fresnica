import { NativeModules } from 'react-native';

import { safePublicHttpsUrl } from '../../capabilities/assets/safePublicHttpsUrl';

export type SafeImageBytes = Readonly<{ mimeType: 'image/png' | 'image/jpeg'; dataUri: string }>;

export interface SafePublicTransport {
  readonly available: boolean;
  readText(url: string, signal: AbortSignal): Promise<string>;
  readIcon(url: string, signal: AbortSignal): Promise<SafeImageBytes>;
  close(): void;
}

type NativeResult = Readonly<{ text?: unknown; mimeType?: unknown; base64?: unknown }>;
type NativeFetch = Readonly<{
  fetch(url: string, kind: 'text' | 'icon', requestId: string): Promise<NativeResult>;
  cancel(requestId: string): void;
}>;

type Pending = {
  url: string;
  kind: 'icon' | 'text';
  signal: AbortSignal;
  resolve: (result: NativeResult) => void;
  reject: (error: Error) => void;
  started: boolean;
  requestId: string;
  onAbort: () => void;
};

const error = () => new Error('asset-download-unavailable');

// Native requests may outlive a service generation until cancelled. Never
// reuse request IDs across account/network service instances.
let nextNativeRequestId = 0;

// All image/text downloads must pass through native bounded streaming and
// transport-level no-redirect enforcement. No fetch/XHR/Image URL fallback.
export function createNativeSafePublicTransport(
  native: NativeFetch | undefined = NativeModules.SecureAssetFetch as NativeFetch | undefined,
): SafePublicTransport {
  const waiting: Pending[] = [];
  const active = new Map<string, Pending>();
  let closed = false;

  function startNext(): void {
    if (closed || !native || typeof native.fetch !== 'function' || typeof native.cancel !== 'function') return;
    while (active.size < 2 && waiting.length > 0) {
      const item = waiting.shift();
      if (!item || item.signal.aborted) continue;
      item.started = true;
      active.set(item.requestId, item);
      void native
        .fetch(item.url, item.kind, item.requestId)
        .then(result => {
          if (!closed && !item.signal.aborted) item.resolve(result);
          else item.reject(error());
        })
        .catch(() => item.reject(error()))
        .finally(() => {
          active.delete(item.requestId);
          item.signal.removeEventListener('abort', item.onAbort);
          startNext();
        });
    }
  }

  function request(url: string, kind: 'icon' | 'text', signal: AbortSignal): Promise<NativeResult> {
    const allowed = safePublicHttpsUrl(url);
    if (
      closed ||
      signal.aborted ||
      !allowed ||
      !native ||
      typeof native.fetch !== 'function' ||
      typeof native.cancel !== 'function' ||
      waiting.length >= 16
    ) {
      return Promise.reject(error());
    }
    return new Promise<NativeResult>((resolve, reject) => {
      const requestId = `asset-${++nextNativeRequestId}`;
      const item: Pending = {
        url: allowed,
        kind,
        signal,
        resolve,
        reject,
        started: false,
        requestId,
        onAbort: () => {
          if (!item.started) {
            const position = waiting.indexOf(item);
            if (position >= 0) waiting.splice(position, 1);
            item.signal.removeEventListener('abort', item.onAbort);
          } else native.cancel(item.requestId);
          item.reject(error());
        },
      };
      signal.addEventListener('abort', item.onAbort);
      waiting.push(item);
      startNext();
    });
  }

  return {
    available: Boolean(native && typeof native.fetch === 'function' && typeof native.cancel === 'function'),
    async readText(url, signal) {
      const result = await request(url, 'text', signal);
      if (typeof result.text !== 'string' || result.text.length > 524_288 || signal.aborted) throw error();
      return result.text;
    },
    async readIcon(url, signal) {
      const result = await request(url, 'icon', signal);
      if (
        (result.mimeType !== 'image/png' && result.mimeType !== 'image/jpeg') ||
        typeof result.base64 !== 'string' ||
        result.base64.length === 0 ||
        result.base64.length > 87_384 ||
        !/^[A-Za-z0-9+/]*={0,2}$/.test(result.base64) ||
        signal.aborted
      )
        throw error();
      return { mimeType: result.mimeType, dataUri: `data:${result.mimeType};base64,${result.base64}` };
    },
    close() {
      if (closed) return;
      closed = true;
      for (const item of waiting.splice(0)) {
        item.signal.removeEventListener('abort', item.onAbort);
        item.reject(error());
      }
      for (const item of active.values()) {
        native?.cancel(item.requestId);
        item.reject(error());
      }
      active.clear();
    },
  };
}
