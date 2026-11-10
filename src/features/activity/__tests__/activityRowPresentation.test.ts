import type { HistoryChangeTrustEntry, HistoryPaymentEntry, HistoryEntry } from '@capabilities/history/types';
import { createLocalization } from '../../../locale/localization';
import { activityAssetIdentity, activityRowPresentation } from '../activityRowPresentation';
import { activityEntryPresentation, matchesActivitySearch } from '../activityList';

const { t, formatNumber } = createLocalization('en');
const payment: HistoryPaymentEntry = {
  id: 'one',
  pagingToken: 'one',
  operationType: 'payment',
  occurredAt: '2026-11-02T12:34:56Z',
  transactionHash: 'tx-one',
  sourceAccount: 'GSOURCE',
  kind: 'payment',
  direction: 'incoming',
  amount: '9999999999999999.123456789',
  asset: { kind: 'native', code: 'XLM' },
  counterparty: 'GCOUNTERPARTY',
  participants: [
    { role: 'sender', identity: 'GCOUNTERPARTY' },
    { role: 'recipient', identity: 'GSOURCE' },
  ],
};
const trustline: HistoryChangeTrustEntry = {
  ...payment,
  kind: 'change-trust',
  operationType: 'change_trust',
  asset: { kind: 'credit', code: 'MiXeD', issuer: 'GISSUER' },
  limit: '100.0000000',
  participants: [
    { role: 'trustor', identity: 'GSOURCE' },
    { role: 'issuer', identity: 'GISSUER' },
  ],
};
it.each([
  ['incoming', '+9,999,999,999,999,999.1234567', 'positive', 'Received'],
  ['outgoing', '−9,999,999,999,999,999.1234567', 'negative', 'Sent'],
  ['self', '9,999,999,999,999,999.1234567', 'neutral', 'Self payment'],
  ['neutral', '9,999,999,999,999,999.1234567', 'neutral', 'Payment'],
] as const)(
  'keeps exact string precision and %s payment direction in the separate numeric column',
  (direction, amount, tone, operation) => {
    const row = activityRowPresentation({ ...payment, direction }, t, formatNumber);
    expect(row).toMatchObject({
      title: 'GCOU...ARTY',
      operation,
      subject: { kind: 'account', address: payment.counterparty },
      money: { amount, tone, asset: payment.asset },
    });
    expect(matchesActivitySearch(payment, payment.amount, t, formatNumber)).toBe(true);
    expect(matchesActivitySearch(payment, '9,999,999,999,999,999.1234567', t, formatNumber)).toBe(true);
    expect(activityEntryPresentation(payment, t, formatNumber).primary).toBe('9,999,999,999,999,999.12345678 XLM');
  },
);
it('uses current transient names for title and loaded-set search, with masked fallback', () => {
  const names = new Map([[payment.counterparty, 'Alice']]);
  expect(activityRowPresentation(payment, t, formatNumber, names).title).toBe('Alice');
  expect(matchesActivitySearch(payment, 'alice', t, formatNumber, names)).toBe(true);
  names.delete(payment.counterparty);
  expect(activityRowPresentation(payment, t, formatNumber, names).title).toBe('GCOU...ARTY');
  expect(matchesActivitySearch(payment, 'alice', t, formatNumber, names)).toBe(false);
});
it('uses account identity and signed starting balance for funding', () => {
  const entry: HistoryEntry = {
    ...payment,
    kind: 'create-account',
    direction: 'outgoing',
    startingBalance: '12.123456789',
  };
  expect(activityRowPresentation(entry, t, formatNumber)).toMatchObject({
    title: 'GCOU...ARTY',
    operation: 'Create account',
    subject: { kind: 'account' },
    money: { amount: '−12.1234567', asset: { kind: 'native', code: 'XLM' } },
  });
  expect(matchesActivitySearch(entry, entry.startingBalance, t, formatNumber)).toBe(true);
  expect(matchesActivitySearch(entry, 'create account', t, formatNumber)).toBe(true);
  expect(activityEntryPresentation(entry, t, formatNumber).title).toBe('Funded account');
});
it.each(['0', '0.0000000', '000.00'])(
  'shows zero limit %s as removal with no money, preserving detail and search',
  limit => {
    const entry = { ...trustline, limit };
    const row = activityRowPresentation(entry, t, formatNumber);
    expect(row).toEqual({
      title: 'MiXeD',
      operation: 'Trustline removed',
      subject: { kind: 'asset', asset: trustline.asset },
    });
    expect(matchesActivitySearch(entry, 'trustline removed', t, formatNumber)).toBe(true);
    expect(matchesActivitySearch(entry, limit, t, formatNumber)).toBe(true);
    expect(activityEntryPresentation(entry, t, formatNumber).primary).toContain('MiXeD');
  },
);
it('does not infer adding from a positive limit and never shows the limit as money', () => {
  expect(activityRowPresentation(trustline, t, formatNumber)).toEqual({
    title: 'MiXeD',
    operation: 'Trustline changed',
    subject: { kind: 'asset', asset: trustline.asset },
  });
  expect(matchesActivitySearch(trustline, trustline.limit, t, formatNumber)).toBe(true);
});
it('keeps unsupported operation text and type visible/searchable without money', () => {
  const entry: HistoryEntry = {
    ...payment,
    kind: 'unsupported',
    operationType: 'path_payment_strict_send',
    reason: 'operation-type',
  };
  expect(activityRowPresentation(entry, t, formatNumber)).toEqual({
    title: 'Operation: path_payment_strict_send',
    operation: t('activity.entry.unsupported'),
    subject: { kind: 'unsupported' },
  });
  expect(matchesActivitySearch(entry, entry.operationType, t, formatNumber)).toBe(true);
});
it('keys asset avatars by case-sensitive code and exact issuer, including issued XLM', () => {
  const identity = activityAssetIdentity(trustline.asset);
  expect(identity).not.toBe(activityAssetIdentity({ ...trustline.asset, code: 'mixed' }));
  expect(identity).not.toBe(activityAssetIdentity({ ...trustline.asset, issuer: 'GOTHER' }));
  expect(activityAssetIdentity({ kind: 'native', code: 'XLM' })).not.toBe(
    activityAssetIdentity({ kind: 'credit', code: 'XLM', issuer: 'GISSUER' }),
  );
});
