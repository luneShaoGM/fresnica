import type { HistoryClaimPredicate } from '@capabilities/history/types';

type Translate = (key: string, params?: Readonly<Record<string, string | number>>) => string;
export function claimPredicateSummary(predicate: HistoryClaimPredicate, t: Translate): string {
  if ('unconditional' in predicate) return t('activity.predicate.unconditional');
  if ('and' in predicate || 'or' in predicate) {
    const pair = 'and' in predicate ? predicate.and : predicate.or;
    return t('and' in predicate ? 'activity.predicate.and' : 'activity.predicate.or', {
      first: claimPredicateSummary(pair[0], t),
      second: claimPredicateSummary(pair[1], t),
    });
  }
  if ('not' in predicate) return t('activity.predicate.not', { condition: claimPredicateSummary(predicate.not, t) });
  if ('rel_before' in predicate) return t('activity.predicate.relative', { time: predicate.rel_before });
  if ('abs_before' in predicate) return t('activity.predicate.absolute', { time: predicate.abs_before });
  return t('activity.predicate.epoch', { time: predicate.abs_before_epoch });
}
