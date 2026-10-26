import { NodeReadError } from '../../capabilities/network/NodeReadError';
import type { HistoryGatewayPort } from '../../capabilities/history/HistoryGateway';
import { horizonReadJson, object } from './horizonReadHttp';
import { mapBalance, mapHistoryOperationRecord } from './StellarSdkGateway';
import type { HorizonBalanceLike, HorizonOperationLike } from './types';

// Read-only transport. Never exposes authorization, signing, submission or resubmission.
export function createHorizonPublicReadGateway(http: typeof fetch = fetch) {
  const get = (endpoint: string, path: string, signal: AbortSignal) =>
    horizonReadJson(`${endpoint}${path}`, signal, http);
  const operation = (value: unknown) => mapHistoryOperationRecord(object(value) as HorizonOperationLike);
  return {
    async probe(endpoint: string, signal: AbortSignal) {
      const root = object(await get(endpoint, '/', signal));
      if (typeof root.network_passphrase !== 'string') throw new NodeReadError('protocol');
      return root.network_passphrase;
    },
    async loadAccountBalances(endpoint: string, address: string, signal: AbortSignal) {
      const value = await get(endpoint, `/accounts/${encodeURIComponent(address)}`, signal);
      if (value === undefined) return { status: 'inactive' as const, address };
      const account = object(value);
      if (
        account.account_id !== address ||
        !Array.isArray(account.balances) ||
        account.balances.length > 2000 ||
        !Number.isSafeInteger(account.last_modified_ledger) ||
        Number(account.last_modified_ledger) < 0
      )
        throw new NodeReadError('protocol');
      return {
        status: 'active' as const,
        address,
        balances: account.balances.map(balance => {
          const line = (() => {
            try {
              return mapBalance(object(balance) as HorizonBalanceLike);
            } catch {
              throw new NodeReadError('protocol');
            }
          })();
          if (
            !decimal(line.balance) ||
            (line.kind === 'credit' &&
              (!text(line.code, 12) ||
                !text(line.issuer, 256) ||
                (line.limit !== undefined && !decimal(line.limit)))) ||
            (line.kind === 'liquidity-pool-share' && !text(line.liquidityPoolId, 64))
          )
            throw new NodeReadError('protocol');
          return line;
        }),
        lastModifiedLedger: account.last_modified_ledger as number,
      };
    },
    async loadAccountOperations(
      endpoint: string,
      input: Parameters<HistoryGatewayPort['loadAccountOperations']>[0],
      signal: AbortSignal,
    ) {
      if (!Number.isInteger(input.limit) || input.limit < 1 || input.limit > 200) throw new NodeReadError('request');
      const query = `order=desc&limit=${input.limit}${input.cursor === undefined ? '' : `&cursor=${encodeURIComponent(input.cursor)}`}`;
      const value = await get(endpoint, `/accounts/${encodeURIComponent(input.address)}/operations?${query}`, signal);
      if (value === undefined) return { status: 'inactive' as const, address: input.address };
      const records = object(object(value)._embedded).records;
      if (!Array.isArray(records) || records.length > input.limit) throw new NodeReadError('protocol');
      const mapped = records.map(operation);
      const nextCursor = mapped.length === input.limit ? mapped[mapped.length - 1]?.pagingToken : undefined;
      return {
        status: 'active' as const,
        address: input.address,
        records: mapped,
        ...(nextCursor ? { nextCursor } : {}),
      };
    },
    async loadOperation(
      endpoint: string,
      input: Parameters<HistoryGatewayPort['loadOperation']>[0],
      signal: AbortSignal,
    ) {
      const id = input.operationId.trim();
      if (!id) throw new NodeReadError('request');
      const value = await get(endpoint, `/operations/${encodeURIComponent(id)}`, signal);
      return value === undefined
        ? { status: 'not-found' as const }
        : { status: 'found' as const, record: operation(value) };
    },
    async loadTransactionOutcome(endpoint: string, hash: string, signal: AbortSignal) {
      const value = await get(endpoint, `/transactions/${encodeURIComponent(hash)}`, signal);
      if (value === undefined) return { status: 'still-unknown' as const, transactionHash: hash };
      const transaction = object(value);
      if (
        transaction.hash !== hash ||
        typeof transaction.successful !== 'boolean' ||
        !Number.isSafeInteger(transaction.ledger) ||
        Number(transaction.ledger) < 0
      )
        throw new NodeReadError('protocol');
      return transaction.successful
        ? { status: 'confirmed' as const, transactionHash: hash, ledger: transaction.ledger as number }
        : { status: 'rejected' as const, transactionHash: hash };
    },
  };
}

function decimal(value: unknown): value is string {
  return typeof value === 'string' && value.length <= 64 && /^-?\d+(?:\.\d{1,7})?$/.test(value);
}
function text(value: unknown, max: number): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= max && value.trim() === value;
}
