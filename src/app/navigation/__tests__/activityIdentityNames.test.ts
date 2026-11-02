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
it('prioritizes exact current-network address-only contacts over visible local Classic account labels', () => {
  expect(activityIdentityNames([account], [contact], 'test').get(account.address)).toBe('Alice');
  expect(activityIdentityNames([account], [], 'test').get(account.address)).toBe('Wallet');
});
it('isolates networks, exact case and muxed identities, and never borrows a memo-specific contact', () => {
  const names = activityIdentityNames(
    [account],
    [
      { ...contact, networkId: 'other' },
      { ...contact, memo: { type: 'id', value: '7' } },
    ],
    'test',
  );
  expect(names.get(account.address)).toBe('Wallet');
  expect(names.get('gaddress')).toBeUndefined();
  expect(names.get('MADDRESS')).toBeUndefined();
  expect(activityIdentityNames([account], [contact], 'other').size).toBe(0);
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
