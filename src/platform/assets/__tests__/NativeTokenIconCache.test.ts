import { createNativeTokenIconCache } from '../NativeTokenIconCache';

const issuer = 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN';
const key = JSON.stringify(['stellar-mainnet', 'Usd', issuer]);
const sourceUrl = 'https://issuer.example.org/token.png';
const base64 = 'iVBORw0KGgo=';
const image = { mimeType: 'image/png' as const, dataUri: `data:image/png;base64,${base64}` };
const entry = { mimeType: 'image/png', base64, sourceUrl, savedAtUnixMs: 123_456 };
const flush = () => new Promise<void>(resolve => setImmediate(resolve));

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, resolve, reject };
}

function nativeCache() {
  let nextLease = 0;
  return {
    openIconCache: jest.fn(async () => `lease-${++nextLease}`),
    readIconCache: jest.fn<Promise<unknown>, [string, string]>(async () => entry),
    writeIconCache: jest.fn<Promise<void>, [string, string, string, string]>(async () => undefined),
    removeIconCache: jest.fn<Promise<void>, [string, string]>(async () => undefined),
    closeIconCache: jest.fn<Promise<void>, [string, boolean]>(async () => undefined),
  };
}

describe('Native token icon cache adapter', () => {
  it('degrades to misses when the bridge is unavailable', async () => {
    const onError = jest.fn();
    const cache = createNativeTokenIconCache(onError, undefined);
    cache.setEnabled(true);
    expect(await cache.read(key)).toBeUndefined();
    await cache.write(key, sourceUrl, image);
    await cache.remove(key);
    cache.setEnabled(false);
    cache.close();
    await flush();
    expect(onError).not.toHaveBeenCalled();
  });

  it('reads a validated local data URI and timestamp and writes only bounded base64', async () => {
    const native = nativeCache();
    const cache = createNativeTokenIconCache(undefined, native);
    cache.setEnabled(true);
    expect(await cache.read(key)).toEqual({ ...image, sourceUrl, savedAtUnixMs: entry.savedAtUnixMs });
    expect(native.readIconCache).toHaveBeenCalledWith('lease-1', key);
    await cache.write(key, sourceUrl, image);
    expect(native.writeIconCache).toHaveBeenCalledWith('lease-1', key, sourceUrl, base64);
    await cache.remove(key);
    expect(native.removeIconCache).toHaveBeenCalledWith('lease-1', key);
    cache.close();
    await flush();
    expect(native.closeIconCache).toHaveBeenCalledWith('lease-1', false);
  });

  it.each([
    ['unsupported format', { ...entry, mimeType: 'image/svg+xml' }],
    ['unsafe source', { ...entry, sourceUrl: 'https://127.0.0.1/token.png' }],
    ['invalid base64', { ...entry, base64: 'AAAA=' }],
    ['over-budget bytes', { ...entry, base64: 'A'.repeat(87_384) }],
    ['negative timestamp', { ...entry, savedAtUnixMs: -1 }],
    ['noninteger timestamp', { ...entry, savedAtUnixMs: 1.5 }],
    ['unsafe timestamp', { ...entry, savedAtUnixMs: Number.MAX_SAFE_INTEGER + 1 }],
  ])('discards and removes cached responses with %s', async (_label, invalid) => {
    const native = nativeCache();
    native.readIconCache.mockResolvedValueOnce(invalid);
    const cache = createNativeTokenIconCache(undefined, native);
    cache.setEnabled(true);
    expect(await cache.read(key)).toBeUndefined();
    expect(native.removeIconCache).toHaveBeenCalledWith('lease-1', key);
    cache.close();
  });

  it('rejects unsafe or oversized write data before crossing the bridge', async () => {
    const native = nativeCache();
    const cache = createNativeTokenIconCache(undefined, native);
    cache.setEnabled(true);
    await cache.write(key, 'https://localhost/token.png', image);
    await cache.write(key, sourceUrl, { ...image, dataUri: sourceUrl });
    await cache.write(key, sourceUrl, { ...image, dataUri: 'data:image/png;base64,' + 'A'.repeat(87_384) });
    expect(native.writeIconCache).not.toHaveBeenCalled();
    cache.close();
  });

  it('reports only the failed operation when native IO rejects', async () => {
    const native = nativeCache();
    native.readIconCache.mockRejectedValueOnce(new Error('private native path and URL: ' + sourceUrl));
    const onError = jest.fn();
    const cache = createNativeTokenIconCache(onError, native);
    cache.setEnabled(true);
    expect(await cache.read(key)).toBeUndefined();
    expect(onError.mock.calls).toEqual([['read']]);
    cache.close();
  });

  it.each(['close', 'opt-out'] as const)('revokes the lease on %s, clearing bytes only for opt-out', async action => {
    const native = nativeCache();
    const cache = createNativeTokenIconCache(undefined, native);
    cache.setEnabled(true);
    await cache.read(key);
    if (action === 'close') cache.close();
    else cache.setEnabled(false);
    await flush();
    expect(native.closeIconCache.mock.calls).toEqual([['lease-1', action === 'opt-out']]);
    expect(await cache.read(key)).toBeUndefined();
    await cache.write(key, sourceUrl, image);
    expect(native.writeIconCache).not.toHaveBeenCalled();
    cache.close();
  });

  it('purges residual bytes on initially disabled startup without opening a lease', async () => {
    const native = nativeCache();
    const cache = createNativeTokenIconCache(undefined, native);
    cache.setEnabled(false);
    cache.setEnabled(false);
    await flush();
    expect(native.closeIconCache.mock.calls).toEqual([['', true]]);
    expect(native.openIconCache).not.toHaveBeenCalled();
    expect(await cache.read(key)).toBeUndefined();
    cache.close();
  });

  it.each(['close', 'opt-out'] as const)(
    'retires a late open result after %s without starting queued reads or writes',
    async action => {
      const opened = deferred<string>();
      const native = nativeCache();
      native.openIconCache.mockImplementationOnce(() => opened.promise);
      const cache = createNativeTokenIconCache(undefined, native);
      cache.setEnabled(true);
      const read = cache.read(key);
      const write = cache.write(key, sourceUrl, image);
      await flush();
      expect(native.openIconCache).toHaveBeenCalledTimes(1);
      if (action === 'close') cache.close();
      else cache.setEnabled(false);
      opened.resolve('late-lease');
      expect(await read).toBeUndefined();
      await write;
      await flush();
      expect(native.readIconCache).not.toHaveBeenCalled();
      expect(native.writeIconCache).not.toHaveBeenCalled();
      expect(native.closeIconCache.mock.calls).toEqual(
        action === 'opt-out'
          ? [
              ['late-lease', false],
              ['', true],
            ]
          : [['late-lease', false]],
      );
      cache.close();
    },
  );

  it('finishes privacy clear before opening a new lease during rapid OFF/ON', async () => {
    const clearing = deferred<void>();
    const order: string[] = [];
    const native = nativeCache();
    native.openIconCache
      .mockImplementationOnce(async () => {
        order.push('open-1');
        return 'lease-1';
      })
      .mockImplementationOnce(async () => {
        order.push('open-2');
        return 'lease-2';
      });
    native.closeIconCache.mockImplementationOnce(async (session, clear) => {
      order.push(`close-${session}-${clear}`);
      await clearing.promise;
      order.push('clear-finished');
    });
    const cache = createNativeTokenIconCache(undefined, native);
    cache.setEnabled(true);
    await cache.read(key);
    cache.setEnabled(false);
    cache.setEnabled(true);
    const read = cache.read(key);
    await flush();
    expect(order).toEqual(['open-1', 'close-lease-1-true']);
    expect(native.openIconCache).toHaveBeenCalledTimes(1);
    clearing.resolve();
    expect(await read).toEqual({ ...image, sourceUrl, savedAtUnixMs: entry.savedAtUnixMs });
    expect(order).toEqual(['open-1', 'close-lease-1-true', 'clear-finished', 'open-2']);
    expect(native.readIconCache).toHaveBeenLastCalledWith('lease-2', key);
    cache.close();
  });

  it('discards a late read from a previous consent generation', async () => {
    const reading = deferred<unknown>();
    const native = nativeCache();
    native.readIconCache.mockImplementationOnce(() => reading.promise);
    const cache = createNativeTokenIconCache(undefined, native);
    cache.setEnabled(true);
    const first = cache.read(key);
    await flush();
    expect(native.readIconCache).toHaveBeenCalledWith('lease-1', key);
    cache.setEnabled(false);
    cache.setEnabled(true);
    reading.resolve(entry);
    expect(await first).toBeUndefined();
    expect(await cache.read(key)).toEqual({ ...image, sourceUrl, savedAtUnixMs: entry.savedAtUnixMs });
    expect(native.readIconCache).toHaveBeenLastCalledWith('lease-2', key);
    cache.close();
  });

  it('revokes the native writer lease during opt-out even if a previously invoked write has not settled', async () => {
    const writing = deferred<void>();
    const order: string[] = [];
    const native = nativeCache();
    native.writeIconCache.mockImplementationOnce(async () => {
      order.push('write-invoked');
      await writing.promise;
    });
    native.closeIconCache.mockImplementationOnce(async (session, clear) => {
      order.push(`close-${session}-${clear}`);
    });
    const cache = createNativeTokenIconCache(undefined, native);
    cache.setEnabled(true);
    const write = cache.write(key, sourceUrl, image);
    await flush();
    cache.setEnabled(false);
    await flush();
    expect(order).toEqual(['write-invoked', 'close-lease-1-true']);
    writing.resolve();
    await write;
    await cache.write(key, sourceUrl, image);
    expect(native.writeIconCache).toHaveBeenCalledTimes(1);
    expect(await cache.read(key)).toBeUndefined();
    cache.close();
  });
});
