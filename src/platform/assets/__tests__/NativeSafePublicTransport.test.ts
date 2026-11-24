import { createNativeSafePublicTransport, PublicAssetError, publicAssetFailure } from '../NativeSafePublicTransport';

const good = 'https://raw.githubusercontent.com/org/icons/main/icon.png';

describe('Native bounded public transport adapter', () => {
  it('never substitutes RN fetch and maps native-decoded image bytes into a local data URI', async () => {
    const native = {
      fetch: jest.fn(async () => ({ mimeType: 'image/png', base64: 'iVBORw0KGgo=' })),
      cancel: jest.fn(),
    };
    const transport = createNativeSafePublicTransport(native);
    expect(transport.available).toBe(true);
    await expect(transport.readIcon(good, new AbortController().signal)).resolves.toEqual({
      mimeType: 'image/png',
      dataUri: 'data:image/png;base64,iVBORw0KGgo=',
    });
    expect(native.fetch).toHaveBeenCalledWith(good, 'icon', expect.stringMatching(/^asset-\d+$/));
    transport.close();
  });

  it('defaults off when native capability is absent and does not initiate a JS HTTP request', async () => {
    const transport = createNativeSafePublicTransport(undefined);
    // A missing module may be supplied by the RN mock; explicit undefined is
    // only absent if NativeModules also has no SecureAssetFetch.
    expect(transport.available).toBe(false);
    await expect(transport.readIcon(good, new AbortController().signal)).rejects.toMatchObject({ kind: 'transient' });
  });

  it('rejects local/credential URLs before invoking native and cancels an aborted request', async () => {
    let rejectNative: (reason: Error) => void = () => undefined;
    const native = {
      fetch: jest.fn(
        (_url: string, _kind: 'text' | 'icon' | 'avatar', _id: string) =>
          new Promise<never>((_, reject) => {
            rejectNative = reject;
          }),
      ),
      cancel: jest.fn(),
    };
    const transport = createNativeSafePublicTransport(native);
    await expect(transport.readIcon('https://127.0.0.1/icon.png', new AbortController().signal))
      .rejects.toMatchObject({ kind: 'blocked' });
    expect(native.fetch).not.toHaveBeenCalled();

    const controller = new AbortController();
    const pending = transport.readText(good, controller.signal);
    controller.abort();
    await expect(pending).rejects.toMatchObject({ kind: 'cancelled' });
    expect(native.cancel).toHaveBeenCalledWith(native.fetch.mock.calls[0]?.[2]);
    rejectNative(new Error('cancelled'));
    transport.close();
  });

  it('does not reuse native request IDs across AppServices generations', async () => {
    const native = {
      fetch: jest.fn(async (_url: string, _kind: 'text' | 'icon' | 'avatar', _id: string) => ({ text: 'ok' })),
      cancel: jest.fn(),
    };
    const first = createNativeSafePublicTransport(native);
    const next = createNativeSafePublicTransport(native);
    await first.readText(good, new AbortController().signal);
    await next.readText(good, new AbortController().signal);
    expect(native.fetch.mock.calls[0]?.[2]).not.toBe(native.fetch.mock.calls[1]?.[2]);
    first.close();
    next.close();
  });

  it('allows only two in-flight native calls and discards a queued request when cancelled', async () => {
    const pending: Array<(value: { text: string }) => void> = [];
    const native = {
      fetch: jest.fn(() => new Promise<{ text: string }>(resolve => pending.push(resolve))),
      cancel: jest.fn(),
    };
    const transport = createNativeSafePublicTransport(native);
    const first = transport.readText(good, new AbortController().signal);
    const second = transport.readText(good, new AbortController().signal);
    const queuedController = new AbortController();
    const third = transport.readText(good, queuedController.signal);
    expect(native.fetch).toHaveBeenCalledTimes(2);
    queuedController.abort();
    await expect(third).rejects.toMatchObject({ kind: 'cancelled' });
    pending[0]({ text: 'ok' });
    pending[1]({ text: 'ok' });
    await expect(first).resolves.toBe('ok');
    await expect(second).resolves.toBe('ok');
    expect(native.fetch).toHaveBeenCalledTimes(2);
    transport.close();
  });

  it.each(['transient', 'blocked', 'invalid', 'cancelled'] as const)(
    'keeps the %s failure category without native URL or error details',
    async kind => {
      const native = {
        fetch: jest.fn(async () => {
          throw Object.assign(new Error(`private diagnostic: ${good}`), { code: `asset-download-${kind}`, url: good });
        }),
        cancel: jest.fn(),
      };
      const transport = createNativeSafePublicTransport(native);
      const error = await transport.readIcon(good, new AbortController().signal).catch(value => value as unknown);
      expect(error).toBeInstanceOf(PublicAssetError);
      expect(publicAssetFailure(error)).toBe(kind);
      expect(String(error)).toBe(`PublicAssetError: asset-download-${kind}`);
      expect(JSON.stringify(error)).not.toContain(good);
      transport.close();
    },
  );

  it('treats unknown/legacy native errors and queue saturation as transient', async () => {
    expect(publicAssetFailure({ code: 'asset-download-unavailable', message: good })).toBe('transient');
    const native = {
      fetch: jest.fn(() => new Promise<{ text: string }>(() => undefined)),
      cancel: jest.fn(),
    };
    const transport = createNativeSafePublicTransport(native);
    const pending = Array.from({ length: 18 }, () =>
      transport.readText(good, new AbortController().signal).catch(error => publicAssetFailure(error)),
    );
    await expect(transport.readText(good, new AbortController().signal)).rejects.toMatchObject({ kind: 'transient' });
    expect(native.fetch).toHaveBeenCalledTimes(2);
    transport.close();
    expect(await Promise.all(pending)).toEqual(Array(18).fill('cancelled'));
  });

  it.each([
    ['invalid alphabet', 'not-base64'],
    ['invalid padding', 'AAAA='],
    ['byte limit despite valid base64 length', 'A'.repeat(87_384)],
  ])('rejects native image bytes with %s', async (_label, base64) => {
      const native = { fetch: jest.fn(async () => ({ mimeType: 'image/png', base64 })), cancel: jest.fn() };
      const transport = createNativeSafePublicTransport(native);
      await expect(transport.readIcon(good, new AbortController().signal)).rejects.toMatchObject({ kind: 'invalid' });
      transport.close();
    });
});

it('admits real-size address media within its independent budget without widening Token icons', async () => {
  const url = 'https://horizon.stellarcn.org/avatar/v2/G' + 'A'.repeat(55) + '?size=256';
  const base64 = 'A'.repeat(Math.ceil(89_963 / 3) * 4);
  const native = { fetch: jest.fn(async () => ({ mimeType: 'image/png', base64 })), cancel: jest.fn() };
  const port = createNativeSafePublicTransport(native);
  expect((await port.readAvatar(url, new AbortController().signal)).dataUri.length).toBeGreaterThan(119_000);
  expect(native.fetch).toHaveBeenLastCalledWith(url, 'avatar', expect.any(String));
  await expect(port.readIcon(good, new AbortController().signal)).rejects.toThrow();
  await expect(port.readAvatar(good, new AbortController().signal)).rejects.toThrow();
  native.fetch.mockResolvedValueOnce({ mimeType: 'image/png', base64: 'A'.repeat(349_532) });
  await expect(port.readAvatar(url, new AbortController().signal)).rejects.toThrow();
  port.close();
});
