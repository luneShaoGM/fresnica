import type {HistoryEntry} from '@capabilities/history/types';

import {
  activityEntryPresentation,
  matchesActivityFilter,
  mergeActivityEntries,
} from '../activityList';

function unsupported(id: string): HistoryEntry {
  return {
    id,
    pagingToken: id,
    operationType: 'future_operation',
    occurredAt: '2026-08-31T00:00:00Z',
    transactionHash: `tx-${id}`,
    sourceAccount: 'GSOURCE',
    kind: 'unsupported',
    reason: 'operation-type',
  };
}

const t = (key: string, params?: Readonly<Record<string, string | number>>) =>
  params?.operationType ? `${key}:${params.operationType}` : key;
const formatNumber = (value: string | number) => `formatted:${value}`;

describe('activityList', () => {
  it('appends later pages without duplicating operation ids', () => {
    expect(
      mergeActivityEntries(
        [unsupported('3'), unsupported('2')],
        [unsupported('2'), unsupported('1')],
      ).map(entry => entry.id),
    ).toEqual(['3', '2', '1']);
  });

  it('presents unsupported operations explicitly through localized copy', () => {
    expect(activityEntryPresentation(unsupported('9'), t, formatNumber)).toEqual({
      title: 'activity.entry.operation:future_operation',
      primary: 'activity.entry.unsupported',
      secondary: 'tx-9',
      tone: 'neutral',
      filter: 'other',
    });
  });

  it('classifies history entries for real Activity filters', () => {
    const payment: HistoryEntry = {
      id: 'payment',
      pagingToken: 'payment',
      operationType: 'payment',
      occurredAt: '2026-08-31T00:00:00Z',
      transactionHash: 'tx-payment',
      sourceAccount: 'GSOURCE',
      kind: 'payment',
      direction: 'incoming',
      amount: '12.5',
      asset: {kind: 'native', code: 'XLM'},
      counterparty: 'GCOUNTERPARTY',
      participants: [
        {role: 'sender', identity: 'GSOURCE'},
        {role: 'recipient', identity: 'GCOUNTERPARTY'},
      ],
    };

    expect(matchesActivityFilter(payment, 'all')).toBe(true);
    expect(matchesActivityFilter(payment, 'payments')).toBe(true);
    expect(matchesActivityFilter(payment, 'accounts')).toBe(false);
    expect(activityEntryPresentation(payment, t, formatNumber)).toMatchObject({
      title: 'activity.entry.received',
      primary: 'formatted:12.5 XLM',
      tone: 'positive',
      filter: 'payments',
    });
  });

  it('keeps change-trust in other until the dedicated filter slice', () => {
    const changeTrust: HistoryEntry = {
      id: 'trustline',
      pagingToken: 'trustline',
      operationType: 'change_trust',
      occurredAt: '2026-08-31T00:00:00Z',
      transactionHash: 'tx-trustline',
      sourceAccount: 'GSOURCE',
      kind: 'change-trust',
      asset: {kind: 'credit', code: 'MiXeD', issuer: 'GISSUER'},
      limit: '100.0000000',
      participants: [
        {role: 'trustor', identity: 'GSOURCE'},
        {role: 'issuer', identity: 'GISSUER'},
      ],
    };

    expect(matchesActivityFilter(changeTrust, 'other')).toBe(true);
    expect(matchesActivityFilter(changeTrust, 'payments')).toBe(false);
    expect(activityEntryPresentation(changeTrust, t, formatNumber)).toEqual({
      title: 'activity.entry.trustlineChanged',
      primary: 'formatted:100.0000000 MiXeD',
      secondary: 'GISSUER',
      tone: 'neutral',
      filter: 'other',
    });
  });
});
