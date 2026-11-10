import { createAccountAvatarPort, accountAvatarAddress } from '../AccountAvatars';
const address = 'G' + 'A'.repeat(55);
const muxed = 'M' + 'B'.repeat(68);
const uri = 'data:image/png;base64,AAAA';
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => {
    resolve = done;
  });
  return { promise, resolve };
}
function create(
  initialEnabled = false,
  loadImage: (url: string, signal: AbortSignal) => Promise<string> = jest.fn(async () => uri),
) {
  const port = createAccountAvatarPort({ available: true, initialEnabled, loadImage });
  port.setReadable(true);
  return { port, loadImage };
}
it('defaults to no requests; independently opt-in accepts only exact public identity and the fixed provider', async () => {
  const { port, loadImage } = create();
  expect(await port.load(address, new AbortController().signal)).toBeUndefined();
  expect(loadImage).not.toHaveBeenCalled();
  port.setEnabled(true);
  for (const value of [
    '',
    'secret',
    'S' + 'A'.repeat(55),
    address + '?x=1',
    address.toLowerCase(),
    'https://example.org',
  ])
    expect(await port.load(value, new AbortController().signal)).toBeUndefined();
  expect(await port.load(' ' + address + ' ', new AbortController().signal)).toBe(uri);
  expect(loadImage).toHaveBeenLastCalledWith(
    `https://horizon.stellarcn.org/avatar/v2/${address}?size=256`,
    expect.anything(),
  );
  expect(await port.load(muxed, new AbortController().signal)).toBe(uri);
  expect(loadImage).toHaveBeenLastCalledWith(
    `https://horizon.stellarcn.org/avatar/v2/${muxed}?size=256`,
    expect.anything(),
  );
  expect(accountAvatarAddress('unknown')).toBeUndefined();
  port.close();
});
it.each(['off', 'offline', 'close', 'caller'] as const)(
  'fences late proof after %s and never repopulates memory',
  async change => {
    const pending = deferred<string>();
    const { port } = create(
      true,
      jest.fn(() => pending.promise),
    );
    const controller = new AbortController();
    const request = port.load(address, controller.signal);
    await Promise.resolve();
    if (change === 'off') port.setEnabled(false);
    if (change === 'offline') port.setReadable(false);
    if (change === 'close') port.close();
    if (change === 'caller') controller.abort();
    expect(await request).toBeUndefined();
    pending.resolve(uri);
    await Promise.resolve();
    await Promise.resolve();
    expect(port.read(address)).toBeUndefined();
    port.close();
  },
);
it('bounds two active loads; one caller abort cannot cancel another; duplicate queued identities reuse memory', async () => {
  const pending = [deferred<string>(), deferred<string>()];
  let next = 0;
  const loader = jest.fn((_url: string, _signal: AbortSignal) => pending[next++].promise);
  const { port } = create(true, loader);
  const a = new AbortController();
  const b = new AbortController();
  const first = port.load(address, a.signal);
  const second = port.load(muxed, b.signal);
  const duplicate = port.load(muxed, new AbortController().signal);
  await Promise.resolve();
  expect(loader).toHaveBeenCalledTimes(2);
  a.abort();
  expect(await first).toBeUndefined();
  expect(loader.mock.calls[1][1].aborted).toBe(false);
  pending[0].resolve(uri);
  pending[1].resolve(uri);
  expect(await second).toBe(uri);
  expect(await duplicate).toBe(uri);
  expect(loader).toHaveBeenCalledTimes(2);
  port.close();
});
it('expires and evicts bounded memory, rejects non-inline images and clears on OFF', async () => {
  let now = 0;
  const loadImage = jest.fn(async () => uri);
  const port = createAccountAvatarPort({ available: true, initialEnabled: true, loadImage, now: () => now });
  port.setReadable(true);
  await port.load(address, new AbortController().signal);
  expect(port.read(address)).toBe(uri);
  now = 600_001;
  expect(port.read(address)).toBeUndefined();
  loadImage.mockResolvedValueOnce('https://example.org/image.png');
  expect(await port.load(address, new AbortController().signal)).toBeUndefined();
  loadImage.mockResolvedValueOnce('data:image/png;base64,' + 'A'.repeat(90_000));
  expect(await port.load(address, new AbortController().signal)).toBeUndefined();
  await port.load(address, new AbortController().signal);
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  for (let i = 1; i <= 65; i++)
    await port.load(
      'G' + 'A'.repeat(53) + alphabet[Math.floor(i / 32)] + alphabet[i % 32],
      new AbortController().signal,
    );
  expect(port.read(address)).toBeUndefined();
  await port.load(address, new AbortController().signal);
  port.reject(address, uri);
  expect(port.read(address)).toBeUndefined();
  await port.load(address, new AbortController().signal);
  port.setEnabled(false);
  port.setEnabled(true);
  expect(port.read(address)).toBeUndefined();
  port.close();
});
it('returns fallback at six seconds even when transport ignores cancellation', async () => {
  jest.useFakeTimers();
  const pending = deferred<string>();
  const { port } = create(
    true,
    jest.fn(() => pending.promise),
  );
  const request = port.load(address, new AbortController().signal);
  await jest.advanceTimersByTimeAsync(6000);
  expect(await request).toBeUndefined();
  pending.resolve(uri);
  await Promise.resolve();
  await Promise.resolve();
  expect(port.read(address)).toBeUndefined();
  port.close();
  jest.useRealTimers();
});
