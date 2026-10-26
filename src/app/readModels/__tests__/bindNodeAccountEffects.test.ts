import type { AccountEffectsPort } from '@capabilities/account-sync/AccountEffects';
import { NodeReadError } from '@capabilities/network/NodeReadError';
import { createNodeReadSession } from '../createNodeReadSession';
import { createForegroundAccountSync } from '../createForegroundAccountSync';
import { createLedgerReadRuntime } from '../LedgerReadRuntime';
import { createLedgerReadInvalidationStore } from '../LedgerReadInvalidationStore';
import { bindNodeAccountEffects } from '../bindNodeAccountEffects';
import { createHorizonAccountEffects } from '../../../platform/stellar/HorizonAccountEffects';
async function settle() {
  for (let i = 0; i < 24; i++) await Promise.resolve();
}
beforeEach(() => jest.useFakeTimers());
afterEach(() => {
  jest.clearAllTimers();
  jest.useRealTimers();
});
it('pauses streams, polling and local retries through shared node cooldown, then reconnects on node recovery', async () => {
  const runtime = createLedgerReadRuntime();
  const probe = jest.fn(async () => 'network');
  const node = createNodeReadSession({
    runtime,
    endpoint: 'https://first.test',
    networkPassphrase: 'network',
    probe,
    onState: jest.fn(),
    random: () => 1,
  });
  await settle();
  const streams: Array<Parameters<AccountEffectsPort['open']>[0]> = [];
  const stop = jest.fn();
  const latest = jest.fn(async () => undefined);
  const create = jest.fn((): AccountEffectsPort => ({
    latest,
    open: input => {
      streams.push(input);
      return stop;
    },
  }));
  const sync = createForegroundAccountSync({
    runtime,
    node,
    effects: bindNodeAccountEffects(node, create),
    invalidation: createLedgerReadInvalidationStore(),
    networkId: 'testnet',
    isReading: () => false,
    onFailure: jest.fn(),
  });
  sync.setAccount({ id: 'a', address: 'Ga', networkId: 'testnet', hidden: false, identityKind: 'classic' });
  await settle();
  streams[0].onOpen();
  await settle();
  streams[0].onFailure('failed', new NodeReadError('rate-limited', 120000));
  await settle();
  expect(node.getSnapshot().phase).toBe('cooldown');
  expect(sync.getSnapshot().mode).toBe('paused');
  const calls = create.mock.calls.length;
  jest.advanceTimersByTime(119999);
  await settle();
  expect(create).toHaveBeenCalledTimes(calls);
  jest.advanceTimersByTime(1);
  await settle();
  expect(node.getSnapshot().phase).toBe('healthy');
  expect(streams).toHaveLength(2);
  streams[1].onOpen();
  expect(sync.getSnapshot().mode).toBe('live');
  node.replaceEndpoint('https://second.test');
  await settle();
  expect(create).toHaveBeenLastCalledWith('https://second.test');
  streams[0].onFailure('failed', new NodeReadError('rate-limited', 999999));
  expect(node.getSnapshot().phase).toBe('healthy');
  sync.close();
  node.close();
  await settle();
  expect(jest.getTimerCount()).toBe(0);
});
it('keeps a stream-only failure on REST fallback and treats ordinary scope cancellation as benign', async () => {
  const runtime = createLedgerReadRuntime();
  const node = createNodeReadSession({
    runtime,
    endpoint: 'https://node.test',
    networkPassphrase: 'network',
    probe: async () => 'network',
    onState: jest.fn(),
  });
  await settle();
  let stream!: Parameters<AccountEffectsPort['open']>[0];
  const transport: AccountEffectsPort = {
    open: input => {
      stream = input;
      return jest.fn();
    },
    latest: async () => undefined,
  };
  const bound = bindNodeAccountEffects(node, () => transport);
  const onFailure = jest.fn();
  const onOpen = jest.fn();
  const stop = bound.open({ address: 'Ga', onOpen, onEffect: jest.fn(), onFailure });
  stream.onFailure('failed');
  expect(onFailure).toHaveBeenCalledTimes(1);
  expect(node.getSnapshot().phase).toBe('healthy');
  stop();
  stream.onOpen();
  expect(onOpen).not.toHaveBeenCalled();
  const cancelled = new AbortController();
  cancelled.abort();
  await expect(bound.latest('Ga', cancelled.signal)).rejects.toMatchObject({ kind: 'superseded' });
  expect(node.getSnapshot().phase).toBe('healthy');
  node.close();
});

it.each(['transport', 'json', 'records', 'token'] as const)(
  'shares cooldown for an immediate Effects REST %s failure after a healthy root probe',
  async failure => {
    const runtime = createLedgerReadRuntime();
    const probe = jest.fn(async () => 'network');
    const node = createNodeReadSession({
      runtime,
      endpoint: 'https://node.test',
      networkPassphrase: 'network',
      probe,
      onState: jest.fn(),
      random: () => 1,
    });
    await settle();
    expect(node.getSnapshot().phase).toBe('healthy');
    const xhr = { open: jest.fn(), setRequestHeader: jest.fn(), send: jest.fn(), abort: jest.fn() };
    const createRequest = jest.fn(() => xhr as unknown as XMLHttpRequest);
    const http = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ _embedded: { records: [] } }),
    });
    if (failure === 'transport') http.mockRejectedValueOnce(new Error('private network details'));
    else
      http.mockResolvedValueOnce({
        ok: true,
        json: async () => {
          if (failure === 'json') throw new Error('private response body');
          return failure === 'records' ? { _embedded: { records: {} } } : { _embedded: { records: [{}] } };
        },
      });
    const sync = createForegroundAccountSync({
      runtime,
      node,
      effects: bindNodeAccountEffects(node, endpoint => createHorizonAccountEffects(endpoint, createRequest, http)),
      invalidation: createLedgerReadInvalidationStore(),
      networkId: 'testnet',
      isReading: () => false,
      onFailure: jest.fn(),
    });
    sync.setAccount({ id: 'a', address: 'Ga', networkId: 'testnet', hidden: false, identityKind: 'classic' });
    await settle();
    expect(node.getSnapshot()).toMatchObject({
      phase: 'cooldown',
      failure: failure === 'transport' ? 'unavailable' : 'protocol',
    });
    expect(sync.getSnapshot().mode).toBe('paused');
    expect(xhr.abort).toHaveBeenCalledTimes(1);
    jest.advanceTimersByTime(1999);
    await settle();
    expect(probe).toHaveBeenCalledTimes(1);
    expect(http).toHaveBeenCalledTimes(1);
    expect(createRequest).toHaveBeenCalledTimes(1);
    jest.advanceTimersByTime(1);
    await settle();
    expect(probe).toHaveBeenCalledTimes(2);
    expect(node.getSnapshot().phase).toBe('healthy');
    expect(http).toHaveBeenCalledTimes(2);
    expect(createRequest).toHaveBeenCalledTimes(2);
    sync.close();
    node.close();
    await settle();
    expect(jest.getTimerCount()).toBe(0);
  },
);
