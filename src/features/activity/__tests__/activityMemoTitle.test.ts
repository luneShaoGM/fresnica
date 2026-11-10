import { mapHistoryEntry } from '../../../capabilities/history/loadHistoryPage';
import { activityIdentityNames } from '../../../app/navigation/activityIdentityNames';
import { activityRowPresentation } from '../activityRowPresentation';
import { createLocalization } from '../../../locale/localization';
const source = 'G' + 'A'.repeat(55);
const recipient = 'G' + 'B'.repeat(55);
const { t, formatNumber } = createLocalization('en');
const record = {
  id: '1',
  pagingToken: '1',
  type: 'payment',
  occurredAt: '2026-11-10T00:00:00Z',
  transactionHash: 'tx',
  sourceAccount: source,
  successful: true,
  from: source,
  to: recipient,
  amount: '1',
  asset: { kind: 'native' as const },
  recipientMemo: { recipient, memo: { type: 'id' as const, value: '7' } },
};
const plain = { id: 'plain', address: recipient, name: 'General', networkId: 'test' };
const exact = { ...plain, id: 'exact', name: 'Subaccount', memo: { type: 'id' as const, value: '7' } };
it('uses exact typed Memo only for the recipient, and falls back to an address-only contact', () => {
  const names = activityIdentityNames(
    [],
    [plain, exact, { ...exact, id: 'fakeSender', address: source, name: 'Wrong sender' }],
    'test',
  );
  expect(activityRowPresentation(mapHistoryEntry(record, source), t, formatNumber, names).title).toBe('Subaccount');
  expect(activityRowPresentation(mapHistoryEntry(record, recipient), t, formatNumber, names).title).not.toBe(
    'Wrong sender',
  );
  expect(
    activityRowPresentation(mapHistoryEntry({ ...record, recipientMemo: undefined }, source), t, formatNumber, names)
      .title,
  ).toBe('General');
  expect(
    activityRowPresentation(
      mapHistoryEntry({ ...record, recipientMemo: { recipient, memo: { type: 'text', value: '7' } } }, source),
      t,
      formatNumber,
      names,
    ).title,
  ).toBe('General');
});
it('does not choose an ambiguous exact Memo contact by insertion order', () => {
  const names = activityIdentityNames([], [plain, exact, { ...exact, id: 'conflict', name: 'Different' }], 'test');
  expect(activityRowPresentation(mapHistoryEntry(record, source), t, formatNumber, names).title).not.toBe('Subaccount');
});
