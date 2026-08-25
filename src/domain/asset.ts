export type Asset =
  | { kind: 'native'; code: 'XLM' }
  | { kind: 'classic'; code: string; issuer: string }
  | { kind: 'contract'; contractId: string };

export type AssetBalance = {
  asset: Asset;
  amount: string;
};

export type Trustline = {
  accountId: string;
  asset: Extract<Asset, { kind: 'classic' }>;
  limit: string;
  balance: string;
};
