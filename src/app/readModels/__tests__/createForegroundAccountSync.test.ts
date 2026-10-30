import { createDisplayReadGateway } from '../createDisplayReadGateway';
import { loadBalanceSnapshot } from '@capabilities/balance/loadBalanceSnapshot';
import type { HistoryOperationResult } from '@capabilities/history/HistoryGateway';
import type { StellarAccountBalanceResult } from '@capabilities/stellar/types';
import type { AccountRecord } from '@capabilities/account/types';
import type { AccountEffectsPort } from '@capabilities/account-sync/AccountEffects';
import { createForegroundAccountSync, ACCOUNT_SYNC_TIMING as timing } from '../createForegroundAccountSync';
import { createLedgerReadInvalidationStore } from '../LedgerReadInvalidationStore';
import { createLedgerReadRuntime } from '../LedgerReadRuntime';

const account = (id = 'a'): AccountRecord => ({
  id,
  address: `G${id}`,
  networkId: 'testnet',
  identityKind: 'classic',
  hidden: false,
  label: id,
  sortOrder: 0,
  createdAt: new Date(0),
  updatedAt: new Date(0),
});
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => {
    resolve = done;
  });
  return { promise, resolve };
}
async function settle() {
  for (let i = 0; i < 16; i++) await Promise.resolve();
}
function setup() {
  const runtime = createLedgerReadRuntime();
  const invalidation = createLedgerReadInvalidationStore();
  const streams: Array<Parameters<AccountEffectsPort['open']>[0] & { stop: jest.Mock }> = [];
  const latest = jest
    .fn<ReturnType<AccountEffectsPort['latest']>, Parameters<AccountEffectsPort['latest']>>()
    .mockResolvedValue(undefined);
  const effects: AccountEffectsPort = {
    latest,
    open: input => {
      const stop = jest.fn();
      streams.push({ ...input, stop });
      return stop;
    },
  };
  const confirmMissing = jest.fn(async (_address: string) => false);
  const failure = jest.fn();
  const reading = jest.fn(() => false);
  const sync = createForegroundAccountSync({
    runtime,
    invalidation,
    effects,
    confirmMissing,
    networkId: 'testnet',
    onFailure: failure,
    isReading: reading,
    random: () => 1,
  });
  const revision = (id = 'a') => invalidation.getRevision('testnet', id);
  return { runtime, invalidation, streams, latest, confirmMissing, failure, reading, sync, revision };
}
beforeEach(() => jest.useFakeTimers());
afterEach(() => {
  jest.clearAllTimers();
  jest.useRealTimers();
});

describe('selected-account foreground sync', () => {
  it('reconciles after handshake, coalesces effects and deduplicates opaque tokens without arithmetic', async () => {
    const s = setup();
    s.sync.setAccount(account());
    await settle();
    s.streams[0].onOpen();
    await settle();
    jest.advanceTimersByTime(timing.coalesce);
    const initial = s.revision();
    const token = '900719925474099399999-opaque';
    s.streams[0].onEffect(token);
    s.streams[0].onEffect(token);
    s.streams[0].onEffect('next');
    expect(s.revision()).toBe(initial);
    jest.advanceTimersByTime(timing.coalesce);
    expect(s.revision()).toBe(initial + 1);
    s.streams[0].onEffect(token);
    jest.advanceTimersByTime(timing.coalesce);
    expect(s.revision()).toBe(initial + 1);
    expect(s.sync.getSnapshot()).toEqual({ accountId: 'a', mode: 'live' });
    s.sync.close();
  });
  it('keeps a later dirty revision when another event arrives during a pending display read', async () => {
    const s = setup();
    s.sync.setAccount(account());
    await settle();
    jest.advanceTimersByTime(timing.coalesce);
    const first = s.revision();
    s.streams[0].onEffect('one');
    jest.advanceTimersByTime(timing.coalesce);
    const readRevision = s.revision();
    s.streams[0].onEffect('two');
    jest.advanceTimersByTime(timing.coalesce);
    expect(readRevision).toBe(first + 1);
    expect(s.revision()).toBe(readRevision + 1);
    s.sync.close();
  });
  it('covers an effect missed while the initial stream request is handshaking', async () => {
    const s = setup();
    s.latest.mockResolvedValueOnce('old').mockResolvedValueOnce('arrived-during-handshake');
    s.sync.setAccount(account());
    await settle();
    jest.advanceTimersByTime(timing.coalesce);
    const before = s.revision();
    s.streams[0].onOpen();
    await settle();
    jest.advanceTimersByTime(timing.coalesce);
    expect(s.latest).toHaveBeenCalledTimes(2);
    expect(s.revision()).toBeGreaterThan(before);
    s.sync.close();
  });
  it('times out a silent handshake and retries with bounded backoff while polling remains active', async () => {
    const s = setup();
    s.sync.setAccount(account());
    await settle();
    jest.advanceTimersByTime(timing.connect);
    await settle();
    expect(s.streams[0].stop).toHaveBeenCalledTimes(1);
    expect(s.sync.getSnapshot().mode).toBe('polling');
    jest.advanceTimersByTime(timing.retry);
    expect(s.streams).toHaveLength(2);
    s.streams[1].onFailure('failed');
    await settle();
    jest.advanceTimersByTime(timing.retry);
    expect(s.streams).toHaveLength(2);
    jest.advanceTimersByTime(timing.retry);
    expect(s.streams).toHaveLength(3);
    s.sync.close();
  });
  it('resumes with the opaque cursor, ignores replay and resets a rejected cursor', async () => {
    const s = setup();
    s.sync.setAccount(account());
    await settle();
    s.streams[0].onOpen();
    s.streams[0].onEffect('opaque:9007199254740993');
    s.streams[0].onEffect('newer');
    s.streams[0].onEffect('opaque:9007199254740993');
    s.streams[0].onFailure('failed');
    await settle();
    jest.advanceTimersByTime(timing.retry);
    expect(s.streams[1].cursor).toBe('newer');
    s.streams[1].onFailure('cursor-rejected');
    await settle();
    jest.advanceTimersByTime(timing.retry * 2);
    expect(s.streams[2].cursor).toBeUndefined();
    s.sync.close();
  });
  it('revalidates unchanged fallback checkpoints too, so a failed display read can recover', async () => {
    const s = setup();
    s.sync.setAccount(account());
    await settle();
    s.streams[0].onFailure('failed');
    await settle();
    jest.advanceTimersByTime(timing.coalesce);
    const before = s.revision();
    jest.advanceTimersByTime(timing.poll);
    await settle();
    jest.advanceTimersByTime(timing.coalesce);
    expect(s.revision()).toBeGreaterThan(before);
    s.sync.close();
  });
  it('detects a silent stream from changed REST checkpoints and falls back, then reopens', async () => {
    const s = setup();
    s.latest.mockResolvedValue('old');
    s.sync.setAccount(account());
    await settle();
    s.streams[0].onOpen();
    await settle();
    jest.advanceTimersByTime(timing.coalesce);
    s.latest.mockResolvedValue('missed');
    jest.advanceTimersByTime(timing.health);
    await settle();
    expect(s.sync.getSnapshot().mode).toBe('polling');
    expect(s.streams[0].stop).toHaveBeenCalledTimes(1);
    jest.advanceTimersByTime(timing.retry);
    s.streams[1].onOpen();
    s.streams[1].onEffect('created');
    await settle();
    expect(s.sync.getSnapshot().mode).toBe('live');
    s.sync.close();
  });
  it('does not reconnect a healthy stream when REST lags behind an already delivered event', async () => {
    const s = setup();
    s.latest.mockResolvedValue('old');
    s.sync.setAccount(account());
    await settle();
    s.streams[0].onOpen();
    await settle();
    s.streams[0].onEffect('one');
    s.streams[0].onEffect('two');
    s.latest.mockResolvedValue('one');
    jest.advanceTimersByTime(timing.health);
    await settle();
    expect(s.sync.getSnapshot().mode).toBe('live');
    expect(s.streams[0].stop).not.toHaveBeenCalled();
    s.sync.close();
  });
  it('bounds a hanging REST probe even when transport ignores abort and ignores its late result', async () => {
    const s = setup();
    const response = deferred<string>();
    s.latest.mockReturnValueOnce(response.promise);
    s.sync.setAccount(account());
    await settle();
    s.streams[0].onOpen();
    jest.advanceTimersByTime(timing.probe);
    await settle();
    expect(s.latest.mock.calls[0][1].aborted).toBe(true);
    expect(s.failure).toHaveBeenCalledTimes(1);
    expect(s.sync.getSnapshot().mode).toBe('polling');
    response.resolve('late');
    await settle();
    s.sync.close();
  });
  it('does not let a checkpoint started before reconnect tear down the new connection', async () => {
    const s = setup();
    s.latest.mockResolvedValue('old');
    s.sync.setAccount(account());
    await settle();
    const response = deferred<string>();
    s.latest.mockReturnValueOnce(response.promise);
    s.streams[0].onOpen();
    await settle();
    s.streams[0].onFailure('failed');
    jest.advanceTimersByTime(timing.retry);
    s.streams[1].onOpen();
    s.latest.mockResolvedValue('in-flight');
    response.resolve('in-flight');
    await settle();
    expect(s.sync.getSnapshot().mode).toBe('live');
    expect(s.streams[1].stop).not.toHaveBeenCalled();
    s.sync.close();
  });
  it('caps reconnect backoff and keeps one retry owner through repeated failures', async () => {
    const s = setup();
    s.sync.setAccount(account());
    await settle();
    for (let i = 0; i < 9; i++) {
      const stream = s.streams[s.streams.length - 1];
      stream.onFailure('failed');
      stream.onFailure('failed');
      await settle();
      const count = s.streams.length;
      const delay = Math.min(timing.maxRetry, timing.retry * 2 ** Math.min(i, 5));
      jest.advanceTimersByTime(delay - 1);
      await settle();
      expect(s.streams).toHaveLength(count);
      jest.advanceTimersByTime(1);
      await settle();
      expect(s.streams).toHaveLength(count + 1);
    }
    s.sync.close();
    expect(jest.getTimerCount()).toBe(0);
  });
  it('invalidates the real Balance display gate while an older request is still pending', async () => {
    const s = setup();
    s.sync.setAccount(account());
    await settle();
    jest.advanceTimersByTime(timing.coalesce);
    const response = deferred<StellarAccountBalanceResult>();
    const loadAccountBalances = jest
      .fn()
      .mockReturnValueOnce(response.promise)
      .mockResolvedValue({ status: 'active', address: 'Ga', balances: [{ kind: 'native', balance: '2.0000000' }] });
    const gateway = createDisplayReadGateway({
      runtime: s.runtime,
      getAccountRevision: () => String(s.revision()),
      gateway: {
        loadAccountBalances,
        loadAccountOperations: async () => ({ status: 'active', address: 'Ga', records: [] }),
        loadOperation: async () => ({ status: 'not-found' }),
      },
    });
    const old = loadBalanceSnapshot({ gateway, networkId: 'testnet' }, account());
    const rejected = old.catch((error: unknown) => error);
    await settle();
    s.streams[0].onEffect('receipt');
    jest.advanceTimersByTime(timing.coalesce);
    const current = await loadBalanceSnapshot({ gateway, networkId: 'testnet' }, account());
    expect(current).toMatchObject({ status: 'active', balances: [{ balance: '2.0000000' }] });
    response.resolve({ status: 'inactive', address: 'Ga' });
    expect(await rejected).toEqual(new Error('ledger-read-superseded'));
    expect(loadAccountBalances).toHaveBeenCalledTimes(2);
    s.sync.close();
  });
  it('retains one dirty follow-up during slow reads instead of starving them under continuous effects', async () => {
    const s = setup();
    s.sync.setAccount(account());
    await settle();
    jest.advanceTimersByTime(timing.coalesce);
    const before = s.revision();
    s.reading.mockReturnValue(true);
    for (let i = 0; i < 20; i++) {
      s.streams[0].onEffect(String(i));
      jest.advanceTimersByTime(timing.coalesce);
    }
    expect(s.revision()).toBe(before);
    s.reading.mockReturnValue(false);
    jest.advanceTimersByTime(timing.coalesce);
    expect(s.revision()).toBe(before + 1);
    s.sync.close();
  });
  it('waits for the initial display read instead of expiring the first dirty batch immediately', async () => {
    const s = setup();
    s.reading.mockReturnValue(true);
    s.sync.setAccount(account());
    s.streams[0].onOpen();
    await settle();
    jest.advanceTimersByTime(timing.coalesce);
    expect(s.revision()).toBe(0);
    s.reading.mockReturnValue(false);
    jest.advanceTimersByTime(timing.coalesce);
    expect(s.revision()).toBe(1);
    s.sync.close();
  });
  it('preserves real Balance/History reads after more than 30 seconds of quiet, then dispatches one dirty follow-up', async () => {
    const s = setup();
    s.sync.setAccount(account());
    s.streams[0].onOpen();
    await settle();
    jest.advanceTimersByTime(timing.coalesce);
    const before = s.revision();
    // The health checkpoint is still pending; no checkpoint invalidation masks the quiet interval.
    s.latest.mockReturnValue(deferred<string>().promise);
    jest.advanceTimersByTime(timing.maxReadWait + 1000);
    await settle();
    expect(s.revision()).toBe(before);
    const balance = deferred<StellarAccountBalanceResult>();
    const history = deferred<HistoryOperationResult>();
    const loadAccountBalances = jest
      .fn()
      .mockReturnValueOnce(balance.promise)
      .mockResolvedValue({ status: 'active', address: 'Ga', balances: [{ kind: 'native', balance: '2.0000000' }] });
    const loadAccountOperations = jest
      .fn()
      .mockReturnValueOnce(history.promise)
      .mockResolvedValue({ status: 'active', address: 'Ga', records: [] });
    const gateway = createDisplayReadGateway({
      runtime: s.runtime,
      getAccountRevision: () => String(s.revision()),
      gateway: { loadAccountBalances, loadAccountOperations, loadOperation: async () => ({ status: 'not-found' }) },
    });
    s.reading.mockImplementation(() => gateway.hasPendingReads('Ga'));
    const pendingBalance = loadBalanceSnapshot({ gateway, networkId: 'testnet' }, account());
    const pendingHistory = gateway.loadAccountOperations({ address: 'Ga', limit: 5 });
    await settle();
    s.streams[0].onEffect('receipt-after-quiet');
    jest.advanceTimersByTime(timing.coalesce * 4);
    expect(s.revision()).toBe(before);
    expect(loadAccountBalances).toHaveBeenCalledTimes(1);
    expect(loadAccountOperations).toHaveBeenCalledTimes(1);
    balance.resolve({ status: 'inactive', address: 'Ga' });
    await expect(pendingBalance).resolves.toEqual({ status: 'inactive', address: 'Ga' });
    jest.advanceTimersByTime(timing.coalesce);
    expect(s.revision()).toBe(before); // History is still running.
    history.resolve({ status: 'inactive', address: 'Ga' });
    await expect(pendingHistory).resolves.toEqual({ status: 'inactive', address: 'Ga' });
    jest.advanceTimersByTime(timing.coalesce);
    expect(s.revision()).toBe(before + 1);
    await expect(loadBalanceSnapshot({ gateway, networkId: 'testnet' }, account())).resolves.toMatchObject({
      balances: [{ balance: '2.0000000' }],
    });
    await expect(gateway.loadAccountOperations({ address: 'Ga', limit: 5 })).resolves.toMatchObject({
      status: 'active',
    });
    expect(loadAccountBalances).toHaveBeenCalledTimes(2);
    expect(loadAccountOperations).toHaveBeenCalledTimes(2);
    s.sync.close();
  });
  it('starts a full bounded wait after quiet and does not extend its deadline for later effects', async () => {
    const s = setup();
    s.sync.setAccount(account());
    s.streams[0].onOpen();
    await settle();
    jest.advanceTimersByTime(timing.coalesce);
    s.latest.mockReturnValue(deferred<string>().promise);
    jest.advanceTimersByTime(timing.maxReadWait + 1000);
    await settle();
    const before = s.revision();
    s.reading.mockReturnValue(true);
    for (let i = 0; i < timing.maxReadWait / timing.coalesce; i++) {
      s.streams[0].onEffect(`continuous-${i}`);
      expect(s.revision()).toBe(before);
      jest.advanceTimersByTime(timing.coalesce);
    }
    expect(s.revision()).toBe(before + 1);
    s.sync.close();
  });
  it('bounds the dirty wait if an underlying display read never settles', async () => {
    const s = setup();
    s.sync.setAccount(account());
    await settle();
    jest.advanceTimersByTime(timing.coalesce);
    const before = s.revision();
    s.reading.mockReturnValue(true);
    s.streams[0].onEffect('receipt');
    jest.advanceTimersByTime(timing.maxReadWait);
    expect(s.revision()).toBe(before + 1);
    s.sync.close();
  });
  it('uses real gateway activity to let a slow read complete then revalidate all accumulated receipts', async () => {
    const s = setup();
    s.sync.setAccount(account());
    await settle();
    jest.advanceTimersByTime(timing.coalesce);
    const before = s.revision();
    const response = deferred<StellarAccountBalanceResult>();
    const loadAccountBalances = jest
      .fn()
      .mockReturnValueOnce(response.promise)
      .mockResolvedValue({ status: 'active', address: 'Ga', balances: [{ kind: 'native', balance: '2.0000000' }] });
    const gateway = createDisplayReadGateway({
      runtime: s.runtime,
      getAccountRevision: () => String(s.revision()),
      gateway: {
        loadAccountBalances,
        loadAccountOperations: async () => ({ status: 'active', address: 'Ga', records: [] }),
        loadOperation: async () => ({ status: 'not-found' }),
      },
    });
    s.reading.mockImplementation(() => gateway.hasPendingReads('Ga'));
    const pending = loadBalanceSnapshot({ gateway, networkId: 'testnet' }, account());
    await settle();
    for (let i = 0; i < 20; i++) {
      s.streams[0].onEffect(String(i));
      jest.advanceTimersByTime(timing.coalesce);
    }
    expect(s.revision()).toBe(before);
    response.resolve({ status: 'active', address: 'Ga', balances: [{ kind: 'native', balance: '1.0000000' }] });
    await expect(pending).resolves.toMatchObject({ balances: [{ balance: '1.0000000' }] });
    jest.advanceTimersByTime(timing.coalesce);
    expect(s.revision()).toBe(before + 1);
    await expect(loadBalanceSnapshot({ gateway, networkId: 'testnet' }, account())).resolves.toMatchObject({
      balances: [{ balance: '2.0000000' }],
    });
    expect(loadAccountBalances).toHaveBeenCalledTimes(2);
    s.sync.close();
  });
  it('quietly checks confirmed missing accounts at 60 seconds and restores live sync on funding', async () => {
    const s = setup();
    s.latest.mockResolvedValueOnce(null).mockResolvedValueOnce(null).mockResolvedValueOnce('created');
    s.sync.setAccount(account());
    await settle();
    expect(s.sync.getSnapshot().mode).toBe('inactive');
    expect(s.streams[0].stop).toHaveBeenCalledTimes(1);
    jest.advanceTimersByTime(timing.coalesce);
    const firstRevision = s.revision();
    jest.advanceTimersByTime(59000);
    await settle();
    expect(s.latest).toHaveBeenCalledTimes(1);
    expect(s.revision()).toBe(firstRevision);
    expect(s.streams).toHaveLength(1);
    jest.advanceTimersByTime(1000);
    await settle();
    expect(s.latest).toHaveBeenCalledTimes(2);
    expect(s.sync.getSnapshot().mode).toBe('inactive');
    jest.advanceTimersByTime(60000);
    await settle();
    expect(s.latest).toHaveBeenCalledTimes(3);
    expect(s.streams).toHaveLength(2);
    s.latest.mockResolvedValue('created');
    s.streams[1].onOpen();
    s.streams[1].onEffect('created');
    await settle();
    jest.advanceTimersByTime(timing.coalesce);
    expect(s.sync.getSnapshot().mode).toBe('live');
    expect(s.revision()).toBeGreaterThan(firstRevision);
    s.sync.close();
  });

  it.each([
    { initiallyMissing: true, result: 'created' },
    { initiallyMissing: true, result: undefined },
    { initiallyMissing: false, result: 'existing-effect' },
    { initiallyMissing: false, result: undefined },
  ])('retains successful REST existence evidence before SSE events (%j)', async ({ initiallyMissing, result }) => {
    const s = setup();
    if (initiallyMissing) s.latest.mockResolvedValueOnce(null);
    s.latest.mockResolvedValueOnce(result).mockResolvedValue(null);
    s.sync.setAccount(account());
    await settle();
    if (initiallyMissing) {
      expect(s.sync.getSnapshot().mode).toBe('inactive');
      jest.advanceTimersByTime(timing.inactivePoll);
      await settle();
    }
    const stream = s.streams[s.streams.length - 1];
    stream.onOpen();
    await settle();
    expect(s.confirmMissing).toHaveBeenCalledWith('Ga');
    expect(s.sync.getSnapshot().mode).toBe('live');
    expect(stream.stop).not.toHaveBeenCalled();
    for (let i = 0; i < 3; i++) {
      const confirmations = s.confirmMissing.mock.calls.length;
      jest.advanceTimersByTime(timing.health);
      await settle();
      expect(s.confirmMissing.mock.calls.length).toBeGreaterThan(confirmations);
      expect(s.sync.getSnapshot().mode).toBe('live');
      expect(stream.stop).not.toHaveBeenCalled();
    }
    const before = s.revision();
    stream.onEffect('next-payment');
    jest.advanceTimersByTime(timing.coalesce);
    expect(s.revision()).toBeGreaterThan(before);
    s.confirmMissing.mockResolvedValue(true);
    jest.advanceTimersByTime(timing.health);
    await settle();
    expect(s.sync.getSnapshot().mode).toBe('inactive');
    expect(stream.stop).toHaveBeenCalledTimes(1);
    s.sync.close();
    expect(jest.getTimerCount()).toBe(0);
  });

  it('keeps live effects through delayed and repeated lagging 404s until REST catches up', async () => {
    const s = setup();
    const old = deferred<string | null>();
    s.latest.mockReturnValueOnce(old.promise).mockResolvedValue(null);
    s.sync.setAccount(account());
    await settle();
    s.streams[0].onOpen();
    s.streams[0].onEffect('created');
    old.resolve(null);
    await settle();
    expect(s.latest).toHaveBeenCalledTimes(2);
    expect(s.sync.getSnapshot().mode).toBe('live');
    expect(s.streams[0].stop).not.toHaveBeenCalled();
    for (let i = 0; i < 3; i++) {
      jest.advanceTimersByTime(timing.health);
      await settle();
      expect(s.sync.getSnapshot().mode).toBe('live');
      expect(s.streams[0].stop).not.toHaveBeenCalled();
    }
    const before = s.revision();
    s.streams[0].onEffect('new-payment');
    jest.advanceTimersByTime(timing.coalesce);
    expect(s.revision()).toBeGreaterThan(before);
    s.latest.mockResolvedValue('new-payment');
    jest.advanceTimersByTime(timing.health);
    await settle();
    expect(s.sync.getSnapshot().mode).toBe('live');
    // A later independently confirmed disappearance still retires the stream.
    s.confirmMissing.mockResolvedValue(true);
    s.latest.mockResolvedValue(null);
    jest.advanceTimersByTime(timing.health);
    await settle();
    expect(s.sync.getSnapshot().mode).toBe('inactive');
    expect(s.streams[0].stop).toHaveBeenCalledTimes(1);
    s.sync.close();
    expect(jest.getTimerCount()).toBe(0);
  });

  it.each(['failed', 'cursor-rejected', 'background', 'offline'] as const)(
    'retains account existence evidence across %s until authoritative removal',
    async reason => {
      const s = setup();
      s.sync.setAccount(account());
      await settle();
      s.streams[0].onOpen();
      await settle();
      s.streams[0].onEffect('created');
      s.latest.mockResolvedValue(null);
      if (reason === 'background') {
        s.runtime.update({ foreground: false, connectivity: 'online' });
        s.runtime.update({ foreground: true, connectivity: 'online' });
      } else if (reason === 'offline') {
        s.runtime.update({ foreground: true, connectivity: 'offline' });
        s.runtime.update({ foreground: true, connectivity: 'online' });
      } else {
        s.streams[0].onFailure(reason);
        await settle();
        jest.advanceTimersByTime(timing.retry);
      }
      s.streams[1].onOpen();
      await settle();
      expect(s.confirmMissing).toHaveBeenCalledWith('Ga');
      expect(s.sync.getSnapshot().mode).toBe('live');
      expect(s.streams[1].stop).not.toHaveBeenCalled();
      for (let i = 0; i < 3; i++) {
        const confirmations = s.confirmMissing.mock.calls.length;
        jest.advanceTimersByTime(timing.health);
        await settle();
        expect(s.confirmMissing.mock.calls.length).toBeGreaterThan(confirmations);
        expect(s.sync.getSnapshot().mode).toBe('live');
        expect(s.streams[1].stop).not.toHaveBeenCalled();
      }
      const before = s.revision();
      s.streams[1].onEffect('new-payment');
      jest.advanceTimersByTime(timing.coalesce);
      expect(s.revision()).toBeGreaterThan(before);
      s.confirmMissing.mockResolvedValue(true);
      jest.advanceTimersByTime(timing.health);
      await settle();
      expect(s.sync.getSnapshot().mode).toBe('inactive');
      expect(s.streams[1].stop).toHaveBeenCalledTimes(1);
      const confirmations = s.confirmMissing.mock.calls.length;
      jest.advanceTimersByTime(timing.inactivePoll);
      await settle();
      expect(s.confirmMissing).toHaveBeenCalledTimes(confirmations);
      s.sync.close();
      expect(jest.getTimerCount()).toBe(0);
    },
  );

  it('does not transfer account existence evidence across selection changes, including A→B→A', async () => {
    const s = setup();
    s.sync.setAccount(account());
    await settle();
    s.streams[0].onOpen();
    await settle();
    s.streams[0].onEffect('created');
    s.latest.mockResolvedValue(null);
    s.sync.setAccount(account('b'));
    await settle();
    expect(s.sync.getSnapshot()).toEqual({ accountId: 'b', mode: 'inactive' });
    expect(s.confirmMissing).not.toHaveBeenCalled();
    s.sync.setAccount(account());
    await settle();
    expect(s.sync.getSnapshot()).toEqual({ accountId: 'a', mode: 'inactive' });
    expect(s.confirmMissing).not.toHaveBeenCalled();
    s.sync.close();
    expect(jest.getTimerCount()).toBe(0);
  });

  it('confirms a real account removal even when REST never catches up to its last effect', async () => {
    const s = setup();
    s.sync.setAccount(account());
    await settle();
    s.streams[0].onOpen();
    await settle();
    s.streams[0].onEffect('account-removed');
    s.latest.mockResolvedValue(null);
    s.confirmMissing.mockResolvedValue(true);
    jest.advanceTimersByTime(timing.health);
    await settle();
    expect(s.confirmMissing).toHaveBeenCalledWith('Ga');
    expect(s.sync.getSnapshot().mode).toBe('inactive');
    expect(s.streams[0].stop).toHaveBeenCalledTimes(1);
    s.sync.close();
  });

  it('ignores missing-account confirmation if another effect arrives while it is pending', async () => {
    const s = setup();
    s.sync.setAccount(account());
    await settle();
    s.streams[0].onOpen();
    await settle();
    s.streams[0].onEffect('created');
    const confirmation = deferred<boolean>();
    s.confirmMissing.mockReturnValueOnce(confirmation.promise);
    s.latest.mockResolvedValue(null);
    jest.advanceTimersByTime(timing.health);
    await settle();
    expect(s.confirmMissing).toHaveBeenCalledTimes(1);
    s.streams[0].onEffect('new-payment');
    confirmation.resolve(true);
    await settle();
    expect(s.sync.getSnapshot().mode).toBe('live');
    expect(s.streams[0].stop).not.toHaveBeenCalled();
    s.sync.close();
    expect(jest.getTimerCount()).toBe(0);
  });

  it('bounds missing-account confirmation without treating timeout as an inactive account', async () => {
    const s = setup();
    s.sync.setAccount(account());
    await settle();
    s.streams[0].onOpen();
    await settle();
    s.streams[0].onEffect('created');
    const confirmation = deferred<boolean>();
    s.confirmMissing.mockReturnValueOnce(confirmation.promise);
    s.latest.mockResolvedValue(null);
    jest.advanceTimersByTime(timing.health);
    await settle();
    jest.advanceTimersByTime(timing.probe);
    await settle();
    expect(s.sync.getSnapshot().mode).toBe('polling');
    confirmation.resolve(true);
    await settle();
    expect(s.sync.getSnapshot().mode).toBe('polling');
    s.sync.close();
    expect(jest.getTimerCount()).toBe(0);
  });

  it('invalidates once when a previously live account becomes missing, then remains silent', async () => {
    const s = setup();
    s.confirmMissing.mockResolvedValue(true);
    s.latest.mockResolvedValueOnce('initial').mockResolvedValueOnce('initial').mockResolvedValue(null);
    s.sync.setAccount(account());
    await settle();
    s.streams[0].onOpen();
    await settle();
    jest.advanceTimersByTime(timing.coalesce);
    const before = s.revision();
    jest.advanceTimersByTime(timing.health);
    await settle();
    jest.advanceTimersByTime(timing.coalesce);
    expect(s.sync.getSnapshot().mode).toBe('inactive');
    expect(s.revision()).toBe(before + 1);
    const checked = s.latest.mock.calls.length;
    jest.advanceTimersByTime(60000);
    await settle();
    jest.advanceTimersByTime(timing.coalesce);
    expect(s.latest).toHaveBeenCalledTimes(checked + 1);
    expect(s.revision()).toBe(before + 1);
    s.sync.close();
  });

  it('does not classify a funded account with an empty effects collection as inactive', async () => {
    const s = setup();
    s.sync.setAccount(account());
    await settle();
    s.streams[0].onOpen();
    await settle();
    expect(s.sync.getSnapshot().mode).toBe('live');
    jest.advanceTimersByTime(timing.poll);
    await settle();
    expect(s.sync.getSnapshot().mode).toBe('live');
    s.sync.close();
  });

  it('keeps inactive accounts polling until their first funding creates effects', async () => {
    const s = setup();
    s.sync.setAccount(account());
    await settle();
    s.streams[0].onFailure('failed');
    await settle();
    jest.advanceTimersByTime(timing.coalesce);
    const before = s.revision();
    s.latest.mockResolvedValue('created');
    jest.advanceTimersByTime(timing.poll);
    await settle();
    jest.advanceTimersByTime(timing.coalesce);
    expect(s.revision()).toBeGreaterThan(before);
    s.sync.close();
  });
  it('stops all work offline/background and starts a fresh scope on foreground or first definitive online', async () => {
    const s = setup();
    s.sync.setAccount(account());
    await settle();
    const old = s.streams[0];
    s.runtime.update({ foreground: false, connectivity: 'unknown' });
    expect(old.stop).toHaveBeenCalledTimes(1);
    const count = s.latest.mock.calls.length;
    jest.advanceTimersByTime(120000);
    await settle();
    expect(s.latest).toHaveBeenCalledTimes(count);
    old.onOpen();
    old.onEffect('stale');
    old.onFailure('failed');
    expect(s.sync.getSnapshot().mode).toBe('paused');
    s.runtime.update({ foreground: true, connectivity: 'offline' });
    expect(s.streams).toHaveLength(1);
    s.runtime.update({ foreground: true, connectivity: 'online' });
    expect(s.streams).toHaveLength(2);
    s.sync.close();
    expect(jest.getTimerCount()).toBe(0);
  });
  it('ignores old account probes, callbacks and retries after switching account, including A→B→A', async () => {
    const s = setup();
    const old = deferred<string>();
    s.latest.mockReturnValueOnce(old.promise);
    s.sync.setAccount(account());
    await settle();
    const stream = s.streams[0];
    stream.onFailure('failed');
    s.sync.setAccount(account('b'));
    s.sync.setAccount(account());
    await settle();
    stream.onOpen();
    stream.onEffect('stale');
    stream.onFailure('failed');
    old.resolve('old');
    await settle();
    expect(s.streams).toHaveLength(3);
    expect(stream.stop).toHaveBeenCalledTimes(1);
    expect(s.sync.getSnapshot()).toEqual({ accountId: 'a', mode: 'connecting' });
    s.sync.close();
    expect(jest.getTimerCount()).toBe(0);
  });
  it('ignores hidden/contract/other-network accounts, duplicate selection and repeated close', async () => {
    const s = setup();
    s.sync.setAccount({ ...account(), hidden: true });
    s.sync.setAccount({ ...account(), identityKind: 'contract' });
    s.sync.setAccount({ ...account(), networkId: 'other' });
    expect(s.streams).toHaveLength(0);
    s.sync.setAccount(account());
    s.sync.setAccount(account());
    expect(s.streams).toHaveLength(1);
    s.sync.close();
    s.sync.close();
    s.sync.setAccount(account('b'));
    s.runtime.update({ foreground: false, connectivity: 'offline' });
    await settle();
    expect(s.streams).toHaveLength(1);
    expect(jest.getTimerCount()).toBe(0);
  });
  it('cleans up an adapter that fails synchronously during setup and cannot restart after disposal', async () => {
    const runtime = createLedgerReadRuntime();
    const stop = jest.fn();
    const sync = createForegroundAccountSync({
      runtime,
      networkId: 'testnet',
      invalidation: createLedgerReadInvalidationStore(),
      onFailure: jest.fn(),
      isReading: () => false,
      confirmMissing: async () => false,
      effects: {
        latest: async () => undefined,
        open: input => {
          input.onFailure('failed');
          return stop;
        },
      },
    });
    sync.setAccount(account());
    await settle();
    expect(stop).toHaveBeenCalledTimes(1);
    sync.close();
    jest.advanceTimersByTime(120000);
    expect(stop).toHaveBeenCalledTimes(1);
    expect(jest.getTimerCount()).toBe(0);
  });
});
