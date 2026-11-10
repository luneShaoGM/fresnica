import { CURATED_ASSET_SOURCES, type AssetCatalogPort } from '@capabilities/trustline/curatedAssetCatalog';
import type { AccountRecord } from '@capabilities/account/types';
import type { Contact } from '@capabilities/contacts/contacts';
import { resolveLocalIdentityDisplay } from '@capabilities/contacts/resolveLocalIdentity';
import type { ActivityIdentityNames } from '@features/activity/activityRowPresentation';

export function activityIdentityNames(
  accounts: readonly AccountRecord[],
  contacts: readonly Contact[],
  networkId: string,
  catalog?: AssetCatalogPort,
): ActivityIdentityNames {
  const candidates = new Set<string>([
    ...accounts.map(account => account.address),
    ...contacts.filter(contact => contact.memo === undefined).map(contact => contact.address),
  ]);
  const names = new Map<string, string>();
  for (const address of candidates) {
    const resolved = resolveLocalIdentityDisplay({ address, contacts, accounts, networkId });
    if (resolved.source !== 'address') names.set(address, resolved.name);
  }
  return Object.assign(names, {
    contractName: (identity: string) => {
      if (networkId !== 'stellar-mainnet' || !/^C[A-Z2-7]{55}$/.test(identity)) return undefined;
      const labels = new Set<string>();
      for (const source of CURATED_ASSET_SOURCES) {
        try {
          const cached = catalog?.readCachedSource?.(networkId, source.id);
          cached?.contractNames?.filter(item => item.contractId === identity).forEach(item => labels.add(item.name));
          const assets = cached?.assets ?? [];
          assets
            .filter(asset => asset.contractId === identity)
            .forEach(asset => labels.add(asset.name?.trim() || asset.code));
        } catch {
          /* A display label never blocks history. */
        }
      }
      return labels.size === 1 ? [...labels][0] : undefined;
    },
    resolve: (address: string, memo?: import('@capabilities/stellar/types').StellarPaymentMemo) => {
      const resolved = resolveLocalIdentityDisplay({ address, memo, contacts, accounts, networkId });
      return resolved.source === 'address' ? undefined : resolved.name;
    },
  });
}
