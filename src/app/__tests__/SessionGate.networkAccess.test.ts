import React from 'react';
import { View } from 'react-native';
import type { AppRuntimeState } from '../runtimeState';
import { readNativePrivacyState, revealForegroundSurface } from '../../platform/system/privacyShield';

jest.mock('../leaseSessionServices', () => ({ leaseSessionServices: (services: unknown) => services }));
jest.mock('../../features/security/SessionUnlockScreen/SessionUnlockScreen', () => ({
  SessionUnlockScreen: () => null,
}));
jest.mock('../../platform/system/privacyShield', () => ({
  readNativePrivacyState: jest.fn(),
  revealForegroundSurface: jest.fn(),
}));

test('loading cannot acknowledge a missed native background before the replacement session can lock', async () => {
  let layout!: () => void | (() => void);
  const spies = [
    jest.spyOn(React, 'useRef').mockImplementation(initial => ({ current: initial })),
    jest.spyOn(React, 'useMemo').mockImplementation(factory => factory()),
    jest.spyOn(React, 'useSyncExternalStore').mockImplementation((_subscribe, read) => read()),
    jest.spyOn(React, 'useEffect').mockImplementation(() => {}),
    jest.spyOn(React, 'useLayoutEffect').mockImplementation(effect => {
      layout = effect;
    }),
    jest.spyOn(global, 'requestAnimationFrame').mockImplementation(callback => {
      callback(0);
      return 1;
    }),
  ];
  const { SessionGate } = require('../SessionGate') as typeof import('../SessionGate');
  try {
    jest.mocked(readNativePrivacyState).mockResolvedValue({ generation: 1, backgroundCount: 1 });
    const refresh = jest.fn();
    SessionGate({ runtime: { kind: 'loading' }, refresh, children: React.createElement(View) });
    layout();
    expect(readNativePrivacyState).not.toHaveBeenCalled();
    const snapshot = { locked: false, foreground: true, revision: 0, backgroundRevision: 0, canLock: true };
    const session = {
      getSnapshot: () => snapshot,
      subscribe: jest.fn(),
      retireMissedBackground: jest.fn(),
      lock: jest.fn(),
    };
    const runtime = { kind: 'ready', services: { applicationSession: session } } as unknown as AppRuntimeState;
    SessionGate({ runtime, refresh, children: React.createElement(View) });
    layout();
    await Promise.resolve();
    await Promise.resolve();
    expect(session.retireMissedBackground).toHaveBeenCalledTimes(1);
    expect(revealForegroundSurface).not.toHaveBeenCalled();
  } finally {
    spies.forEach(spy => spy.mockRestore());
  }
});
