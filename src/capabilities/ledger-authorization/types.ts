export type StellarThresholdLevel = 'low' | 'medium' | 'high';

export type LedgerSignerCondition =
  | { kind: 'ed25519'; publicKey: string; weight: number }
  | { kind: 'preauth-tx'; key: string; weight: number }
  | { kind: 'hash-x'; key: string; weight: number }
  | { kind: 'signed-payload'; key: string; weight: number };

export type ClassicLedgerAuthorization = {
  address: string;
  thresholds: {
    low: number;
    medium: number;
    high: number;
  };
  signers: LedgerSignerCondition[];
};
