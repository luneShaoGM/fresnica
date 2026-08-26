export type StellarThresholdLevel = 'low' | 'medium' | 'high';

export type StellarAccountAuthorization = {
  address: string;
  thresholds: {
    low: number;
    medium: number;
    high: number;
  };
  signers: Array<{
    publicKey: string;
    weight: number;
  }>;
};
