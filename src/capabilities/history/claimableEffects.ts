import type { HistoryGatewayPort, HistoryOperationRecord } from './HistoryGateway';
import { isPathAmount, pathAsset } from './pathPaymentHistory';
import type { HistoryAsset, HistoryEffectEvidence } from './types';

export function claimableEffectQuantity(
  record: HistoryOperationRecord,
): Readonly<{ asset: HistoryAsset; amount: string; evidence: HistoryEffectEvidence }> | undefined {
  if (record.successful !== true) return undefined;
  const proof = record.claimableEffects;
  if (
    !proof ||
    proof.complete !== true ||
    proof.operationId !== record.id ||
    !Array.isArray(proof.records) ||
    proof.records.length > 400
  )
    return undefined;
  const type =
    record.type === 'claim_claimable_balance'
      ? 'claimable_balance_claimed'
      : record.type === 'clawback_claimable_balance'
        ? 'claimable_balance_clawed_back'
        : undefined;
  if (
    !type ||
    !Array.from(proof.records).every(effect => effect && typeof effect === 'object' && !Array.isArray(effect))
  )
    return undefined;
  const relevant = proof.records.filter(
    effect =>
      effect &&
      typeof effect.type === 'string' &&
      [type, 'account_credited', 'claimable_balance_claimed', 'claimable_balance_clawed_back'].includes(effect.type),
  );
  if (relevant.length !== 2 || relevant.some(effect => effect.account !== record.sourceAccount)) return undefined;
  const markers = relevant.filter(effect => effect.type === type);
  const credits = relevant.filter(effect => effect.type === 'account_credited');
  if (markers.length !== 1 || credits.length !== 1 || markers[0].balanceId !== record.balanceId) return undefined;
  const asset = pathAsset(credits[0].asset);
  const amount = credits[0].amount;
  if (
    !asset ||
    !isPathAmount(amount) ||
    (type === 'claimable_balance_clawed_back' && (asset.kind !== 'credit' || asset.issuer !== record.sourceAccount))
  )
    return undefined;
  if (
    type === 'claimable_balance_claimed' &&
    (markers[0].amount !== amount || JSON.stringify(pathAsset(markers[0].asset)) !== JSON.stringify(asset))
  )
    return undefined;
  const records = Object.freeze([
    Object.freeze({
      type,
      account: record.sourceAccount,
      balanceId: record.balanceId!,
      ...(type === 'claimable_balance_claimed' ? { asset, amount } : {}),
    }),
    Object.freeze({ type: 'account_credited', account: record.sourceAccount, asset, amount }),
  ]);
  return Object.freeze({ asset, amount, evidence: Object.freeze({ operationId: record.id, complete: true, records }) });
}

// Optional evidence failures retain ID-only data; lifecycle invalidation still aborts the read.
export async function enrichClaimableRecords(
  gateway: HistoryGatewayPort,
  records: readonly HistoryOperationRecord[],
  accountAddress: string,
): Promise<readonly HistoryOperationRecord[]> {
  if (!gateway.loadOperationEffects) return records;
  const result = records.slice();
  const controller = new AbortController();
  let next = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<void>(resolve => {
    timer = setTimeout(() => {
      controller.abort();
      resolve();
    }, 6000);
  });
  async function worker() {
    while (!controller.signal.aborted && next < records.length) {
      const index = next++;
      const record = records[index];
      if (claimableEffectQuantity(record)) continue;
      if (
        record.successful !== true ||
        record.sourceAccount !== accountAddress ||
        !['claim_claimable_balance', 'clawback_claimable_balance'].includes(record.type) ||
        !/^00000000[0-9a-fA-F]{64}$/.test(record.balanceId ?? '') ||
        (record.type === 'claim_claimable_balance' && record.claimant !== accountAddress)
      )
        continue;
      try {
        const proof = await gateway.loadOperationEffects!({
          operationId: record.id,
          accountAddress,
          signal: controller.signal,
        });
        const candidate = { ...record, claimableEffects: proof };
        if (!controller.signal.aborted && claimableEffectQuantity(candidate)) result[index] = candidate;
      } catch (error) {
        if (error instanceof Error && /^(ledger-read-(offline|paused|superseded)|node-read-(paused|superseded))$/.test(error.message)) {
          throw error;
        }
        /* ID-only evidence remains available. */
      }
    }
  }
  try {
    await Promise.race([Promise.all(Array.from({ length: Math.min(4, records.length) }, worker)), deadline]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
    controller.abort();
  }
  return result;
}

export function sameReferenceIdentity(
  left: import('./types').HistoryEntry,
  right: import('./types').HistoryEntry,
): boolean {
  return (
    left.kind === 'claimable-reference' &&
    right.kind === 'claimable-reference' &&
    [
      'id',
      'pagingToken',
      'operationType',
      'occurredAt',
      'transactionHash',
      'sourceAccount',
      'successful',
      'balanceId',
    ].every(key => left[key as keyof typeof left] === right[key as keyof typeof right])
  );
}
export function retainReferenceEvidence(
  fresh: import('./types').HistoryEntry,
  cached: import('./types').HistoryEntry | undefined,
): import('./types').HistoryEntry {
  return cached?.kind === 'claimable-reference' &&
    cached.evidence &&
    fresh.kind === 'claimable-reference' &&
    !fresh.evidence &&
    sameReferenceIdentity(fresh, cached)
    ? cached
    : fresh;
}
export function seedCachedClaimableProof(
  dependencies: import('./loadHistoryPage').HistoryDependencies,
  records: readonly HistoryOperationRecord[],
  accountAddress: string,
): readonly HistoryOperationRecord[] {
  try {
    const cached = dependencies.cache?.getSnapshot({ networkId: dependencies.networkId, accountAddress });
    if (!cached) return records;
    return records.map(record => {
      const entry = cached.entries.find(candidate => candidate.id === record.id);
      if (
        entry?.kind !== 'claimable-reference' ||
        !entry.evidence ||
        !['id', 'pagingToken', 'occurredAt', 'transactionHash', 'sourceAccount', 'successful', 'balanceId'].every(
          key => record[key as keyof HistoryOperationRecord] === entry[key as keyof typeof entry],
        ) ||
        record.type !== entry.operationType
      )
        return record;
      const candidate = { ...record, claimableEffects: entry.evidence };
      const quantity = claimableEffectQuantity(candidate);
      return quantity &&
        quantity.amount === entry.amount &&
        JSON.stringify(quantity.asset) === JSON.stringify(entry.asset)
        ? candidate
        : record;
    });
  } catch {
    return records;
  }
}
