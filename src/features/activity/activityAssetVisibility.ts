import type { HistoryAsset, HistoryEntry } from '@capabilities/history/types';
import { activityAssetIdentity } from './activityRowPresentation';

// Local, reversible presentation preference. Never classify a ledger asset as spam.
export function entryAssetIdentities(entry: HistoryEntry): readonly string[] {
  if (entry.kind === 'failed' || entry.kind === 'unsupported') return [];
  const assets: HistoryAsset[] = [];
  switch (entry.kind) {
    case 'payment':
    case 'change-trust':
    case 'trust-authorization':
    case 'trust-flags':
    case 'claimable-create':
    case 'clawback':
      assets.push(entry.asset);
      break;
    case 'create-account':
      assets.push({ kind: 'native', code: 'XLM' });
      break;
    case 'path-payment':
      assets.push(entry.sourceAsset, entry.destinationAsset);
      break;
    case 'offer':
      assets.push(entry.sellingAsset, entry.buyingAsset);
      break;
    case 'liquidity-pool':
      assets.push(...entry.reserves.map(reserve => reserve.asset));
      break;
    case 'contract':
      if (entry.creationAsset) assets.push(entry.creationAsset);
      for (const event of entry.events ?? []) assets.push(event.asset);
      break;
    case 'claimable-reference':
      return [];
    default:
      return [];
  }
  return [...new Set(assets.map(activityAssetIdentity))];
}

export function visibleByAssetPreference(
  entry: HistoryEntry,
  hiddenAssets: ReadonlySet<string>,
  showHidden: boolean,
): boolean {
  return showHidden || !entryAssetIdentities(entry).some(identity => hiddenAssets.has(identity));
}
