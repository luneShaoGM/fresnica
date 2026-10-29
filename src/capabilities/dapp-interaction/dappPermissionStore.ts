// Durable dApp account-read consent. A grant is never signing authorization.
// The network and stable account ID are part of the permission identity.
export type DappGrantScope = Readonly<{
  origin: string;
  accountId: string;
  networkId: string;
}>;

export type DappReadGrant = DappGrantScope & Readonly<{ createdAtUnixMs: number }>;

export type DappPermissionEvent =
  | Readonly<{ kind: 'revoked'; scope: DappGrantScope }>
  | Readonly<{ kind: 'closed' }>
  | Readonly<{ kind: 'granted'; scope: DappGrantScope }>;

export type DappPermissionStore = Readonly<{
  has: (scope: DappGrantScope) => boolean;
  grant: (scope: DappGrantScope) => void;
  revoke: (scope: DappGrantScope) => void;
  list: (networkId: string) => readonly DappReadGrant[];
  subscribe: (listener: (event: DappPermissionEvent) => void) => () => void;
  getRevision: () => number;
}>;
