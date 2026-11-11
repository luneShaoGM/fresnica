import { leaseSessionServices } from './leaseSessionServices';
import React, { useEffect, useLayoutEffect, useMemo, useSyncExternalStore } from 'react';
import type { AppRuntimeState } from './runtimeState';
import { SessionUnlockScreen } from '../features/security/SessionUnlockScreen/SessionUnlockScreen';
import { SessionControlsContext } from '../features/security/sessionControls';
import { revealForegroundSurface } from '../platform/system/privacyShield';
import type { ApplicationSessionSnapshot } from './applicationSession';

const unguarded: ApplicationSessionSnapshot = { locked: false, foreground: true, revision: 0, canLock: false };
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
    const frame = requestAnimationFrame(() => {
      void revealForegroundSurface().catch(() => undefined);
    });
    return () => cancelAnimationFrame(frame);
  }, [snapshot, runtime.kind]);
  if (!snapshot.foreground) return null;
  if (session && snapshot.locked)
    return <SessionUnlockScreen key={snapshot.revision} unlock={session.unlock} cancel={session.cancelUnlock} />;
  return (
    <SessionControlsContext.Provider value={session ? { canLock: snapshot.canLock, lock: session.lock } : undefined}>
      <React.Fragment key={snapshot.revision}>
        {React.cloneElement(children, { runtime: leasedRuntime })}
      </React.Fragment>
    </SessionControlsContext.Provider>
  );
}
