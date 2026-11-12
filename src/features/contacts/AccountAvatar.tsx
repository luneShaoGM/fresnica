import React, { useContext, useEffect, useSyncExternalStore } from 'react';
import { accountAvatarAddress } from '@capabilities/contacts/AccountAvatars';
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
  useEffect(() => {
    if (!active || !key || !service || !snapshot.enabled || uri) return;
    const owner = new AbortController();
    service.load(key, owner.signal).catch(() => undefined);
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
