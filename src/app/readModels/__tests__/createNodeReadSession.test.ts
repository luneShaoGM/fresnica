import { NodeReadError } from '@capabilities/network/NodeReadError';
import { createNodeReadSession, NODE_READ_TIMING as timing } from '../createNodeReadSession';
import { createLedgerReadRuntime } from '../LedgerReadRuntime';
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
async function settle() {
  for (let i = 0; i < 24; i++) await Promise.resolve();
}
function setup() {
  const runtime = createLedgerReadRuntime();
  const probe = jest.fn(async (_endpoint: string, _signal: AbortSignal) => 'expected-network');
  const state = jest.fn();
  const node = createNodeReadSession({
    runtime,
    probe,
    endpoint: 'https://first.test/',
    networkPassphrase: 'expected-network',
    onState: state,
    random: () => 1,
  });
  return { runtime, probe, state, node };
}
beforeEach(() => jest.useFakeTimers());
afterEach(() => {
  jest.clearAllTimers();
  jest.useRealTimers();
});
describe('shared node read session', () => {
  it('validates the network before allowing any read and keeps business request errors separate', async () => {
    const s = setup();
    const load = jest.fn(async () => 'value');
    await expect(s.node.run(load)).rejects.toMatchObject({ kind: 'cooldown' });
    expect(load).not.toHaveBeenCalled();
    await settle();
    expect(s.node.getSnapshot().phase).toBe('healthy');
    await expect(s.node.run(load)).resolves.toBe('value');
    await expect(
      s.node.run(async () => {
        throw new NodeReadError('request');
      }),
    ).rejects.toMatchObject({ kind: 'request' });
    expect(s.node.getSnapshot().phase).toBe('healthy');
    s.node.close();
    await settle();
    expect(jest.getTimerCount()).toBe(0);
  });
  it('rejects a wrong-network endpoint until another endpoint is validated', async () => {
    const s = setup();
    s.probe.mockResolvedValueOnce('wrong-network');
    await settle();
    expect(s.node.getSnapshot()).toMatchObject({ phase: 'wrong-network', failure: 'wrong-network' });
    const load = jest.fn();
    await expect(s.node.run(load)).rejects.toMatchObject({ kind: 'cooldown' });
    expect(load).not.toHaveBeenCalled();
    s.node.replaceEndpoint('https://second.test');
    await settle();
    await expect(s.node.run(async (_signal, endpoint) => endpoint)).resolves.toBe('https://second.test');
    s.node.close();
  });
  it('honors long Retry-After across manual retry, concurrent success and background/foreground', async () => {
    const s = setup();
    await settle();
    const old = deferred<string>();
    const oldResult = s.node.run(() => old.promise).catch((error: unknown) => error);
    await settle();
    await expect(
      s.node.run(async () => {
        throw new NodeReadError('rate-limited', 120000);
      }),
    ).rejects.toMatchObject({ kind: 'rate-limited' });
    old.resolve('late-success');
    expect(await oldResult).toMatchObject({ kind: 'superseded' });
    s.node.retry();
    s.node.retry();
    expect(s.probe).toHaveBeenCalledTimes(1);
    jest.advanceTimersByTime(10000);
    s.runtime.update({ foreground: false, connectivity: 'online' });
    jest.advanceTimersByTime(100000);
    s.runtime.update({ foreground: true, connectivity: 'online' });
    expect(s.node.getSnapshot()).toMatchObject({ phase: 'cooldown', failure: 'rate-limited' });
    const load = jest.fn();
    await expect(s.node.run(load)).rejects.toMatchObject({ kind: 'cooldown' });
    expect(load).not.toHaveBeenCalled();
    jest.advanceTimersByTime(9999);
    expect(s.probe).toHaveBeenCalledTimes(1);
    jest.advanceTimersByTime(1);
    await settle();
    expect(s.probe).toHaveBeenCalledTimes(2);
    expect(s.node.getSnapshot().phase).toBe('healthy');
    s.node.retry();
    expect(s.probe).toHaveBeenCalledTimes(2);
    s.node.close();
  });
  it('times out and logically cancels a transport that ignores abort, then rejects late success', async () => {
    const s = setup();
    await settle();
    const response = deferred<string>();
    let signal!: AbortSignal;
    const request = s.node.run(received => {
      signal = received;
      return response.promise;
    });
    const result = request.catch((error: unknown) => error);
    await settle();
    jest.advanceTimersByTime(timing.timeout);
    expect(await result).toMatchObject({ kind: 'timeout' });
    expect(signal.aborted).toBe(true);
    expect(s.node.getSnapshot().phase).toBe('cooldown');
    jest.advanceTimersByTime(timing.retry);
    await settle();
    const current = s.node.getSnapshot();
    response.resolve('obsolete');
    await settle();
    expect(s.node.getSnapshot()).toBe(current);
    s.node.close();
  });
  it('isolates old reads and probe responses across endpoint changes', async () => {
    const s = setup();
    const oldProbe = deferred<string>();
    s.probe.mockReturnValueOnce(oldProbe.promise);
    await settle();
    s.node.replaceEndpoint('https://second.test');
    await settle();
    oldProbe.resolve('wrong-network');
    await settle();
    expect(s.node.getSnapshot()).toMatchObject({ endpoint: 'https://second.test', phase: 'healthy' });
    const response = deferred<string>();
    const old = s.node.run(() => response.promise).catch((error: unknown) => error);
    await settle();
    const oldLease = s.node.getSnapshot().generation;
    s.node.replaceEndpoint('https://third.test');
    await settle();
    response.resolve('old-node-data');
    expect(await old).toMatchObject({ kind: 'superseded' });
    s.node.reportFailure(new NodeReadError('rate-limited', 600000), oldLease);
    expect(s.node.getSnapshot()).toMatchObject({ endpoint: 'https://third.test', phase: 'healthy' });
    s.node.close();
  });
  it('does not diagnose ordinary runtime/caller cancellation as a node outage or dispatch an already aborted request', async () => {
    const s = setup();
    await settle();
    const controller = new AbortController();
    controller.abort();
    const load = jest.fn();
    await expect(s.node.run(load, controller.signal)).rejects.toMatchObject({ kind: 'superseded' });
    expect(load).not.toHaveBeenCalled();
    const response = deferred<string>();
    const old = s.node.run(() => response.promise).catch((error: unknown) => error);
    await settle();
    s.runtime.update({ foreground: false, connectivity: 'offline' });
    expect(await old).toMatchObject({ kind: 'superseded' });
    expect(s.node.getSnapshot()).toMatchObject({ phase: 'paused' });
    expect(s.node.getSnapshot().failure).toBeUndefined();
    jest.advanceTimersByTime(300000);
    expect(s.probe).toHaveBeenCalledTimes(1);
    s.runtime.update({ foreground: true, connectivity: 'online' });
    await settle();
    expect(s.node.getSnapshot().phase).toBe('healthy');
    s.node.close();
  });
  it('uses capped backoff for a persistently broken route despite successful root probes', async () => {
    const s = setup();
    await settle();
    for (let i = 0; i < 8; i++) {
      await expect(
        s.node.run(async () => {
          throw new NodeReadError('unavailable');
        }),
      ).rejects.toMatchObject({ kind: 'unavailable' });
      const count = s.probe.mock.calls.length;
      const delay = Math.min(timing.maxRetry, timing.retry * 2 ** Math.min(i, 5));
      jest.advanceTimersByTime(delay - 1);
      expect(s.probe).toHaveBeenCalledTimes(count);
      jest.advanceTimersByTime(1);
      await settle();
      expect(s.node.getSnapshot().phase).toBe('healthy');
    }
    s.node.close();
    await settle();
    expect(jest.getTimerCount()).toBe(0);
  });
  it('recovers from malformed/request-level root failures instead of remaining stuck checking', async () => {
    const s = setup();
    s.probe.mockRejectedValueOnce(new NodeReadError('request'));
    await settle();
    expect(s.node.getSnapshot()).toMatchObject({ phase: 'cooldown', failure: 'protocol' });
    jest.advanceTimersByTime(timing.retry);
    await settle();
    expect(s.node.getSnapshot().phase).toBe('healthy');
    s.node.close();
  });
  it('invalid endpoints preserve the active session and close rejects all late work without new timers', async () => {
    const s = setup();
    await settle();
    const before = s.node.getSnapshot();
    for (const endpoint of [
      'http://insecure.test',
      'https://user:pass@secret.test',
      'https://node.test?token=x',
      'https://node.test#fragment',
    ])
      expect(() => s.node.replaceEndpoint(endpoint)).toThrow('invalid-horizon-endpoint');
    expect(s.node.getSnapshot()).toBe(before);
    const response = deferred<string>();
    const old = s.node.run(() => response.promise).catch((error: unknown) => error);
    await settle();
    s.node.close();
    s.node.close();
    response.resolve('late');
    expect(await old).toMatchObject({ kind: 'superseded' });
    s.node.retry();
    await expect(s.node.run(async () => 'no')).rejects.toMatchObject({ kind: 'paused' });
    await settle();
    expect(jest.getTimerCount()).toBe(0);
  });
});
