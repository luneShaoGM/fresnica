import { CONTRACT_HOST_FUNCTIONS } from '../../../capabilities/history/contractHistory';
import {
  contractRecord,
  source,
  recipient,
  foreign,
  contractId,
  transfer,
} from '../../../capabilities/history/__tests__/contractHistory.fixtures';
import { mapHistoryEntry } from '../../../capabilities/history/loadHistoryPage';
import { activityRowPresentation } from '../activityRowPresentation';
import { matchesActivityFilter, matchesActivitySearch } from '../activityList';
import { createLocalization } from '../../../locale/localization';
const { t, formatNumber } = createLocalization('en');
it('previews only first two relevant quantities, counts all relevant and does not net', () => {
  const entry = mapHistoryEntry(
    contractRecord({
      assetBalanceChanges: [
        { ...transfer, from: foreign },
        transfer,
        { ...transfer, to: source, amount: '0' },
        { ...transfer, amount: '17014118346046923173168730371588.4105727' },
      ],
    }),
    source,
  );
  const row = activityRowPresentation(entry, t, formatNumber, new Map([[contractId, 'Wrong contract alias']]));
  expect(row.subject).toEqual({ kind: 'contract', identity: contractId });
  expect(row.title).not.toContain('Wrong');
  expect(row.operation).toContain('3 balance events');
  expect(row.reserveMoney).toHaveLength(2);
  expect(row.reserveMoney?.map(m => m.tone)).toEqual(['negative', 'neutral']);
  expect(matchesActivityFilter(entry, 'other')).toBe(true);
  expect(matchesActivityFilter(entry, 'payments')).toBe(false);
  for (const query of [contractId, 'transfer', recipient, '17014118346046923173168730371588.4105727'])
    expect(matchesActivitySearch(entry, query, t, formatNumber)).toBe(true);
});
it('does not resolve routed recipient base names or manufacture monetary columns', () => {
  const entry = mapHistoryEntry(
    contractRecord({ assetBalanceChanges: [{ ...transfer, destinationMuxedId: '42' }] }),
    recipient,
  );
  expect(matchesActivitySearch(entry, 'Wrong alias', t, formatNumber, new Map([[recipient, 'Wrong alias']]))).toBe(
    false,
  );
  expect(matchesActivitySearch(entry, '42', t, formatNumber)).toBe(true);
  expect(activityRowPresentation(mapHistoryEntry(contractRecord(), source), t, formatNumber).reserveMoney).toEqual([]);
});
it('keeps native and issued XLM asset identities distinct in preview/search', () => {
  const entry = mapHistoryEntry(
    contractRecord({
      assetBalanceChanges: [transfer, { ...transfer, asset: { kind: 'credit', code: 'XLM', issuer: foreign } }],
    }),
    source,
  );
  expect(activityRowPresentation(entry, t, formatNumber).reserveMoney?.map(m => m.asset.kind)).toEqual([
    'native',
    'credit',
  ]);
  expect(matchesActivitySearch(entry, `XLM:${foreign}`, t, formatNumber)).toBe(true);
});

it.each(['create', 'create-v2'] as const)('shows %s deployer without claiming a created address', host => {
  const names = new Map([[source, 'Actual deployer']]);
  const entry = mapHistoryEntry(
    contractRecord({
      hostFunction: CONTRACT_HOST_FUNCTIONS[host],
      assetBalanceChanges: host === 'create-v2' ? [transfer] : undefined,
    }),
    source,
  );
  const row = activityRowPresentation(entry, t, formatNumber, names);
  expect(row.subject).toEqual({ kind: 'contract', identity: source });
  expect(row.title).toBe('Actual deployer');
  expect(matchesActivitySearch(entry, 'Actual deployer', t, formatNumber, names)).toBe(true);
  expect(row.reserveMoney).toHaveLength(host === 'create-v2' ? 1 : 0);
  expect(entry).not.toHaveProperty('contractId');
});

it.each(['create', 'create-v2'] as const)('searches canonical origin asset identity for %s in every locale', host => {
  const entry = mapHistoryEntry(
    contractRecord({
      hostFunction: CONTRACT_HOST_FUNCTIONS[host],
      creationOrigin: 'asset',
      creationAsset: { kind: 'credit', code: 'USD', issuer: foreign },
    }),
    source,
  );
  for (const locale of ['en', 'zh', 'zh-TW']) {
    const localization = createLocalization(locale);
    expect(matchesActivitySearch(entry, `USD:${foreign}`, localization.t, localization.formatNumber)).toBe(true);
  }
});
