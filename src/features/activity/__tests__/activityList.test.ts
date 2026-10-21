import type { HistoryEntry } from '@capabilities/history/types';
import { createLocalization } from '../../../locale/localization';

import {
  activityEntryPresentation,
  matchesActivityFilter,
  matchesActivitySearch,
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

function trustlineEntry(): HistoryEntry {
  return {
    id: 'trustline',
    pagingToken: 'trustline',
    operationType: 'change_trust',
    occurredAt: '2026-08-31T00:00:00Z',
    transactionHash: 'tx-trustline',
    sourceAccount: 'GSOURCE',
    kind: 'change-trust',
    asset: { kind: 'credit', code: 'MiXeD', issuer: 'GISSUER' },
    limit: '100.0000000',
    participants: [
      { role: 'trustor', identity: 'GSOURCE' },
      { role: 'issuer', identity: 'GISSUER' },
    ],
  };
}

const t = (key: string, params?: Readonly<Record<string, string | number>>) =>
  params?.operationType ? `${key}:${params.operationType}` : key;
const formatNumber = (value: string | number) => `formatted:${value}`;

describe('activityList', () => {
  it('appends later pages without duplicating operation ids', () => {
    expect(
      mergeActivityEntries([unsupported('3'), unsupported('2')], [unsupported('2'), unsupported('1')]).map(
        entry => entry.id,
      ),
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
      asset: { kind: 'native', code: 'XLM' },
      counterparty: 'GCOUNTERPARTY',
      participants: [
        { role: 'sender', identity: 'GSOURCE' },
        { role: 'recipient', identity: 'GCOUNTERPARTY' },
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

  it('presents Activity ledger amounts when Hermes does not provide formatToParts', () => {
    const prototype = Intl.NumberFormat.prototype;
    const original = Object.getOwnPropertyDescriptor(prototype, 'formatToParts');
    Object.defineProperty(prototype, 'formatToParts', {configurable: true, value: undefined});

    try {
      const localization = createLocalization('en');
      const trustline = trustlineEntry();
      expect(activityEntryPresentation(trustline, localization.t, localization.formatNumber).primary).toBe(
        '100 MiXeD',
      );

      const payment: HistoryEntry = {
        id: 'hermes-payment',
        pagingToken: 'hermes-payment',
        operationType: 'payment',
        occurredAt: '2026-08-31T00:00:00Z',
        transactionHash: 'tx-hermes-payment',
        sourceAccount: 'GSOURCE',
        kind: 'payment',
        direction: 'incoming',
        amount: '9999999999999999.12345678',
        asset: {kind: 'native', code: 'XLM'},
        counterparty: 'GCOUNTERPARTY',
        participants: [
          {role: 'sender', identity: 'GSOURCE'},
          {role: 'recipient', identity: 'GCOUNTERPARTY'},
        ],
      };
      const presentation = activityEntryPresentation(payment, localization.t, localization.formatNumber);
      expect(presentation.primary).toBe('9,999,999,999,999,999.12345678 XLM');
      expect(matchesActivitySearch(payment, '999,999,999', localization.t, localization.formatNumber)).toBe(true);
    } finally {
      if (original) {
        Object.defineProperty(prototype, 'formatToParts', original);
      } else {
        Reflect.deleteProperty(prototype, 'formatToParts');
      }
    }
  });

  it('classifies change-trust under the dedicated trustline filter', () => {
    const changeTrust = trustlineEntry();

    expect(matchesActivityFilter(changeTrust, 'trustlines')).toBe(true);
    expect(matchesActivityFilter(changeTrust, 'other')).toBe(false);
    expect(matchesActivityFilter(changeTrust, 'payments')).toBe(false);
    expect(activityEntryPresentation(changeTrust, t, formatNumber)).toEqual({
      title: 'activity.entry.trustlineChanged',
      primary: 'formatted:100.0000000 MiXeD',
      secondary: 'GISSUER',
      tone: 'neutral',
      filter: 'trustlines',
    });
  });

  it('searches the current entry by display copy and stable history fields', () => {
    const changeTrust = trustlineEntry();

    for (const query of [
      'trustlinechanged',
      'formatted:100.0000000 mixed',
      'tx-trustline',
      'trustline',
      'gsource',
      'gissuer',
      'mixed',
    ]) {
      expect(matchesActivitySearch(changeTrust, query, t, formatNumber)).toBe(true);
    }
    expect(matchesActivitySearch(changeTrust, 'not-present', t, formatNumber)).toBe(false);
  });
});
