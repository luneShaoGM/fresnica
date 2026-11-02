import React, { useEffect, useRef, useState } from 'react';
import { Pressable } from 'react-native';
import { AccountIdentityCard, BottomSheet, Field, ListRow } from '@ui/components';
import { NativeButton } from '@ui/components/NativeButton';
import type { Contact } from '@capabilities/contacts/contacts';
import { ContactEditor } from '../ContactEditor';
import { ParticipantCard } from '../ParticipantCard';
import { AddressBookScreen } from '../AddressBookScreen';
import { DestinationPicker } from '../DestinationPicker';
import { SendFlowScreen } from '../../send/SendFlowScreen';
import { SendResultScreen } from '../../send/SendResultScreen';
import { SendFormScreen } from '../../send/SendFormScreen';
import type { SendProductDependencies } from '../../send/sendProductFlow';
import type { AccountRecord } from '@capabilities/account/types';
import type { Recipient } from '../contactBook';
import type { ContactBook } from '../contactBook';

jest.mock('@fresnica/ui-native', () => ({ Button: () => null }));
jest.mock('react', () => ({
  ...jest.requireActual('react'),
  useCallback: (fn: unknown) => fn,
  useState: jest.fn(),
  useRef: jest.fn(),
  useEffect: jest.fn(),
  useSyncExternalStore: () => 0,
}));
jest.mock('../../../locale', () => ({ useLocalization: () => ({ t: (key: string) => key }) }));
jest.mock('../../../ui/theme', () => {
  const actual = jest.requireActual('../../../ui/theme');
  return { ...actual, useThemedStyles: (factory: (theme: unknown) => unknown) => factory(actual.defaultTheme) };
});

type Props = {
  children?: React.ReactNode;
  recipientCard?: React.ReactNode;
  label?: string;
  title?: string;
  name?: string;
  address?: string;
  id?: string;
  initial?: { name: string; address: string; memo?: unknown };
  onPress?: () => void;
  onClose?: () => void;
  onChooseRecipient?: () => void;
  onSelect?: (recipient: Recipient) => void;
  onChangeText?: (text: string) => void;
  isCurrent?: () => boolean;
};
function nodes(root: React.ReactNode, type: unknown): React.ReactElement<Props>[] {
  const result: React.ReactElement<Props>[] = [];
  const visit = (node: React.ReactNode) => {
    if (React.isValidElement<Props>(node)) {
      if (node.type === type) result.push(node);
      React.Children.forEach(node.props.children, visit);
    }
  };
  visit(root);
  return result;
}
let values: unknown[];
let refs: { current: unknown }[];
let stateIndex = 0;
let refIndex = 0;
function render<T>(fn: () => T): T {
  stateIndex = 0;
  refIndex = 0;
  return fn();
}
function button(root: React.ReactNode, label: string) {
  const found = nodes(root, NativeButton).find(node => node.props.label === label);
  if (!found) throw new Error('button missing: ' + label);
  return found.props.onPress!;
}
const row: Contact = { id: 'one', networkId: 'test', name: 'Alice', address: 'GVALID' };
let rows: Contact[];
let book: ContactBook;
beforeEach(() => {
  values = [];
  refs = [];
  rows = [row];
  jest.mocked(useState).mockImplementation((initial?: unknown) => {
    const index = stateIndex++;
    if (!(index in values)) values[index] = initial;
    return [
      values[index],
      (next: unknown) => {
        values[index] = typeof next === 'function' ? next(values[index]) : next;
      },
    ] as ReturnType<typeof useState>;
  });
  jest.mocked(useRef).mockImplementation((initial?: unknown) => {
    const index = refIndex++;
    refs[index] ??= { current: initial };
    return refs[index] as ReturnType<typeof useRef>;
  });
  jest.mocked(useEffect).mockClear();
  book = {
    network: { id: 'test', networkPassphrase: 'test-passphrase' },
    store: {
      list: id => rows.filter(contact => contact.networkId === id),
      save: jest.fn(),
      remove: jest.fn(),
      subscribe: () => () => {},
      getRevision: () => 0,
    },
    createId: () => 'new',
    isClassicAccountAddress: value => value === 'GVALID',
    output: { shareRequestUri: jest.fn(), copyRequestUri: jest.fn() },
    copyPublicText: jest.fn(),
  };
});
it('keeps failed saves open, retries without losing input, and blocks a duplicate late save after success', () => {
  const onClose = jest.fn();
  jest.mocked(book.store.save).mockImplementationOnce(() => {
    throw new Error('disk-full');
  });
  const draw = () => render(() => ContactEditor({ book, initial: row, id: row.id, onClose }));
  button(draw(), 'contacts.save')();
  expect(onClose).not.toHaveBeenCalled();
  expect(values[4]).toBe('contacts.error.storage');
  const retry = button(draw(), 'contacts.save');
  retry();
  retry();
  expect(book.store.save).toHaveBeenCalledTimes(2);
  expect(book.store.save).toHaveBeenLastCalledWith(row);
  expect(onClose).toHaveBeenCalledTimes(1);
});
it('requires delete confirmation, honors Keep against stale callbacks, and supports failed delete retry', () => {
  const onClose = jest.fn();
  const draw = () => render(() => ContactEditor({ book, initial: row, id: row.id, onClose }));
  button(draw(), 'contacts.delete')();
  expect(book.store.remove).not.toHaveBeenCalled();
  let root = draw();
  const staleDelete = button(root, 'contacts.delete');
  button(root, 'contacts.keep')();
  staleDelete();
  expect(book.store.remove).not.toHaveBeenCalled();
  button(draw(), 'contacts.delete')();
  root = draw();
  jest.mocked(book.store.remove).mockImplementationOnce(() => {
    throw new Error('disk-full');
  });
  button(root, 'contacts.delete')();
  expect(onClose).not.toHaveBeenCalled();
  button(draw(), 'contacts.delete')();
  expect(book.store.remove).toHaveBeenLastCalledWith('test', row.id);
  expect(onClose).toHaveBeenCalledTimes(1);
});
it('cancellation and parent lifetime retirement prevent late editor writes', () => {
  let current = true;
  const draw = () =>
    render(() => ContactEditor({ book, initial: row, id: row.id, onClose: jest.fn(), isCurrent: () => current }));
  let root = draw();
  const stale = button(root, 'contacts.save');
  current = false;
  stale();
  expect(book.store.save).not.toHaveBeenCalled();
  current = true;
  root = draw();
  button(root, 'common.cancel')();
  stale();
  expect(book.store.save).not.toHaveBeenCalled();
});
it('does not assign a memo contact name to address-only Activity and offers a fresh no-memo contact', () => {
  rows = [{ ...row, memo: { type: 'id', value: '7' } }];
  const draw = () => render(() => ParticipantCard({ book, label: 'Counterparty', address: row.address }));
  let root = draw();
  expect(nodes(root, AccountIdentityCard)[0].props.name).toBe('');
  nodes(root, Pressable)[0].props.onPress!();
  root = draw();
  button(root, 'contacts.add')();
  root = draw();
  const editor = nodes(root, ContactEditor)[0];
  expect(editor.props.id).toBeUndefined();
  expect(editor.props.initial).toEqual({ name: '', address: row.address, memo: undefined });
});
it('does not reopen a cancelled participant menu/editor from a delayed callback, including after reopening', () => {
  const draw = () => render(() => ParticipantCard({ book, label: 'Counterparty', address: row.address }));
  let root = draw();
  nodes(root, Pressable)[0].props.onPress!();
  root = draw();
  const delayedEdit = button(root, 'contacts.edit');
  nodes(root, BottomSheet)[0].props.onClose!();
  delayedEdit();
  root = draw();
  expect(nodes(root, ContactEditor)).toHaveLength(0);
  expect(nodes(root, BottomSheet)).toHaveLength(0);
  nodes(root, Pressable)[0].props.onPress!();
  root = draw();
  delayedEdit();
  root = draw();
  expect(nodes(root, ContactEditor)).toHaveLength(0);
  button(root, 'contacts.edit')();
  root = draw();
  expect(nodes(root, ContactEditor)).toHaveLength(1);
});
it('shows sorted/searchable current-network contacts and wires list-to-editor without saving on cancel', () => {
  rows = [{ ...row, id: 'z', name: 'Zoe' }, row, { ...row, id: 'main', networkId: 'main', name: 'Other' }];
  const draw = () => render(() => AddressBookScreen({ book, onBack: jest.fn() }));
  let root = draw();
  expect(nodes(root, ListRow).map(node => node.props.title)).toEqual(['Alice', 'Zoe']);
  nodes(root, Field)[0].props.onChangeText!('zo');
  root = draw();
  expect(nodes(root, ListRow)).toHaveLength(1);
  nodes(root, ListRow)[0].props.onPress!();
  root = draw();
  const editor = nodes(root, ContactEditor)[0];
  expect(editor.props.id).toBe('z');
  editor.props.onClose!();
  expect(editor.props.isCurrent!()).toBe(false);
  expect(book.store.save).not.toHaveBeenCalled();
});
it('picker re-reads a selected contact instead of returning stale memo data', () => {
  const onSelect = jest.fn();
  const root = render(() => DestinationPicker({ book, accounts: [], onSelect, onClose: jest.fn() }));
  rows = [{ ...row, memo: { type: 'id', value: '8' } }];
  nodes(root, ListRow)[0].props.onPress!();
  expect(onSelect).toHaveBeenLastCalledWith({ address: row.address, memo: { type: 'id', value: '8' } });
  rows = [];
  nodes(root, ListRow)[0].props.onPress!();
  expect(onSelect).toHaveBeenCalledTimes(1);
});

it('Send picker applies the exact contact memo and ignores late selections after cancel and reopening', () => {
  const asset = { kind: 'native' as const, code: 'XLM' as const };
  values = [
    { kind: 'ready', balances: [{ asset, balance: '10' }] },
    { kind: 'form' },
    asset,
    'GOLD',
    '1',
    'id',
    '99',
    false,
    false,
    false,
    '',
    undefined,
    false,
  ];
  const account = { id: 'a', address: 'GSOURCE', networkId: book.network.id } as AccountRecord;
  const dependencies = { network: book.network, gateway: {}, repository: {} } as unknown as SendProductDependencies;
  const draw = () => render(() => SendFlowScreen({ account, dependencies, contacts: book, onDone: jest.fn() }));
  let root = draw();
  nodes(root, SendFormScreen)[0].props.onChooseRecipient!();
  root = draw();
  const delayed = nodes(root, DestinationPicker)[0].props.onSelect!;
  nodes(root, DestinationPicker)[0].props.onClose!();
  delayed({ address: 'GWRONG' });
  expect(values.slice(3, 7)).toEqual(['GOLD', '1', 'id', '99']);
  root = draw();
  nodes(root, SendFormScreen)[0].props.onChooseRecipient!();
  root = draw();
  delayed({ address: 'GWRONG' });
  expect(values[3]).toBe('GOLD');
  nodes(root, DestinationPicker)[0].props.onSelect!({ address: row.address, memo: { type: 'id', value: '7' } });
  expect([values[3], values[5], values[6]]).toEqual([row.address, 'id', '7']);
  root = draw();
  nodes(root, SendFormScreen)[0].props.onChooseRecipient!();
  root = draw();
  nodes(root, DestinationPicker)[0].props.onSelect!({ address: row.address });
  expect([values[3], values[5], values[6]]).toEqual([row.address, 'none', '']);
});

it('route blur immediately blocks a queued picker selection and hides the sheet', () => {
  const asset = { kind: 'native' as const, code: 'XLM' as const };
  values = [
    { kind: 'ready', balances: [{ asset, balance: '10' }] },
    { kind: 'form' },
    asset,
    'GOLD',
    '1',
    'id',
    '99',
    false,
    false,
    false,
    '',
    undefined,
    false,
  ];
  const account = { id: 'a', networkId: book.network.id } as AccountRecord;
  const dependencies = { network: book.network } as SendProductDependencies;
  const draw = (active: boolean) =>
    render(() => SendFlowScreen({ account, dependencies, contacts: book, active, onDone: jest.fn() }));
  let root = draw(true);
  nodes(root, SendFormScreen)[0].props.onChooseRecipient!();
  root = draw(true);
  const delayed = nodes(root, DestinationPicker)[0].props.onSelect!;
  root = draw(false);
  delayed({ address: 'GWRONG' });
  expect(values[3]).toBe('GOLD');
  expect(nodes(root, DestinationPicker)).toHaveLength(0);
});
it.each(['submitted', 'uncertain', 'rejected'])(
  'offers the result contact card only for deterministic submitted status (%s)',
  status => {
    const asset = { kind: 'native' as const, code: 'XLM' as const };
    values = [
      { kind: 'ready', balances: [{ asset, balance: '10' }] },
      { kind: 'result', result: { status }, recipient: { address: row.address, memo: { type: 'id', value: '7' } } },
    ];
    const root = render(() =>
      SendFlowScreen({
        account: {} as AccountRecord,
        dependencies: {} as SendProductDependencies,
        contacts: book,
        onDone: jest.fn(),
      }),
    );
    const card = nodes(root, SendResultScreen)[0].props.recipientCard;
    if (status === 'submitted')
      expect((card as React.ReactElement).props).toMatchObject({
        address: row.address,
        memo: { type: 'id', value: '7' },
      });
    else expect(card).toBeUndefined();
  },
);
