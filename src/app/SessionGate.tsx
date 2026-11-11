import { leaseSessionServices } from './leaseSessionServices';
import React, { useEffect, useLayoutEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import type { AppRuntimeState } from './runtimeState';
import { SessionUnlockScreen } from '../features/security/SessionUnlockScreen/SessionUnlockScreen';
import { SessionControlsContext } from '../features/security/sessionControls';
import { readNativePrivacyState, revealForegroundSurface } from '../platform/system/privacyShield';
import type { ApplicationSessionSnapshot } from './applicationSession';

const unguarded: ApplicationSessionSnapshot = {
  locked: false,
  foreground: true,
  revision: 0,
  backgroundRevision: 0,
  canLock: false,
};
const subscribeNothing = () => () => {};
const readUnguarded = () => unguarded;
export function SessionGate({
  runtime,
  refresh,
  children,
}: Readonly<{
  runtime: AppRuntimeState;
  refresh: () => void;
  children: React.ReactElement<{ runtime: AppRuntimeState }>;
}>) {
  const acknowledged = useRef({ native: 0, js: 0 });
  const session = runtime.kind === 'ready' ? runtime.services.applicationSession : undefined;
  const snapshot = useSyncExternalStore(session?.subscribe ?? subscribeNothing, session?.getSnapshot ?? readUnguarded);
  const leasedRuntime = useMemo(
    () =>
      runtime.kind === 'ready' && session
        ? { ...runtime, services: leaseSessionServices(runtime.services, snapshot.revision) }
        : runtime,
    [runtime, session, snapshot.revision],
  );
  useEffect(() => {
    session?.refreshInventory();
  }, [session, runtime]);
  useEffect(() => {
    if (session && snapshot.foreground) refresh();
  }, [session, snapshot.foreground, refresh]);
  useLayoutEffect(() => {
    if (!snapshot.foreground) return;
    let live = true;
    const frame = requestAnimationFrame(() => {
      readNativePrivacyState()
        .then(native => {
          if (!live || !native || (session && session.getSnapshot() !== snapshot)) return;
          const missed =
            native.backgroundCount - acknowledged.current.native >
            snapshot.backgroundRevision - acknowledged.current.js;
          acknowledged.current = { native: native.backgroundCount, js: snapshot.backgroundRevision };
          if (session && missed) {
            session.retireMissedBackground();
            return;
          }
          return revealForegroundSurface(native.generation);
        })
        .catch(() => undefined);
    });
    return () => {
      live = false;
      cancelAnimationFrame(frame);
    };
  }, [snapshot, runtime.kind, session]);
  if (!snapshot.foreground) return null;
  if (session && snapshot.locked)
    return (
      <SessionUnlockScreen
        key={snapshot.revision}
        unlock={session.unlock}
        cancel={session.cancelUnlock}
        canUseBiometrics={session.canUseBiometrics}
        unlockWithBiometrics={session.unlockWithBiometrics}
      />
    );
  return (
    <SessionControlsContext.Provider value={session ? { canLock: snapshot.canLock, lock: session.lock } : undefined}>
      <React.Fragment key={snapshot.revision}>
        {React.cloneElement(children, { runtime: leasedRuntime })}
      </React.Fragment>
    </SessionControlsContext.Provider>
  );
}
