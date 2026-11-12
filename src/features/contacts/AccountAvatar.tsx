import React, { useContext, useEffect, useRef, useSyncExternalStore } from 'react';
import { accountAvatarAddress, type AccountAvatarPort } from '@capabilities/contacts/AccountAvatars';
import { AccountAvatarImage } from '@ui/components/AccountAvatarImage';
import { AccountAvatarContext } from './accountAvatarContext';

const EMPTY = Object.freeze({ enabled: false, readable: false, revision: 0 });
const subscribeNothing = () => () => {};
const emptySnapshot = () => EMPTY;

export function AccountAvatar({
  address,
  active = true,
  size = 40,
}: Readonly<{ address: string; active?: boolean; size?: number }>) {
  const service = useContext(AccountAvatarContext);
  const snapshot = useSyncExternalStore(
    service?.subscribe ?? subscribeNothing,
    service?.getSnapshot ?? emptySnapshot,
    emptySnapshot,
  );
  const key = accountAvatarAddress(address);
  // Read the shared cache so another surface's rejection or a service change is immediate.
  const uri = active && snapshot.enabled && key ? service?.read(key) : undefined;
  const scope = useRef<Readonly<{ key: string; service: AccountAvatarPort; revision: number }> | undefined>(undefined);
  useEffect(() => {
    if (!active || !key || !service || !snapshot.enabled) {
      scope.current = undefined;
      return;
    }
    if (uri) {
      scope.current = { key, service, revision: snapshot.revision };
      return;
    }
    // Only an observed image can become an automatic expiry refresh.
    // Initial loads stay retryable when React replays mount effects.
    const onlyExpired =
      scope.current?.key === key &&
      scope.current?.service === service &&
      scope.current?.revision === snapshot.revision;
    const owner = new AbortController();
    service.load(key, owner.signal, { onlyExpired }).catch(() => undefined);
    return () => owner.abort();
  }, [active, key, service, snapshot.enabled, snapshot.revision, uri]);
  return (
    <AccountAvatarImage
      uri={uri}
      size={size}
      onError={() => {
        if (key && uri) service?.reject(key, uri);
      }}
    />
  );
}
