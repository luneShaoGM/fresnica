export type AccountAvatarSnapshot = Readonly<{ enabled: boolean; readable: boolean; revision: number }>;
export interface AccountAvatarDiskCache {
  setEnabled(enabled: boolean): void;
  read(address: string): Promise<Readonly<{ uri: string; savedAtUnixMs: number }> | undefined>;
  write(address: string, uri: string): Promise<void>;
  remove(address: string): Promise<void>;
  close(): void;
}
export interface AccountAvatarPort {
  readonly available: boolean;
  getSnapshot(): AccountAvatarSnapshot;
  subscribe(listener: () => void): () => void;
  setEnabled(enabled: boolean): void;
  setReadable(readable: boolean, foreground?: boolean): void;
  allowsOnline(address: string): boolean;
  read(address: string): string | undefined;
  load(
    address: string,
    signal: AbortSignal,
    options?: Readonly<{ onlyExpired?: boolean }>,
  ): Promise<string | undefined>;
  reject(address: string, uri: string): void;
  close(): void;
}
export function accountAvatarAddress(value: string): string | undefined {
  const address = value.trim();
  return /^(?:G[A-Z2-7]{55}|M[A-Z2-7]{68})$/.test(address) ? address : undefined;
}

// Display-only address media; permission is independent of Token/issuer images.
export function createAccountAvatarPort(
  input: Readonly<{
    available: boolean;
    initialEnabled: boolean;
    diskCache?: AccountAvatarDiskCache;
    loadImage: (url: string, signal: AbortSignal) => Promise<string>;
    now?: () => number;
  }>,
): AccountAvatarPort {
  const now = input.now ?? Date.now;
  const images = new Map<string, { uri: string; expires: number }>();
  const rejected = new Set<string>();
  const listeners = new Set<() => void>();
  const pending = new Map<string, { owner: AbortController; consumers: number; result: Promise<string | undefined> }>();
  const waiting = new Set<() => void>();
  let foreground = false;
  let active = 0;
  let closed = false;
  let state: AccountAvatarSnapshot = Object.freeze({
    enabled: input.available && input.initialEnabled,
    readable: false,
    revision: 0,
  });
  input.diskCache?.setEnabled(state.enabled);
  const publish = (next: Pick<AccountAvatarSnapshot, 'enabled' | 'readable'>) => {
    state = Object.freeze({ ...next, revision: state.revision + 1 });
    listeners.forEach(listener => listener());
  };
  const cancel = () => {
    for (const entry of pending.values()) entry.owner.abort();
    pending.clear();
  };
  const allowsOnline = (raw: string) => {
    const address = accountAvatarAddress(raw);
    return !!address && !closed && state.enabled;
  };
  const read = (raw: string) => {
    const address = accountAvatarAddress(raw);
    const image = address ? images.get(address) : undefined;
    return address && allowsOnline(address) && image && image.expires > now() ? image.uri : undefined;
  };
  function acquire(signal: AbortSignal): Promise<boolean> {
    if (closed || !state.enabled || !foreground || signal.aborted || waiting.size >= 64) return Promise.resolve(false);
    if (active < 2) {
      active++;
      return Promise.resolve(true);
    }
    return new Promise(resolve => {
      const abort = () => {
        waiting.delete(start);
        resolve(false);
      };
      const start = () => {
        signal.removeEventListener('abort', abort);
        if (closed || signal.aborted || !state.enabled || !foreground) resolve(false);
        else {
          active++;
          resolve(true);
        }
      };
      waiting.add(start);
      signal.addEventListener('abort', abort, { once: true });
    });
  }
  function release() {
    active--;
    const start = waiting.values().next().value;
    if (start) {
      waiting.delete(start);
      start();
    }
  }
  async function fetchImage(address: string, owner: AbortController, revision: number) {
    const current = () => allowsOnline(address) && foreground && !owner.signal.aborted && state.revision === revision;
    let abort!: () => void;
    const cancelled = new Promise<undefined>(resolve => {
      abort = () => resolve(undefined);
      owner.signal.addEventListener('abort', abort, { once: true });
    });
    const timer = setTimeout(() => owner.abort(), 60_000);
    try {
      if (!(await acquire(owner.signal))) return undefined;
      try {
        if (!current()) return undefined;
        const stored = input.diskCache
          ? await Promise.race([input.diskCache.read(address).catch(() => undefined), cancelled])
          : undefined;
        if (!current()) return undefined;
        const nowMs = now();
        const diskExpiry = stored ? stored.savedAtUnixMs + 7 * 24 * 60 * 60 * 1000 : 0;
        const diskUri =
          stored && stored.savedAtUnixMs <= nowMs && diskExpiry > nowMs && validImage(stored.uri)
            ? stored.uri
            : undefined;
        if (!diskUri && !state.readable) return undefined;
        const uri =
          diskUri ??
          (await Promise.race([
            input.loadImage(`https://horizon.stellarcn.org/avatar/v2/${address}?size=256`, owner.signal),
            cancelled,
          ]));
        if (!uri || !current() || !validImage(uri)) return undefined;
        if (!diskUri) input.diskCache?.write(address, uri).catch(() => undefined);
        images.delete(address);
        images.set(address, { uri, expires: diskUri ? Math.min(diskExpiry, now() + 600_000) : now() + 600_000 });
        while (images.size > 64) images.delete(images.keys().next().value!);
        // Refresh all surfaces without retiring other in-flight image reads.
        state = Object.freeze({ ...state });
        listeners.forEach(listener => listener());
        return uri;
      } finally {
        release();
      }
    } catch {
      return undefined;
    } finally {
      clearTimeout(timer);
      owner.signal.removeEventListener('abort', abort);
    }
  }
  return {
    available: input.available,
    getSnapshot: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    setEnabled(enabled) {
      if (closed || state.enabled === (input.available && enabled)) return;
      if (!enabled) {
        images.clear();
        rejected.clear();
        cancel();
      }
      input.diskCache?.setEnabled(input.available && enabled);
      publish({ ...state, enabled: input.available && enabled });
    },
    setReadable(readable, isForeground = readable) {
      if (closed || (state.readable === readable && foreground === isForeground)) return;
      foreground = isForeground;
      cancel();
      if (readable) rejected.clear();
      publish({ ...state, readable });
    },
    allowsOnline,
    read,
    reject(raw, uri) {
      const address = accountAvatarAddress(raw);
      if (address && images.get(address)?.uri === uri) {
        images.delete(address);
        input.diskCache?.remove(address).catch(() => undefined);
        rejected.add(address);
        while (rejected.size > 64) rejected.delete(rejected.values().next().value!);
        publish(state);
      }
    },
    async load(raw, signal, options) {
      const address = accountAvatarAddress(raw);
      if (!address || !allowsOnline(address) || signal.aborted || rejected.has(address)) return undefined;
      // Capacity eviction must not make mounted consumers reclaim each other's slots.
      const image = images.get(address);
      if (options?.onlyExpired && !image) return undefined;
      const cached = read(address);
      if (cached || !foreground || (!state.readable && !input.diskCache)) return cached;
      let request = pending.get(address);
      if (!request) {
        if (pending.size >= 66) return undefined;
        const owner = new AbortController();
        const revision = state.revision;
        request = { owner, consumers: 0, result: fetchImage(address, owner, revision) };
        pending.set(address, request);
      }
      const joined = request;
      joined.consumers++;
      return new Promise(resolve => {
        const finish = (uri?: string) => {
          signal.removeEventListener('abort', abort);
          joined.owner.signal.removeEventListener('abort', abort);
          joined.consumers--;
          if (!joined.consumers && pending.get(address) === joined) {
            pending.delete(address);
            joined.owner.abort();
          }
          resolve(uri);
        };
        const abort = () => finish();
        signal.addEventListener('abort', abort, { once: true });
        joined.owner.signal.addEventListener('abort', abort, { once: true });
        joined.result.then(uri => {
          if (!signal.aborted && !joined.owner.signal.aborted) finish(uri);
        });
      });
    },
    close() {
      if (closed) return;
      closed = true;
      images.clear();
      rejected.clear();
      cancel();
      input.diskCache?.close();
      publish({ enabled: false, readable: false });
      listeners.clear();
    },
  };
}

function validImage(uri: string): boolean {
  return uri.length <= 349_554 && /^data:image\/(?:png|jpeg);base64,[A-Za-z0-9+/]+={0,2}$/.test(uri);
}
