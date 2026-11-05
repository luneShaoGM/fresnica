import { effectsRecord, effectsSource } from '../../../capabilities/history/__tests__/claimableEffects.fixtures';
import { mapHistoryEntry } from '../../../capabilities/history/loadHistoryPage';
import { activityRowPresentation } from '../activityRowPresentation';
import { matchesActivitySearch } from '../activityList';
import { createLocalization } from '../../../locale/localization';
it.each(['claim_claimable_balance', 'clawback_claimable_balance'])(
  'shows verified %s quantity without converting burn into income',
  type => {
    const entry = mapHistoryEntry(effectsRecord(type), effectsSource);
    for (const locale of ['en', 'zh', 'zh-TW']) {
      const { t, formatNumber } = createLocalization(locale);
      const row = activityRowPresentation(entry, t, formatNumber);
      expect(row.subject.kind).toBe('asset');
      expect(row.money?.tone).toBe(type === 'claim_claimable_balance' ? 'positive' : 'neutral');
      expect(row.money?.amount.startsWith('+')).toBe(type === 'claim_claimable_balance');
      expect(matchesActivitySearch(entry, '922337203685.4775807', t, formatNumber)).toBe(true);
      if (type === 'clawback_claimable_balance')
        expect(matchesActivitySearch(entry, `USD:${effectsSource}`, t, formatNumber)).toBe(true);
    }
  },
);
