import { createTokenIconPort } from '../TokenIconPort';
const issuer = 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN';
it('shares one download across six consumers of the same identity', async () => {
  const dataUri = 'data:image/png;base64,aGVsbG8=';
  const result = {
    metadata: { source: 'issuer-toml' as const, icons: ['https://example.org/icon.png'] },
    fromCache: false,
    stale: false,
    refreshFailed: false,
  };
  const readIcon = jest.fn(async () => ({ mimeType: 'image/png' as const, dataUri }));
  const metadata = { peek: () => result.metadata, resolve: jest.fn(async () => result), close: jest.fn() };
  const service = createTokenIconPort({
    networkId: 'stellar-testnet',
    metadata,
    transport: { available: true, readIcon, readText: jest.fn(), close: jest.fn() },
    initialEnabled: true,
  });
  const asset = { kind: 'credit' as const, code: 'SCOP', issuer };
  const values = await Promise.all(
    Array.from({ length: 6 }, () => service.loadIcon(asset, new AbortController().signal)),
  );
  expect(values).toEqual(Array(6).fill(dataUri));
  expect(readIcon).toHaveBeenCalledTimes(1);
  service.close();
});

function pendingService() {
  const dataUri = 'data:image/png;base64,aGVsbG8=';
  let complete!: (value: { mimeType: 'image/png'; dataUri: string }) => void;
  let transportSignal!: AbortSignal;
  const readIcon = jest.fn((_url: string, signal: AbortSignal) => {
    transportSignal = signal;
    return new Promise<{ mimeType: 'image/png'; dataUri: string }>(resolve => {
      complete = resolve;
    });
  });
  const metadata = {
    peek: () => ({ source: 'issuer-toml' as const, icons: ['https://example.org/icon.png'] }),
    resolve: jest.fn(async () => ({ fromCache: true, stale: false, refreshFailed: false })),
    close: jest.fn(),
  };
  const service = createTokenIconPort({
    networkId: 'stellar-testnet',
    metadata,
    transport: { available: true, readIcon, readText: jest.fn(), close: jest.fn() },
    initialEnabled: true,
  });
  return {
    service,
    readIcon,
    dataUri,
    signal: () => transportSignal,
    completion: () => complete,
    complete: () => complete({ mimeType: 'image/png', dataUri }),
  };
}
const asset = { kind: 'credit' as const, code: 'SCOP', issuer };
const flush = () => new Promise<void>(resolve => setImmediate(resolve));

it('keeps the shared request alive when one screen unmounts', async () => {
  const fixture = pendingService();
  const home = new AbortController();
  const activity = new AbortController();
  const first = fixture.service.loadIcon(asset, home.signal);
  const second = fixture.service.loadIcon(asset, activity.signal);
  await flush();
  home.abort();
  expect(await first).toBeUndefined();
  expect(fixture.signal().aborted).toBe(false);
  fixture.complete();
  expect(await second).toBe(fixture.dataUri);
  expect(fixture.readIcon).toHaveBeenCalledTimes(1);
  fixture.service.close();
});

it('cancels the transport after the last consumer leaves and allows a fresh request', async () => {
  const fixture = pendingService();
  const controller = new AbortController();
  const first = fixture.service.loadIcon(asset, controller.signal);
  await flush();
  const oldSignal = fixture.signal();
  const oldComplete = fixture.complete;
  controller.abort();
  expect(await first).toBeUndefined();
  expect(oldSignal.aborted).toBe(true);
  // Let the abandoned native result settle before the next transport starts.
  oldComplete();
  await flush();
  expect(fixture.service.readIcon(asset)).toBeUndefined();
  const next = fixture.service.loadIcon(asset, new AbortController().signal);
  await flush();
  fixture.complete();
  expect(await next).toBe(fixture.dataUri);
  expect(fixture.readIcon).toHaveBeenCalledTimes(2);
  fixture.service.close();
});

it.each(['opt-out', 'close'] as const)(
  'immediately settles all consumers on %s and discards late bytes',
  async action => {
    const fixture = pendingService();
    const first = fixture.service.loadIcon(asset, new AbortController().signal);
    const second = fixture.service.loadIcon(asset, new AbortController().signal);
    await flush();
    if (action === 'close') fixture.service.close();
    else fixture.service.setEnabled(false);
    expect(await Promise.all([first, second])).toEqual([undefined, undefined]);
    expect(fixture.signal().aborted).toBe(true);
    fixture.complete();
    await flush();
    expect(fixture.service.readIcon(asset)).toBeUndefined();
    fixture.service.close();
  },
);

it('does not let a retired opt-in session publish into or remove a new shared load', async () => {
  const fixture = pendingService();
  const first = fixture.service.loadIcon(asset, new AbortController().signal);
  await flush();
  const finishOld = fixture.completion();
  fixture.service.setEnabled(false);
  expect(await first).toBeUndefined();
  fixture.service.setEnabled(true);
  const next = fixture.service.loadIcon(asset, new AbortController().signal);
  await flush();
  finishOld({ mimeType: 'image/png', dataUri: 'data:image/png;base64,b2xk' });
  await flush();
  expect(fixture.service.readIcon(asset)).toBeUndefined();
  const joined = fixture.service.loadIcon(asset, new AbortController().signal);
  fixture.complete();
  expect(await Promise.all([next, joined])).toEqual([fixture.dataUri, fixture.dataUri]);
  expect(fixture.readIcon).toHaveBeenCalledTimes(2);
  fixture.service.close();
});
