import { NativeModules } from 'react-native';

import { safePublicHttpsUrl } from '../../capabilities/assets/safePublicHttpsUrl';
import type { SafeImageBytes } from './NativeSafePublicTransport';

export type CachedTokenIcon = SafeImageBytes & Readonly<{ sourceUrl: string; savedAtUnixMs: number }>;

export interface TokenIconDiskCache {
  setEnabled(value: boolean): void;
  read(key: string): Promise<CachedTokenIcon | undefined>;
  write(key: string, sourceUrl: string, image: SafeImageBytes): Promise<void>;
  remove(key: string): Promise<void>;
  close(): void;
}

type NativeCache = Readonly<{
  openIconCache(epoch: string): Promise<string>;
  readIconCache(sessionId: string, key: string): Promise<unknown>;
  writeIconCache(sessionId: string, key: string, sourceUrl: string, base64: string): Promise<void>;
  removeIconCache(sessionId: string, key: string): Promise<void>;
  closeIconCache(sessionId: string, clearAll: boolean): Promise<void>;
}>;

type CacheOperation = 'open' | 'read' | 'write' | 'remove' | 'close' | 'clear';

// Native storage validates identity, image decoding, integrity and capacity.
// JS serializes lease transitions so rapid OFF/ON cannot reopen before clear,
// and never publishes an old read into a newer consent/session generation.
export function createNativeTokenIconCache(
  onError?: (operation: CacheOperation) => void,
  native: NativeCache | undefined = NativeModules.SecureAssetFetch as NativeCache | undefined,
  getEpoch: () => number = () => 0,
): TokenIconDiskCache {
  const available =
    native &&
    [
      native.openIconCache,
      native.readIconCache,
      native.writeIconCache,
      native.removeIconCache,
      native.closeIconCache,
    ].every(method => typeof method === 'function');
  let enabled: boolean | undefined;
  let closed = false;
  let generation = 0;
  let lease: Promise<string | undefined> = Promise.resolve(undefined);

  async function closeLease(sessionId: string, clearAll: boolean): Promise<void> {
    try {
      await native?.closeIconCache(sessionId, clearAll);
    } catch {
      onError?.(clearAll ? 'clear' : 'close');
    }
  }

  async function withLease<T>(
    operation: CacheOperation,
    run: (sessionId: string) => Promise<T>,
  ): Promise<T | undefined> {
    if (!available || !enabled || closed) return;
    const current = generation;
    const sessionId = await lease;
    if (!sessionId || !enabled || closed || generation !== current) return;
    try {
      const result = await run(sessionId);
      if (!enabled || closed || generation !== current) return;
      return result;
    } catch {
      onError?.(operation);
      return;
    }
  }

  return {
    setEnabled(value) {
      if (closed || enabled === value) return;
      enabled = value;
      const current = ++generation;
      if (!available) return;
      lease = lease.then(async previous => {
        // A pending OFF must still clear, even if ON was requested meanwhile.
        if (previous || !value) await closeLease(previous ?? '', !value);
        if (!value || closed || generation !== current) return;
        try {
          const opened = await native!.openIconCache(String(getEpoch()));
          if (typeof opened !== 'string' || opened.length === 0 || opened.length > 128) return;
          if (closed || !enabled || generation !== current) {
            await closeLease(opened, false);
            return;
          }
          return opened;
        } catch {
          onError?.('open');
          return;
        }
      });
    },
    async read(key) {
      return withLease('read', async sessionId => {
        const result = await native!.readIconCache(sessionId, key);
        if (result === null || result === undefined) return;
        const valid = cachedIcon(result);
        if (!valid) await native!.removeIconCache(sessionId, key);
        return valid;
      });
    },
    async write(key, sourceUrl, image) {
      const prefix = `data:${image.mimeType};base64,`;
      if (!safePublicHttpsUrl(sourceUrl) || !image.dataUri.startsWith(prefix)) return;
      const base64 = image.dataUri.slice(prefix.length);
      if (!validBase64(base64)) return;
      await withLease('write', sessionId => native!.writeIconCache(sessionId, key, sourceUrl, base64));
    },
    async remove(key) {
      await withLease('remove', sessionId => native!.removeIconCache(sessionId, key));
    },
    close() {
      if (closed) return;
      closed = true;
      enabled = false;
      generation += 1;
      lease = lease.then(async sessionId => {
        if (sessionId) await closeLease(sessionId, false);
        return undefined;
      });
    },
  };
}

function validBase64(value: unknown): value is string {
  if (
    typeof value !== 'string' ||
    value.length === 0 ||
    value.length > 87_384 ||
    value.length % 4 !== 0 ||
    !/^[A-Za-z0-9+/]+={0,2}$/.test(value)
  )
    return false;
  const padding = value.endsWith('==') ? 2 : value.endsWith('=') ? 1 : 0;
  return (value.length * 3) / 4 - padding <= 65_536;
}

function cachedIcon(value: unknown): CachedTokenIcon | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return;
  const raw = value as Record<string, unknown>;
  const sourceUrl = safePublicHttpsUrl(raw.sourceUrl);
  if (
    (raw.mimeType !== 'image/png' && raw.mimeType !== 'image/jpeg') ||
    !validBase64(raw.base64) ||
    !sourceUrl ||
    typeof raw.savedAtUnixMs !== 'number' ||
    !Number.isSafeInteger(raw.savedAtUnixMs) ||
    raw.savedAtUnixMs < 0
  )
    return;
  return {
    mimeType: raw.mimeType,
    dataUri: `data:${raw.mimeType};base64,${raw.base64}`,
    sourceUrl,
    savedAtUnixMs: raw.savedAtUnixMs,
  };
}
