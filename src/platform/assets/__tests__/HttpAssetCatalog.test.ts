import { createHttpAssetCatalog } from '../HttpAssetCatalog';

function response(body: string, length = '10') {
  return { ok: true, headers: { get: () => length }, text: async () => body } as unknown as Response;
}
describe('asset catalog HTTP adapter', () => {
  it('uses bounded cancellable HTTPS requests and rejects local/HTTP input', async () => {
    const http = jest.fn(async () => response('[]'));
    const catalog = createHttpAssetCatalog(http);
    const signal = new AbortController().signal;
    expect(await catalog.read('example.com/assets.json', signal)).toBe('[]');
    expect(http).toHaveBeenCalledWith(
      'https://example.com/assets.json',
      expect.objectContaining({ redirect: 'error' }),
    );
    await expect(catalog.read('http://example.com', signal)).rejects.toThrow();
    await expect(catalog.read('https://127.0.0.1', signal)).rejects.toThrow();
    expect(http).toHaveBeenCalledTimes(1);
  });
  it('rejects oversized bodies and obsolete responses even if transport ignores abort', async () => {
    const controller = new AbortController();
    const large = createHttpAssetCatalog(jest.fn(async () => response('[]', '1000001')));
    await expect(large.read('https://example.com', controller.signal)).rejects.toThrow();
    const catalog = createHttpAssetCatalog(
      jest.fn(async () => {
        controller.abort();
        return response('[]');
      }),
    );
    await expect(catalog.read('https://example.com', controller.signal)).rejects.toThrow();
  });
  it('aborts a hung request after ten seconds', async () => {
    jest.useFakeTimers();
    const http = jest.fn(
      (_url: string | URL | Request, options?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          options?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
        }),
    );
    const result = createHttpAssetCatalog(http).read('https://example.com', new AbortController().signal);
    const rejected = result.catch((error: unknown) => error);
    jest.advanceTimersByTime(10_000);
    expect(await rejected).toEqual(new Error('aborted'));
    jest.useRealTimers();
  });
});
