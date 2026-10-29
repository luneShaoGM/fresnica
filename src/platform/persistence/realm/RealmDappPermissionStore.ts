import type Realm from 'realm';

import {
  type DappGrantScope,
  type DappPermissionEvent,
  type DappPermissionStore,
  type DappReadGrant,
} from '../../../capabilities/dapp-interaction/dappPermissionStore';
import { readPublicDappNavigation } from '../../../capabilities/dapp-interaction/externalDappUrl';
import { DAPP_PERMISSION_GRANT_ENTITY } from './schemas';

type StoredGrant = Readonly<{
  id: string;
  origin: string;
  accountId: string;
  networkId: string;
  createdAt: Date;
}>;

function validScope(scope: DappGrantScope): boolean {
  const parsed = readPublicDappNavigation(scope.origin);
  return (
    parsed?.origin === scope.origin &&
    /^[a-zA-Z0-9._:-]{1,128}$/.test(scope.accountId) &&
    /^[a-zA-Z0-9._:-]{1,128}$/.test(scope.networkId)
  );
}

function grantId(scope: DappGrantScope): string {
  return JSON.stringify([scope.networkId, scope.accountId, scope.origin]);
}

// Wallet-owned Realm storage, never JS State or the replaceable public catalog.
// All mutations are atomic and permission notifications happen only on success.
export class RealmDappPermissionStore implements DappPermissionStore {
  private listeners = new Set<(event: DappPermissionEvent) => void>();
  private revision = 0;
  private closed = false;

  constructor(private readonly realm: Realm) {}

  getRevision = () => this.revision;

  subscribe = (listener: (event: DappPermissionEvent) => void): (() => void) => {
    if (this.closed) {
      listener({ kind: 'closed' });
      return () => {};
    }
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  private emit(event: DappPermissionEvent): void {
    this.revision += 1;
    for (const listener of [...this.listeners]) {
      try {
        listener(event);
      } catch {
        // An observer failure cannot turn a successful Realm write into a
        // reported failure while its grant/revoke already took effect.
      }
    }
  }

  has = (scope: DappGrantScope): boolean => {
    if (this.closed || !validScope(scope)) return false;
    try {
      const record = this.realm.objectForPrimaryKey(DAPP_PERMISSION_GRANT_ENTITY, grantId(scope));
      return (
        record !== null &&
        record !== undefined &&
        (record as unknown as StoredGrant).origin === scope.origin &&
        (record as unknown as StoredGrant).networkId === scope.networkId &&
        (record as unknown as StoredGrant).accountId === scope.accountId &&
        (record as unknown as StoredGrant).createdAt instanceof Date &&
        !Number.isNaN((record as unknown as StoredGrant).createdAt.getTime())
      );
    } catch {
      return false;
    }
  };

  grant = (scope: DappGrantScope): void => {
    if (this.closed || !validScope(scope)) throw new Error('dapp-permission-unavailable');
    if (this.has(scope)) return;
    this.realm.write(() => {
      this.realm.create(DAPP_PERMISSION_GRANT_ENTITY, {
        id: grantId(scope),
        networkId: scope.networkId,
        accountId: scope.accountId,
        origin: scope.origin,
        createdAt: new Date(),
      });
    });
    this.emit({ kind: 'granted', scope });
  };

  revoke = (scope: DappGrantScope): void => {
    if (this.closed || !validScope(scope)) throw new Error('dapp-permission-unavailable');
    this.realm.write(() => {
      const record = this.realm.objectForPrimaryKey(DAPP_PERMISSION_GRANT_ENTITY, grantId(scope));
      if (record) this.realm.delete(record);
    });
    // Revoke active allow-once sessions as well, even if no durable row exists.
    this.emit({ kind: 'revoked', scope });
  };

  list = (networkId: string): readonly DappReadGrant[] => {
    if (this.closed) throw new Error('dapp-permission-unavailable');
    if (!/^[a-zA-Z0-9._:-]{1,128}$/.test(networkId)) return [];
    try {
      const rows = Array.from(this.realm.objects(DAPP_PERMISSION_GRANT_ENTITY)) as unknown as StoredGrant[];
      return Object.freeze(
        rows
          .filter(
            row =>
              row.networkId === networkId &&
              validScope(row) &&
              row.id === grantId(row) &&
              row.createdAt instanceof Date &&
              !Number.isNaN(row.createdAt.getTime()),
          )
          .map(row =>
            Object.freeze({
              networkId: row.networkId,
              accountId: row.accountId,
              origin: row.origin,
              createdAtUnixMs: row.createdAt.getTime(),
            }),
          )
          .sort((a, b) => a.origin.localeCompare(b.origin) || a.accountId.localeCompare(b.accountId)),
      );
    } catch {
      throw new Error('dapp-permission-unavailable');
    }
  };

  close(): void {
    if (this.closed) return;
    this.closed = true;
    this.emit({ kind: 'closed' });
    this.listeners.clear();
  }
}
