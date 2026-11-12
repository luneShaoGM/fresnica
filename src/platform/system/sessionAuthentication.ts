import { NativeModules } from 'react-native';
import type { SessionAuthenticationPort } from '../../capabilities/ports/SessionAuthenticationPort';

type NativeSessionAuthentication = {
  canAuthenticate: () => Promise<boolean>;
  authenticate: (id: string, reason: string, cancelLabel: string) => Promise<boolean>;
  cancel: (id: string) => void;
};
let sequence = 0;
function nativeAuthentication(): NativeSessionAuthentication {
  const native = NativeModules.SessionAuthentication as NativeSessionAuthentication | undefined;
  if (!native?.canAuthenticate || !native.authenticate || !native.cancel) throw new Error('session-auth-unavailable');
  return native;
}
export function createSessionAuthentication(): SessionAuthenticationPort {
  let active: string | undefined;
  return {
    async canAuthenticate() {
      try {
        return (await nativeAuthentication().canAuthenticate()) === true;
      } catch {
        return false;
      }
    },
    async authenticate(reason, cancelLabel) {
      if (active) throw new Error('session-auth-busy');
      const id = `${Date.now()}-${++sequence}`;
      const native = nativeAuthentication();
      active = id;
      try {
        return (await native.authenticate(id, reason, cancelLabel)) === true;
      } finally {
        if (active === id) active = undefined;
      }
    },
    cancel() {
      const id = active;
      active = undefined;
      if (id) {
        try {
          nativeAuthentication().cancel(id);
        } catch {
          /* Session fencing still rejects late success. */
        }
      }
    },
  };
}
