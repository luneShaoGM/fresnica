import { NativeModules } from 'react-native';

import { safePublicHttpsUrl } from '../../capabilities/assets/safePublicHttpsUrl';

export type SafeImageBytes = Readonly<{ mimeType: 'image/png' | 'image/jpeg'; dataUri: string }>;

export type PublicAssetFailure = 'transient' | 'blocked' | 'invalid' | 'cancelled';

// Only bounded categories cross the application/diagnostic boundary. Native
// errors may otherwise include the requested URL or platform network details.
export class PublicAssetError extends Error {
  constructor(readonly kind: PublicAssetFailure) {
    super(`asset-download-${kind}`);
    this.name = 'PublicAssetError';
  }
}

export function publicAssetFailure(error: unknown): PublicAssetFailure {
  if (error instanceof PublicAssetError) return error.kind;
  const code = error && typeof error === 'object' ? (error as { code?: unknown }).code : undefined;
  switch (code) {
    case 'asset-download-blocked': return 'blocked';
    case 'asset-download-invalid': return 'invalid';
    case 'asset-download-cancelled': return 'cancelled';
    default: return 'transient';
  }
}

export interface SafePublicTransport {
  readonly available: boolean;
  readText(url: string, signal: AbortSignal): Promise<string>;
  readIcon(url: string, signal: AbortSignal): Promise<SafeImageBytes>;
  close(): void;
}

type NativeResult = Readonly<{ text?: unknown; mimeType?: unknown; base64?: unknown }>;
type NativeFetch = Readonly<{
  fetch(url: string, kind: 'text' | 'icon' | 'avatar', requestId: string): Promise<NativeResult>;
  cancel(requestId: string): void;
}>;

type Pending = {
  url: string;
  kind: 'icon' | 'text' | 'avatar';
  signal: AbortSignal;
  resolve: (result: NativeResult) => void;
  reject: (error: Error) => void;
  started: boolean;
  requestId: string;
  onAbort: () => void;
};

// Native requests may outlive a service generation until cancelled. Never
// reuse request IDs across account/network service instances.
let nextNativeRequestId = 0;

// All image/text downloads must pass through native bounded streaming and
// transport-level no-redirect enforcement. No fetch/XHR/Image URL fallback.
export function createNativeSafePublicTransport(
  native: NativeFetch | undefined = NativeModules.SecureAssetFetch as NativeFetch | undefined,
): SafePublicTransport & Readonly<{ readAvatar(url: string, signal: AbortSignal): Promise<SafeImageBytes> }> {
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
      let nativeRequest: Promise<NativeResult>;
      try {
        nativeRequest = native.fetch(item.url, item.kind, item.requestId);
      } catch (error) {
        nativeRequest = Promise.reject(error);
      }
      nativeRequest
        .then(result => {
          if (!closed && !item.signal.aborted) item.resolve(result);
          else item.reject(new PublicAssetError('cancelled'));
        })
        .catch(error => item.reject(new PublicAssetError(
          closed || item.signal.aborted ? 'cancelled' : publicAssetFailure(error),
        )))
        .finally(() => {
          active.delete(item.requestId);
          item.signal.removeEventListener('abort', item.onAbort);
          startNext();
        });
    }
  }

  function request(url: string, kind: 'icon' | 'text' | 'avatar', signal: AbortSignal): Promise<NativeResult> {
    const allowed = safePublicHttpsUrl(url);
    if (closed || signal.aborted) return Promise.reject(new PublicAssetError('cancelled'));
    if (!allowed) return Promise.reject(new PublicAssetError('blocked'));
    if (
      !native ||
      typeof native.fetch !== 'function' ||
      typeof native.cancel !== 'function' ||
      waiting.length >= 16
    ) {
      return Promise.reject(new PublicAssetError('transient'));
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
          item.reject(new PublicAssetError('cancelled'));
        },
      };
      signal.addEventListener('abort', item.onAbort);
      waiting.push(item);
      startNext();
    });
  }

  async function readImage(
    url: string,
    signal: AbortSignal,
    kind: 'icon' | 'avatar',
    maxBytes: number,
  ): Promise<SafeImageBytes> {
    const result = await request(url, kind, signal);
    if (closed || signal.aborted) throw new PublicAssetError('cancelled');
    if (
      (result.mimeType !== 'image/png' && result.mimeType !== 'image/jpeg') ||
      typeof result.base64 !== 'string' ||
      result.base64.length === 0 ||
      result.base64.length > Math.ceil(maxBytes / 3) * 4 ||
      result.base64.length % 4 !== 0 ||
      !/^[A-Za-z0-9+/]+={0,2}$/.test(result.base64) ||
      result.base64.length / 4 * 3 - (result.base64.endsWith('==') ? 2 : result.base64.endsWith('=') ? 1 : 0) > maxBytes
    )
      throw new PublicAssetError('invalid');
    return { mimeType: result.mimeType, dataUri: `data:${result.mimeType};base64,${result.base64}` };
  }

  return {
    available: Boolean(native && typeof native.fetch === 'function' && typeof native.cancel === 'function'),
    async readText(url, signal) {
      const result = await request(url, 'text', signal);
      if (closed || signal.aborted) throw new PublicAssetError('cancelled');
      if (typeof result.text !== 'string' || result.text.length > 524_288) throw new PublicAssetError('invalid');
      return result.text;
    },
    readIcon: (url, signal) => readImage(url, signal, 'icon', 65_536),
    readAvatar(url, signal) {
      if (!/^https:\/\/horizon\.stellarcn\.org\/avatar\/v2\/(?:G[A-Z2-7]{55}|M[A-Z2-7]{68})\?size=256$/.test(url))
        return Promise.reject(new PublicAssetError('blocked'));
      return readImage(url, signal, 'avatar', 262_144);
    },
    close() {
      if (closed) return;
      closed = true;
      for (const item of waiting.splice(0)) {
        item.signal.removeEventListener('abort', item.onAbort);
        item.reject(new PublicAssetError('cancelled'));
      }
      for (const item of active.values()) {
        native?.cancel(item.requestId);
        item.reject(new PublicAssetError('cancelled'));
      }
      active.clear();
    },
  };
}
