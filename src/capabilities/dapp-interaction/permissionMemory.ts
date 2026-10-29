const grants = new Set<string>();

function grantKey(origin: string, accountId: string, networkId: string): string {
  return `${networkId}\n${accountId}\n${origin}`;
}

/** Process-local connect grant. Durable permission storage stays with the cache work. */
export function rememberDappReadGrant(origin: string, accountId: string, networkId: string): void {
  grants.add(grantKey(origin, accountId, networkId));
}

export function hasDappReadGrant(origin: string, accountId: string, networkId: string): boolean {
  return grants.has(grantKey(origin, accountId, networkId));
}

export function clearDappReadGrants(): void {
  grants.clear();
}
