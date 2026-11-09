import { NodeReadError } from '../../capabilities/network/NodeReadError';
import type { ClaimableRecord } from '../../capabilities/claimable/records';
import { mapClaimableRecord, validClaimableId } from '../../capabilities/claimable/records';
import { horizonReadJson, object } from './horizonReadHttp';

// Public-only Horizon reads. The matching claimant is mandatory and parsing
// errors invalidate the entire page instead of silently dropping ledger rows.
export function createHorizonClaimableGateway(http: typeof fetch = fetch) {
  return {
    async page(
      endpoint: string,
      address: string,
      cursor: string | undefined,
      signal: AbortSignal,
    ): Promise<Readonly<{ records: readonly ClaimableRecord[]; nextCursor?: string }>> {
      if (!/^G[A-Z2-7]{55}$/.test(address) || (cursor && !/^\d{1,40}$/.test(cursor)))
        throw new NodeReadError('request');
      const path =
        '/claimable_balances?claimant=' +
        encodeURIComponent(address) +
        '&order=asc&limit=50' +
        (cursor ? '&cursor=' + encodeURIComponent(cursor) : '');
      const raw = object(await horizonReadJson(endpoint + path, signal, http));
      const embedded = object(raw._embedded);
      if (!Array.isArray(embedded.records) || embedded.records.length > 50) throw new NodeReadError('protocol');
      let records: ClaimableRecord[];
      try {
        records = embedded.records.map(row => mapClaimableRecord(row, address));
        if (new Set(records.map(row => row.id)).size !== records.length) throw new Error('duplicate');
      } catch {
        throw new NodeReadError('protocol');
      }
      const tail = embedded.records[embedded.records.length - 1] as Record<string, unknown> | undefined;
      const nextCursor = tail?.paging_token;
      if (
        records.length === 50 &&
        (typeof nextCursor !== 'string' || !/^\d{1,40}$/.test(nextCursor) || nextCursor === cursor)
      )
        throw new NodeReadError('protocol');
      return { records, ...(records.length === 50 ? { nextCursor: nextCursor as string } : {}) };
    },
    async byId(
      endpoint: string,
      id: string,
      address: string,
      signal: AbortSignal,
    ): Promise<ClaimableRecord | undefined> {
      if (!validClaimableId(id) || !/^G[A-Z2-7]{55}$/.test(address)) throw new NodeReadError('request');
      const raw = await horizonReadJson(endpoint + '/claimable_balances/' + encodeURIComponent(id), signal, http);
      if (!raw) return undefined;
      try {
        const row = mapClaimableRecord(object(raw), address);
        if (row.id !== id) throw new Error('wrong-id');
        return row;
      } catch {
        throw new NodeReadError('protocol');
      }
    },
  };
}
