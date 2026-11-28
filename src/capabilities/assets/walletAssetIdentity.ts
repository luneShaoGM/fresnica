import type { BalanceAsset } from '../balance/types';

export type ContractAsset = Readonly<{ kind: 'contract'; contractId: string }>;
// The Classic BalanceAsset remains the deliberately narrower input to
// payments, paths and trustline writes. A contract ID is never a credit issuer.
export type WalletAssetIdentity = BalanceAsset | ContractAsset;

export function walletAssetKey(networkId: string, asset: WalletAssetIdentity): string {
  switch (asset.kind) {
    case 'native':
      return JSON.stringify([networkId, 'native']);
    case 'credit':
      return JSON.stringify([networkId, 'credit', asset.code, asset.issuer]);
    case 'contract':
      return JSON.stringify([networkId, 'contract', asset.contractId]);
  }
}
