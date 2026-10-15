import {
  catalogCategories,
  filterCatalogEntries,
  type DappCatalogEntry,
} from '../catalog';
import { unconfiguredDappCatalog } from '../../../platform/dapps/unconfiguredDappCatalog';

const entries: readonly DappCatalogEntry[] = [
  { id: 'first', title: 'Alpha Wallet', description: 'Send and receive', category: 'Wallets', websiteUrl: 'https://a.example' },
  { id: 'second', title: 'Blue Explorer', description: 'Search the ledger', category: 'Tools', websiteUrl: 'https://b.example' },
  { id: 'third', title: 'Beta Wallet', description: 'Manage assets', category: 'Wallets', websiteUrl: 'https://c.example' },
];

describe('S14 read-only dApp catalog', () => {
  it('derives categories from received entries, rather than invented catalog categories', () => {
    expect(catalogCategories(entries)).toEqual(['Wallets', 'Tools']);
    expect(catalogCategories([])).toEqual([]);
  });

  it('filters exact categories and case-insensitive title, description or category matches', () => {
    expect(filterCatalogEntries(entries, 'Wallets', 'wallet').map(entry => entry.id)).toEqual(['first', 'third']);
    expect(filterCatalogEntries(entries, undefined, 'LEDGER').map(entry => entry.id)).toEqual(['second']);
    expect(filterCatalogEntries(entries, 'Tools', 'wallet')).toEqual([]);
  });

  it('preserves backend order, ignores whitespace-only search and does not alter original entries', () => {
    expect(filterCatalogEntries(entries, undefined, '  ').map(entry => entry.id)).toEqual(['first', 'second', 'third']);
    expect(entries.map(entry => entry.id)).toEqual(['first', 'second', 'third']);
  });

  it('has an honest unavailable result without generating fake entries', async () => {
    await expect(unconfiguredDappCatalog.load()).resolves.toEqual({ kind: 'unavailable' });
  });
});
