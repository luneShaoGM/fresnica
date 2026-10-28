// A generation lease prevents old async work from authorizing or dispatching after a network change.
export function createServiceSession() {
  let closed = false;
  let sensitive = 0;
  const assertOpen = () => {
    if (closed) throw new Error('network-session-retired');
  };
  return {
    assertOpen,
    assertIdle() {
      assertOpen();
      if (sensitive > 0) throw new Error('network-session-busy');
    },
    close() {
      closed = true;
    },
    bind<T extends object>(target: T, protect: boolean | ReadonlySet<string> = false): T {
      return new Proxy(target, {
        get(object, key) {
          const value: unknown = Reflect.get(object, key);
          if (typeof value !== 'function') return value;
          return (...args: unknown[]) => {
            assertOpen();
            const tracked = protect === true || (typeof protect !== 'boolean' && protect.has(String(key)));
            if (tracked) sensitive += 1;
            const release = () => {
              if (tracked) sensitive -= 1;
            };
            try {
              const result: unknown = Reflect.apply(value, object, args);
              if (result instanceof Promise)
                return result
                  .then(output => {
                    assertOpen();
                    return output;
                  })
                  .finally(release);
              release();
              return result;
            } catch (error) {
              release();
              throw error;
            }
          };
        },
      });
    },
  };
}
