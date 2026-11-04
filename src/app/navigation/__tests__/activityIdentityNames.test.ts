import type { AccountRecord } from '@capabilities/account/types';
import type { Contact } from '@capabilities/contacts/contacts';
import { activityIdentityNames } from '../activityIdentityNames';
const now = new Date();
const account: AccountRecord = {
  id: 'one',
  address: 'GADDRESS',
  networkId: 'test',
  identityKind: 'classic',
  label: 'Wallet',
  sortOrder: 0,
  hidden: false,
  createdAt: now,
  updatedAt: now,
};
const contact: Contact = { id: 'contact', address: account.address, networkId: 'test', name: 'Alice' };
it('prioritizes global address-only contacts over visible local Classic account labels', () => {
  expect(activityIdentityNames([account], [contact], 'test').get(account.address)).toBe('Alice');
  expect(activityIdentityNames([account], [], 'test').get(account.address)).toBe('Wallet');
});
it('shares contacts globally, keeps exact case, and never borrows memo-specific names', () => {
  const names = activityIdentityNames(
    [account],
    [
      { ...contact, networkId: 'other' },
      { ...contact, memo: { type: 'id', value: '7' } },
    ],
    'test',
  );
  expect(names.get(account.address)).toBe('Alice');
  expect(names.get('gaddress')).toBeUndefined();
  expect(names.get('MADDRESS')).toBeUndefined();
  expect(activityIdentityNames([account], [contact], 'other').get(account.address)).toBe('Alice');
  expect(
    activityIdentityNames([account], [{ ...contact, memo: { type: 'id', value: '7' } }], 'test').get(account.address),
  ).toBe('Wallet');
});
it('keeps wallet label instead of guessing among conflicting legacy contact identities', () => {
  const names = activityIdentityNames(
    [account],
    [contact, { ...contact, id: 'other', name: 'Bob', networkId: 'main' }],
    'test',
  );
  expect(names.get(account.address)).toBe('Wallet');
});
it('keeps Activity names address-only even when a typed memo contact has the same account address', () => {
  const withMemo = { ...contact, id: 'memo', name: 'Exchange subaccount', memo: { type: 'id' as const, value: '7' } };
  const withDifferentMemo = {
    ...withMemo,
    id: 'memo-2',
    name: 'Other subaccount',
    memo: { type: 'text' as const, value: '7' },
  };
  expect(activityIdentityNames([account], [withMemo, withDifferentMemo], 'test').get(account.address)).toBe('Wallet');
  expect(activityIdentityNames([account], [contact, withMemo, withDifferentMemo], 'test').get(account.address)).toBe(
    'Alice',
  );
  // An ambiguous plain-contact label must not be picked based on insertion order.
  expect(
    activityIdentityNames([], [contact, { ...contact, id: 'legacy-main', name: 'Bob', networkId: 'main' }], 'test')
      .size,
  ).toBe(0);
});
it('does not use hidden, contract or foreign-network accounts or empty labels', () => {
  for (const patch of [
    { hidden: true },
    { identityKind: 'contract' as const },
    { networkId: 'other' },
    { label: ' ' },
  ]) {
    expect(activityIdentityNames([{ ...account, ...patch }], [], 'test').size).toBe(0);
  }
});
