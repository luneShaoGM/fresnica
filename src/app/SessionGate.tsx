import React, { useEffect, useLayoutEffect, useSyncExternalStore } from 'react';
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
}: React.PropsWithChildren<Readonly<{ runtime: AppRuntimeState; refresh: () => void }>>) {
  const session = runtime.kind === 'ready' ? runtime.services.applicationSession : undefined;
  const snapshot = useSyncExternalStore(session?.subscribe ?? subscribeNothing, session?.getSnapshot ?? readUnguarded);
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
      <React.Fragment key={snapshot.revision}>{children}</React.Fragment>
    </SessionControlsContext.Provider>
  );
}
