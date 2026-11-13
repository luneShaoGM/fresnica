import React from 'react';
import { createThemeImageSelection } from '@capabilities/preferences/createThemeImageSelection';
import { createApplicationSession } from '../applicationSession';
import { createGeneralPreferences, type ImagePalette } from '@capabilities/preferences/generalPreferences';
import { InMemoryAccountSignerRepository } from '@platform/persistence/memory/InMemoryAccountSignerRepository';
import type { FresnicaSdkPort } from '@capabilities/ports/FresnicaSdkPort';
import type { AppRuntimeState } from '../runtimeState';
jest.mock('../leaseSessionServices', () => ({ leaseSessionServices: (services: unknown) => services }));
jest.mock('../../features/security/SessionUnlockScreen/SessionUnlockScreen', () => ({
  SessionUnlockScreen: () => null,
}));
jest.mock('../../platform/system/privacyShield', () => ({
  readNativePrivacyState: jest.fn(),
  revealForegroundSurface: jest.fn(),
}));
const palette = { primary: '#113355', secondary: '#224466' };
function deferred() {
  let resolve!: (value: ImagePalette | undefined) => void;
  const promise = new Promise<ImagePalette | undefined>(r => {
    resolve = r;
  });
  return { promise, resolve };
}
async function fixture() {
  const repository = new InMemoryAccountSignerRepository();
  repository.createSigner({
    id: 's',
    kind: 'protected-software',
    publicKey: 'GDUMMY',
    envelopeJson: 'dummy-envelope',
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  let time = 0;
  const session = createApplicationSession(
    { repository, sdk: { verifyProtectedSignerPassphrase: async () => true } as unknown as FresnicaSdkPort },
    () => time,
  );
  session.setForeground(true);
  await session.unlock('fixture-phrase');
  const save = jest.fn(),
    cancelPalette = jest.fn();
  const preferences = createGeneralPreferences({ load: () => undefined, save });
  const picked = deferred();
  const pickPalette = jest.fn(() => picked.promise);
  const selection = createThemeImageSelection({
    preferences,
    pickPalette,
    cancelPalette,
    getAccess: session.getSnapshot,
    subscribeAccess: session.subscribe,
    assertOpen: () => {},
  });
  return {
    session,
    selection,
    preferences,
    picked,
    pickPalette,
    save,
    cancelPalette,
    setTime: (value: number) => {
      time = value;
    },
  };
}
const spies = [
  jest.spyOn(React, 'useRef').mockImplementation(initial => ({ current: initial })),
  jest.spyOn(React, 'useMemo').mockImplementation(factory => factory()),
  jest.spyOn(React, 'useSyncExternalStore').mockImplementation((_subscribe, read) => read()),
  jest.spyOn(React, 'useEffect').mockImplementation(() => {}),
  jest.spyOn(React, 'useLayoutEffect').mockImplementation(() => {}),
];
const { SessionGate } = require('../SessionGate') as typeof import('../SessionGate');
const { SessionUnlockScreen } = require('../../features/security/SessionUnlockScreen/SessionUnlockScreen');
afterAll(() => spies.forEach(spy => spy.mockRestore()));
it.each([1000, 31000])(
  'survives background gate unmount and saves only after foreground access (%sms)',
  async elapsed => {
    const f = await fixture();
    const runtime = { kind: 'ready', services: { applicationSession: f.session } } as unknown as AppRuntimeState;
    const gate = () =>
      SessionGate({ runtime, refresh: () => {}, children: React.createElement(() => null, { runtime }) });
    try {
      expect(gate()).not.toBeNull();
      const pending = f.selection.start();
      f.session.setForeground(false);
      expect(gate()).toBeNull();
      f.picked.resolve(palette);
      await pending;
      expect(f.save).not.toHaveBeenCalled();
      expect(f.cancelPalette).not.toHaveBeenCalled();
      f.setTime(elapsed);
      f.session.setForeground(true);
      if (elapsed >= 30000) {
        expect(gate()?.type).toBe(SessionUnlockScreen);
        expect(f.save).not.toHaveBeenCalled();
        await f.session.unlock('fixture-phrase');
      }
      expect(f.save).toHaveBeenCalledTimes(1);
      expect(f.preferences.getSnapshot()).toMatchObject({ theme: 'image', imagePalette: palette });
      expect(f.selection.getSnapshot()).toEqual({ busy: false, error: false });
    } finally {
      f.selection.close();
    }
  },
);
it.each(['cancel', 'close', 'preference-change', 'picker-cancel'] as const)(
  'discards stale output after %s',
  async action => {
    const f = await fixture();
    const pending = f.selection.start();
    if (action === 'cancel') f.selection.cancel();
    if (action === 'close') f.selection.close();
    if (action === 'preference-change') f.preferences.update({ theme: 'dark' });
    f.save.mockClear();
    f.picked.resolve(action === 'picker-cancel' ? undefined : palette);
    await pending;
    expect(f.save).not.toHaveBeenCalled();
    expect(f.preferences.getSnapshot().theme).toBe(action === 'preference-change' ? 'dark' : 'system');
    f.selection.close();
  },
);
it('rejects an old request without changing a newer picker busy state', async () => {
  const f = await fixture();
  const old = f.selection.start();
  f.selection.cancel();
  const newer = deferred();
  f.pickPalette.mockReturnValueOnce(newer.promise);
  const next = f.selection.start();
  f.picked.resolve(palette);
  await old;
  expect(f.selection.getSnapshot().busy).toBe(true);
  expect(f.save).not.toHaveBeenCalled();
  newer.resolve(palette);
  await next;
  expect(f.save).toHaveBeenCalledTimes(1);
  f.selection.close();
});
it('reports native and persistence failures and allows a fresh retry', async () => {
  const f = await fixture();
  f.pickPalette.mockRejectedValueOnce(new Error('picker-failed'));
  await f.selection.start();
  expect(f.selection.getSnapshot()).toEqual({ busy: false, error: true });
  f.save.mockImplementationOnce(() => {
    throw new Error('save-failed');
  });
  f.picked.resolve(palette);
  await f.selection.start();
  expect(f.selection.getSnapshot()).toEqual({ busy: false, error: true });
  expect(f.preferences.getSnapshot().theme).toBe('system');
  await f.selection.start();
  expect(f.selection.getSnapshot()).toEqual({ busy: false, error: false });
  expect(f.preferences.getSnapshot().theme).toBe('image');
  f.selection.close();
});
