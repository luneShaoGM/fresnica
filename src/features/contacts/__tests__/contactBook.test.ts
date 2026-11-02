import type { AccountRecord } from '@capabilities/account/types';
import type { Contact } from '@capabilities/contacts/contacts';
import { parseRequestInput } from '@capabilities/request/requestUri';
import {
  contactRecipient,
  contactShareUri,
  destinationAccounts,
  recipientFields,
  type ContactBook,
} from '../contactBook';

const network = { id: 'stellar-testnet', networkPassphrase: 'Test SDF Network ; September 2015' };
const row: Contact = {
  id: '1',
  networkId: network.id,
  name: 'Exchange',
  address: 'GVALID',
  memo: { type: 'id', value: '7' },
};
function book(rows: readonly Contact[] = [row]): ContactBook {
  return {
    network,
    store: {
      list: id => rows.filter(contact => contact.networkId === id),
      save: jest.fn(),
      remove: jest.fn(),
      subscribe: () => () => {},
      getRevision: () => 0,
    },
    createId: () => 'new',
    isClassicAccountAddress: value => value === 'GVALID',
    copyPublicText: jest.fn(),
    output: { copyRequestUri: jest.fn(), shareRequestUri: jest.fn() },
  };
}

it('round trips exact address, memo type/value and current network through contact sharing', () => {
  const dependencies = book();
  const uri = contactShareUri(dependencies, row);
  const parsed = parseRequestInput({ ...dependencies, currentNetwork: network }, uri);
  expect(parsed).toMatchObject({
    status: 'accepted',
    intent: {
      destination: row.address,
      memo: row.memo,
      networkId: network.id,
      networkPassphrase: network.networkPassphrase,
    },
  });
  expect(
    parseRequestInput(
      {
        ...dependencies,
        currentNetwork: { id: 'main', networkPassphrase: 'Public Global Stellar Network ; September 2015' },
      },
      uri,
    ),
  ).toMatchObject({ status: 'rejected', reason: 'network-mismatch' });
});
it('re-reads contact identity on selection and fails closed on deletion or another network', () => {
  expect(contactRecipient(book(), row.id)).toEqual({ address: row.address, memo: row.memo });
  expect(() => contactRecipient(book([]), row.id)).toThrow('contact-not-found');
  expect(() => contactRecipient(book([{ ...row, networkId: 'other' }]), row.id)).toThrow('contact-not-found');
});
it('applies address and memo together and explicitly clears a previous memo for plain destinations', () => {
  expect(recipientFields(row)).toEqual({ destination: row.address, memoType: 'id', memoValue: '7' });
  expect(recipientFields({ address: row.address })).toEqual({
    destination: row.address,
    memoType: 'none',
    memoValue: '',
  });
});
it('offers only visible Classic accounts in the selected network, with searchable names and addresses', () => {
  const account = {
    id: 'a',
    label: 'Alice',
    address: 'GVALID',
    networkId: network.id,
    identityKind: 'classic',
    hidden: false,
  } as AccountRecord;
  const accounts = [
    account,
    { ...account, id: 'hidden', hidden: true },
    { ...account, id: 'contract', identityKind: 'contract' as const },
    { ...account, id: 'other', networkId: 'main' },
  ];
  expect(destinationAccounts(accounts, network.id, 'ali')).toEqual([account]);
  expect(destinationAccounts(accounts, network.id, 'unknown')).toEqual([]);
});
