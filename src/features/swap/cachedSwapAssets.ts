import type { AccountRecord } from '../../capabilities/account/types';
import type { BalanceCacheRepository, CachedSpendableAsset } from '../../capabilities/balance/BalanceCacheRepository';
import { readCachedBalanceSnapshot } from '../../capabilities/balance/BalanceCacheRepository';
import type { BalanceAsset } from '../../capabilities/balance/types';
import type { PathPaymentSourceAvailability } from '../../capabilities/path-payment/sourceAvailability';
import type { StellarPaymentAsset } from '../../capabilities/stellar/types';
import type { SwapAssetAvailabilitySnapshot } from './swapAssetAvailabilityCache';

export type CachedSwapAssets = SwapAssetAvailabilitySnapshot &
  Readonly<{
    authoritative: boolean;
  }>;

export function readCachedSwapAssets(
  cache: Pick<BalanceCacheRepository, 'getSnapshot'> | undefined,
  account: AccountRecord,
): CachedSwapAssets | undefined {
  if (!cache || account.identityKind !== 'classic') {
    return undefined;
  }
  try {
    const record = cache.getSnapshot({ networkId: account.networkId, accountAddress: account.address });
    if (!record || record.snapshot.address !== account.address) {
      return undefined;
    }
    if (record.spendableAssets && record.spendableAssets.length > 0 && record.baseFeeStroops !== undefined) {
      return Object.freeze({
        options: Object.freeze(record.spendableAssets.map(toAvailability)),
        baseFeeStroops: record.baseFeeStroops,
        authoritative: true,
      });
    }
    const snapshot = readCachedBalanceSnapshot(cache, {
      networkId: account.networkId,
      accountAddress: account.address,
    });
    if (!snapshot || snapshot.status !== 'active' || snapshot.balances.length === 0) {
      return undefined;
    }
    return Object.freeze({
      options: Object.freeze(
        snapshot.balances.map(line =>
          Object.freeze({
            asset: toPaymentAsset(line.asset),
            balance: line.balance,
            spendable: line.balance,
          }),
        ),
      ),
      baseFeeStroops: record.baseFeeStroops ?? 0,
      authoritative: false,
    });
  } catch {
    return undefined;
  }
}

export function spendableAssetsFromOptions(
  options: readonly PathPaymentSourceAvailability[],
): readonly CachedSpendableAsset[] {
  return options.map(option =>
    Object.freeze({
      asset:
        option.asset.kind === 'native'
          ? Object.freeze({ kind: 'native' as const, code: 'XLM' as const })
          : Object.freeze({ kind: 'credit' as const, code: option.asset.code, issuer: option.asset.issuer }),
      balance: option.balance,
      spendable: option.spendable,
    }),
  );
}

function toAvailability(asset: CachedSpendableAsset): PathPaymentSourceAvailability {
  return Object.freeze({
    asset: toPaymentAsset(asset.asset),
    balance: asset.balance,
    spendable: asset.spendable,
  });
}

function toPaymentAsset(asset: BalanceAsset): StellarPaymentAsset {
  return asset.kind === 'native'
    ? Object.freeze({ kind: 'native' })
    : Object.freeze({ kind: 'credit', code: asset.code, issuer: asset.issuer });
}
