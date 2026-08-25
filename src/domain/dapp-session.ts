export type DAppPermission = {
  accountId: string;
  canReadAddress: boolean;
  canRequestSignatures: boolean;
};

export type DAppSession = {
  id: string;
  origin: string;
  name?: string;
  trusted: boolean;
  permission: DAppPermission;
  connectedAt: number;
  lastUsedAt: number;
};

export type SigningRequest = {
  id: string;
  sessionId: string;
  kind: 'transaction' | 'message';
  payload: string;
};
