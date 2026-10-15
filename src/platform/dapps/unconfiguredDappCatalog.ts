import type { DappCatalogPort } from '../../capabilities/dapp-catalog/catalog';

// S14's remote catalog source is not contracted/configured yet; never invent listings.
export const unconfiguredDappCatalog: DappCatalogPort = Object.freeze({
  async load() {
    return { kind: 'unavailable' } as const;
  },
});
