import { createServiceSession } from '../createServiceSession';
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(yes => {
    resolve = yes;
  });
  return { promise, resolve };
}
describe('immutable service generation lease', () => {
  it('rejects old calls and late read results while the new generation remains usable', async () => {
    const lease = createServiceSession();
    const old = deferred<string>();
    const transport = { read: jest.fn(() => old.promise) };
    const gateway = lease.bind(transport);
    const result = gateway.read();
    lease.close();
    old.resolve('obsolete');
    await expect(result).rejects.toThrow('network-session-retired');
    expect(() => gateway.read()).toThrow('network-session-retired');
    expect(transport.read).toHaveBeenCalledTimes(1);
    await expect(
      createServiceSession()
        .bind({ read: async () => 'new' })
        .read(),
    ).resolves.toBe('new');
  });
  it('blocks a transition during native authorization or broadcast, but not an ordinary read', async () => {
    const lease = createServiceSession();
    const signing = deferred<string>();
    const sdk = lease.bind({ sign: () => signing.promise }, true);
    const work = sdk.sign();
    expect(() => lease.assertIdle()).toThrow('network-session-busy');
    signing.resolve('signature');
    await work;
    expect(() => lease.assertIdle()).not.toThrow();
    const broadcast = deferred<string>();
    const read = deferred<string>();
    const gateway = lease.bind(
      { submitTransaction: () => broadcast.promise, read: () => read.promise },
      new Set(['submitTransaction']),
    );
    const loaded = gateway.read();
    expect(() => lease.assertIdle()).not.toThrow();
    const submitted = gateway.submitTransaction();
    expect(() => lease.assertIdle()).toThrow('network-session-busy');
    broadcast.resolve('accepted');
    read.resolve('balances');
    await Promise.all([loaded, submitted]);
    expect(() => lease.assertIdle()).not.toThrow();
  });
  it('releases the sensitive guard on thrown and rejected operations and preserves method receivers', async () => {
    const lease = createServiceSession();
    class Native {
      value = 'ok';
      sync() {
        return this.value;
      }
      fail() {
        throw new Error('native-error');
      }
      async reject() {
        throw new Error('native-error');
      }
    }
    const bound = lease.bind(new Native(), true);
    expect(bound.sync()).toBe('ok');
    expect(() => bound.fail()).toThrow('native-error');
    await expect(bound.reject()).rejects.toThrow('native-error');
    expect(() => lease.assertIdle()).not.toThrow();
  });
});
