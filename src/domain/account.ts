export type AccountId = string;

export type Account = {
  id: AccountId;
  publicKey: string;
  network: 'mainnet' | 'testnet' | 'futurenet' | 'custom';
  hasSigner: boolean;
};

export type SignerKind = 'local' | 'hardware' | 'watch-only' | 'external';

export type Signer = {
  id: string;
  accountId: AccountId;
  kind: SignerKind;
};
