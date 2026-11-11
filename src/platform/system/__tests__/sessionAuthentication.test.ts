import { NativeModules } from 'react-native';
import { createSessionAuthentication } from '../sessionAuthentication';
const modules = NativeModules as Record<string, unknown>;
const original = modules.SessionAuthentication;
afterEach(() => {
  if (original === undefined) delete modules.SessionAuthentication;
  else modules.SessionAuthentication = original;
});
test('missing bridge fails closed and only strict native true is accepted', async () => {
  delete modules.SessionAuthentication;
  const port = createSessionAuthentication();
  await expect(port.canAuthenticate()).resolves.toBe(false);
  await expect(port.authenticate('Unlock', 'Passphrase')).rejects.toThrow('session-auth-unavailable');
  modules.SessionAuthentication = {
    canAuthenticate: async () => true,
    authenticate: async () => 'true',
    cancel: jest.fn(),
  };
  await expect(port.authenticate('Unlock', 'Passphrase')).resolves.toBe(false);
});
test('cancellation targets the exact native request and cannot cancel another port instance', async () => {
  const authenticate = jest.fn((_id: string, _reason: string, _cancelLabel: string) => new Promise<boolean>(() => {}));
  const cancel = jest.fn();
  modules.SessionAuthentication = { canAuthenticate: async () => true, authenticate, cancel };
  const first = createSessionAuthentication(),
    second = createSessionAuthentication();
  void first.authenticate('Unlock', 'Passphrase');
  void second.authenticate('Unlock', 'Passphrase');
  const id1 = authenticate.mock.calls[0][0],
    id2 = authenticate.mock.calls[1][0];
  expect(id1).not.toBe(id2);
  first.cancel();
  expect(cancel).toHaveBeenCalledWith(id1);
  expect(cancel).not.toHaveBeenCalledWith(id2);
  second.cancel();
});
