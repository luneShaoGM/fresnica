import type { AccountRecord } from '../../account/types';
import type { Contact } from '../contacts';
import { resolveLocalIdentityDisplay } from '../resolveLocalIdentity';

const plain: Contact = { id: 'plain', address: 'GRECIPIENT', name: 'Exchange', networkId: 'main' };
const memo: Contact = {
  id: 'memo',
  address: 'GRECIPIENT',
  name: 'Exchange subaccount',
  networkId: 'test',
  memo: { type: 'id', value: '7' },
};
const account = {
  id: 'wallet',
  address: 'GRECIPIENT',
  label: 'My Wallet',
  networkId: 'test',
  identityKind: 'classic',
  hidden: false,
} as AccountRecord;

function display(
  options: {
    address?: string;
    memo?: Contact['memo'];
    contacts?: readonly Contact[];
    accounts?: readonly AccountRecord[];
    networkId?: string;
  } = {},
) {
  return resolveLocalIdentityDisplay({
    address: options.address ?? plain.address,
    memo: options.memo,
    contacts: options.contacts ?? [plain, memo],
    accounts: options.accounts ?? [account],
    networkId: options.networkId ?? 'test',
  });
}

it('prefers unique typed-memo identity over an address-only contact and matches canonical memo IDs', () => {
  expect(display({ memo: { type: 'id', value: '007' } })).toEqual({
    name: 'Exchange subaccount',
    source: 'contact',
    match: 'exact',
  });
  expect(display()).toEqual({ name: 'Exchange', source: 'contact', match: 'exact' });
});

it('uses a unique address-only contact only for display, never a different memo-specific contact', () => {
  expect(display({ memo: { type: 'text', value: '7' } })).toEqual({
    name: 'Exchange',
    source: 'contact',
    match: 'address-only',
  });
  expect(display({ contacts: [memo], accounts: [], memo: { type: 'text', value: '7' } })).toEqual({
    name: plain.address,
    source: 'address',
    match: 'none',
  });
  expect(display({ contacts: [memo], accounts: [] })).toEqual({
    name: plain.address,
    source: 'address',
    match: 'none',
  });
});

it('refuses ambiguous legacy exact identities, even if a unique address-only entry exists', () => {
  const conflict = { ...memo, id: 'legacy-main', networkId: 'main', name: 'Other subaccount' };
  expect(display({ contacts: [plain, memo, conflict], accounts: [], memo: { type: 'id', value: '7' } })).toEqual({
    name: plain.address,
    source: 'address',
    match: 'ambiguous',
  });
  expect(display({ contacts: [plain, { ...plain, id: 'legacy' }], accounts: [] })).toEqual({
    name: plain.address,
    source: 'address',
    match: 'ambiguous',
  });
});

it('falls back to a uniquely matching visible Classic wallet only on the active network', () => {
  const data = { contacts: [] as Contact[], accounts: [account], memo: memo.memo };
  expect(display(data)).toEqual({ name: 'My Wallet', source: 'account', match: 'none' });
  expect(display({ ...data, networkId: 'main' }).source).toBe('address');
  expect(display({ ...data, accounts: [{ ...account, hidden: true }] }).source).toBe('address');
  expect(display({ ...data, accounts: [{ ...account, identityKind: 'contract' }] }).source).toBe('address');
  expect(display({ ...data, accounts: [account, { ...account, id: 'duplicate' }] }).source).toBe('address');
});

it('does not normalize different public addresses or guess a name from a different network wallet', () => {
  expect(display({ address: 'grecipient', accounts: [account] })).toEqual({
    name: 'grecipient',
    source: 'address',
    match: 'none',
  });
  expect(display({ contacts: [plain], accounts: [], networkId: 'other' }).source).toBe('contact');
});
