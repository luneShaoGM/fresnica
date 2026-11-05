import type { HistoryOperationEffects, HistoryEffectRecord } from '../../capabilities/history/HistoryGateway';
import { NodeReadError } from '../../capabilities/network/NodeReadError';
import { object } from './horizonReadHttp';

export async function readHistoryOperationEffects(
  operationId: string,
  read: (cursor?: string) => Promise<readonly unknown[]>,
): Promise<HistoryOperationEffects> {
  const records: HistoryEffectRecord[] = [];
  let cursor: string | undefined;
  for (let page = 0; page < 2; page += 1) {
    const batch = await read(cursor);
    if (!Array.isArray(batch) || batch.length > 200) throw new NodeReadError('protocol');
    for (const candidate of batch) {
      const raw = object(candidate);
      const link = object(object(raw._links).operation).href;
      if (
        typeof link !== 'string' ||
        new URL(link).pathname !== `/operations/${operationId}` ||
        typeof raw.type !== 'string' ||
        typeof raw.account !== 'string'
      )
        throw new NodeReadError('protocol');
      const asset =
        raw.type === 'claimable_balance_claimed'
          ? raw.asset === 'native'
            ? { kind: 'native' as const }
            : typeof raw.asset === 'string' && raw.asset.split(':').length === 2
              ? { kind: 'credit' as const, code: raw.asset.split(':')[0], issuer: raw.asset.split(':')[1] }
              : { kind: 'unsupported' as const }
          : raw.type === 'account_credited'
            ? raw.asset_type === 'native'
              ? { kind: 'native' as const }
              : typeof raw.asset_type === 'string' && ['credit_alphanum4', 'credit_alphanum12'].includes(raw.asset_type)
                ? {
                    kind: 'credit' as const,
                    code: typeof raw.asset_code === 'string' ? raw.asset_code : undefined,
                    issuer: typeof raw.asset_issuer === 'string' ? raw.asset_issuer : undefined,
                  }
                : { kind: 'unsupported' as const }
            : undefined;
      records.push({
        type: raw.type,
        account: raw.account,
        ...(raw.balance_id === undefined ? {} : { balanceId: raw.balance_id }),
        ...(raw.amount === undefined ? {} : { amount: raw.amount }),
        ...(asset ? { asset } : {}),
      });
    }
    if (batch.length < 200) return { operationId, complete: true, records };
    const last = object(batch[batch.length - 1]).paging_token;
    if (typeof last !== 'string' || !last || last.length > 256 || last === cursor) throw new NodeReadError('protocol');
    cursor = last;
  }
  return { operationId, complete: false, records: [] };
}
