export type AccountAvatarSnapshot = Readonly<{ enabled: boolean; readable: boolean; revision: number }>;
export interface AccountAvatarPort {
  readonly available: boolean;
  getSnapshot(): AccountAvatarSnapshot;
  subscribe(listener: () => void): () => void;
  setEnabled(enabled: boolean): void;
  setReadable(readable: boolean): void;
  read(address: string): string | undefined;
  load(address: string, signal: AbortSignal): Promise<string | undefined>;
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
    loadImage: (url: string, signal: AbortSignal) => Promise<string>;
    now?: () => number;
  }>,
): AccountAvatarPort {
  const now = input.now ?? Date.now;
  const images = new Map<string, { uri: string; expires: number }>();
  const listeners = new Set<() => void>();
  const controllers = new Set<AbortController>();
  const waiting = new Set<() => void>();
  let active = 0;
  let closed = false;
  let state: AccountAvatarSnapshot = Object.freeze({
    enabled: input.available && input.initialEnabled,
    readable: false,
    revision: 0,
  });
  const publish = (next: Pick<AccountAvatarSnapshot, 'enabled' | 'readable'>) => {
    state = Object.freeze({ ...next, revision: state.revision + 1 });
    listeners.forEach(listener => listener());
  };
  const cancel = () => {
    for (const controller of controllers) controller.abort();
  };
  const read = (raw: string) => {
    const address = accountAvatarAddress(raw);
    const image = address ? images.get(address) : undefined;
    return !closed && state.enabled && image && image.expires > now() ? image.uri : undefined;
  };
  function acquire(signal: AbortSignal): Promise<boolean> {
    if (closed || !state.enabled || !state.readable || signal.aborted || waiting.size >= 64)
      return Promise.resolve(false);
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
        if (closed || signal.aborted || !state.enabled || !state.readable) resolve(false);
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
        cancel();
      }
      publish({ ...state, enabled: input.available && enabled });
    },
    setReadable(readable) {
      if (closed || state.readable === readable) return;
      if (!readable) cancel();
      publish({ ...state, readable });
    },
    read,
    reject(raw, uri) {
      const address = accountAvatarAddress(raw);
      if (address && images.get(address)?.uri === uri) images.delete(address);
    },
    async load(raw, signal) {
      const address = accountAvatarAddress(raw);
      if (!address || closed || !state.enabled || signal.aborted) return undefined;
      const cached = read(address);
      if (cached || !state.readable) return cached;
      const owner = new AbortController();
      const abort = () => owner.abort();
      signal.addEventListener('abort', abort, { once: true });
      controllers.add(owner);
      let timer: ReturnType<typeof setTimeout> | undefined;
      const cancelled = new Promise<undefined>(resolve => {
        owner.signal.addEventListener('abort', () => resolve(undefined), { once: true });
        timer = setTimeout(abort, 6000);
      });
      const revision = state.revision;
      const work = async () => {
        if (!(await acquire(owner.signal))) return undefined;
        try {
          const duplicate = read(address);
          if (duplicate) return duplicate;
          const uri = await input.loadImage(
            `https://horizon.stellarcn.org/avatar/v2/${address}?size=256`,
            owner.signal,
          );
          if (
            closed ||
            owner.signal.aborted ||
            !state.enabled ||
            !state.readable ||
            state.revision !== revision ||
            uri.length > 87_450 ||
            !/^data:image\/(?:png|jpeg);base64,[A-Za-z0-9+/]+={0,2}$/.test(uri)
          )
            return undefined;
          images.delete(address);
          images.set(address, { uri, expires: now() + 600_000 });
          while (images.size > 64) images.delete(images.keys().next().value!);
          return uri;
        } finally {
          release();
        }
      };
      try {
        return await Promise.race([work().catch(() => undefined), cancelled]);
      } finally {
        if (timer !== undefined) clearTimeout(timer);
        owner.abort();
        controllers.delete(owner);
        signal.removeEventListener('abort', abort);
      }
    },
    close() {
      if (closed) return;
      closed = true;
      images.clear();
      cancel();
      publish({ enabled: false, readable: false });
      listeners.clear();
    },
  };
}
