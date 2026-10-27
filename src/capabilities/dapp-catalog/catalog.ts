// Catalog listings are public, untrusted descriptions, not dApp origin attestations.
export type DappCatalogEntry = Readonly<{
  id: string;
  title: string;
  description: string;
  category: string;
  websiteUrl: string;
}>;

export type DappCatalogLoadResult =
  | Readonly<{ kind: 'unavailable' }>
  | Readonly<{ kind: 'ready'; entries: readonly DappCatalogEntry[]; stale?: boolean }>;

export type DappCatalogPort = Readonly<{
  load: () => Promise<DappCatalogLoadResult>;
}>;

export function catalogCategories(entries: readonly DappCatalogEntry[]): readonly string[] {
  return Array.from(new Set(entries.map(entry => entry.category).filter(Boolean)));
}

export function filterCatalogEntries(
  entries: readonly DappCatalogEntry[],
  category: string | undefined,
  searchText: string,
): readonly DappCatalogEntry[] {
  const query = searchText.trim().toLowerCase();
  return entries.filter(entry => {
    if (category !== undefined && entry.category !== category) return false;
    if (!query) return true;
    return [entry.title, entry.description, entry.category].some(value => value.toLowerCase().includes(query));
  });
}
