import { AccountAvatar } from '../AccountAvatar';
import React, { useEffect, useRef, useState } from 'react';
import { Pressable, Text } from 'react-native';
import { AccountIdentityCard, BottomSheet, Field, SectionedList } from '@ui/components';
import { NativeButton } from '@ui/components/NativeButton';
import type { Contact } from '@capabilities/contacts/contacts';
import { ContactEditor } from '../ContactEditor';
import { ParticipantCard } from '../ParticipantCard';
import { AddressBookScreen } from '../AddressBookScreen';
import { DestinationPicker } from '../DestinationPicker';
import { RecipientScanSheet } from '../RecipientScanSheet';
import { contactShareUri } from '../contactBook';
import { SendFlowScreen } from '../../send/SendFlowScreen';
import { SendResultScreen } from '../../send/SendResultScreen';
import { SendReviewScreen } from '../../send/SendReviewScreen';
import { SendFormScreen } from '../../send/SendFormScreen';
import type { SendProductDependencies } from '../../send/sendProductFlow';
import type { AccountRecord } from '@capabilities/account/types';
import type { Recipient } from '../contactBook';
import type { ContactBook, ContactScanner } from '../contactBook';

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
  avatar?: React.ReactElement<{ address: string; active?: boolean }>;
  label?: string;
  title?: string;
  name?: string;
  address?: string;
  id?: string;
  initial?: { name: string; address: string; memo?: unknown };
  onPress?: () => void;
  onClose?: () => void;
  onChooseRecipient?: () => void;
  onContinue?: () => void;
  step?: 'details' | 'recipient';
  amount?: string;
  memoType?: string;
  memoValue?: string;
  onBack?: () => void;
  onScanRecipient?: () => void;
  onChangeDestination?: (value: string) => void;
  onChangeMemoValue?: (value: string) => void;
  onSelect?: (recipient: Recipient) => void;
  accounts?: readonly AccountRecord[];
  onChangeText?: (text: string) => void;
  isCurrent?: () => boolean;
  presentation?: string;
  memoText?: string;
  secondary?: string;
  sections?: readonly { title: string; data: readonly Contact[] }[];
  renderItem?: (item: Contact) => React.ReactElement<Props>;
  keyExtractor?: (item: Contact) => string;
  onCode?: (value: string) => void;
  onError?: () => void;
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
      list: () => rows,
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
it('requires the current confirmation after Keep and reopening, rejecting old confirm/Keep/open/save callbacks', () => {
  const onClose = jest.fn();
  const draw = () => render(() => ContactEditor({ book, initial: row, id: row.id, onClose }));
  let root = draw();
  const oldOpen = button(root, 'contacts.delete');
  const oldSave = button(root, 'contacts.save');
  oldOpen();
  root = draw();
  const confirmA = button(root, 'contacts.delete');
  const keepA = button(root, 'contacts.keep');
  keepA();
  root = draw();
  button(root, 'contacts.delete')();
  root = draw();
  const confirmB = button(root, 'contacts.delete');
  confirmA();
  keepA();
  oldOpen();
  oldSave();
  expect(book.store.remove).not.toHaveBeenCalled();
  expect(book.store.save).not.toHaveBeenCalled();
  expect(onClose).not.toHaveBeenCalled();
  expect(nodes(draw(), NativeButton).some(node => node.props.label === 'contacts.keep')).toBe(true);
  confirmB();
  confirmB();
  expect(book.store.remove).toHaveBeenCalledTimes(1);
  expect(book.store.remove).toHaveBeenCalledWith('test', row.id);
  expect(onClose).toHaveBeenCalledTimes(1);
});
it.each(['close', 'unmount', 'parent'] as const)('retires confirmation callbacks on %s', retirement => {
  let current = true;
  const onClose = jest.fn();
  const draw = () => render(() => ContactEditor({ book, initial: row, id: row.id, onClose, isCurrent: () => current }));
  button(draw(), 'contacts.delete')();
  const root = draw();
  const confirm = button(root, 'contacts.delete');
  const keep = button(root, 'contacts.keep');
  if (retirement === 'close') button(root, 'common.cancel')();
  else if (retirement === 'parent') current = false;
  else {
    const mount = jest.mocked(useEffect).mock.calls[0][0];
    const cleanup = mount();
    if (typeof cleanup !== 'function') throw new Error('missing editor cleanup');
    cleanup();
  }
  confirm();
  keep();
  confirm();
  expect(book.store.remove).not.toHaveBeenCalled();
  expect(onClose).toHaveBeenCalledTimes(retirement === 'close' ? 1 : 0);
});
it('keeps current editor actions valid through effect setup/cleanup replay', () => {
  const onClose = jest.fn();
  const draw = () => render(() => ContactEditor({ book, initial: row, id: row.id, onClose }));
  const root = draw();
  const mount = jest.mocked(useEffect).mock.calls[0][0];
  const cleanup = mount();
  if (typeof cleanup !== 'function') throw new Error('missing editor cleanup');
  cleanup();
  mount();
  button(root, 'contacts.delete')();
  button(draw(), 'contacts.delete')();
  expect(book.store.remove).toHaveBeenCalledTimes(1);
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
  expect(nodes(root, AccountIdentityCard)[0].props.avatar?.type).toBe(AccountAvatar);
  expect(nodes(root, AccountIdentityCard)[0].props.avatar?.props.address).toBe(row.address);
  nodes(root, Pressable)[0].props.onPress!();
  root = draw();
  button(root, 'contacts.add')();
  root = draw();
  const editor = nodes(root, ContactEditor)[0];
  expect(editor.props.id).toBeUndefined();
  expect(editor.props.initial).toEqual({ name: '', address: row.address, memo: undefined });
});
it('shows an address-only saved name for a memo recipient but does not copy that contact memo or edit it', () => {
  rows = [{ ...row, name: 'Plain label' }];
  const requestedMemo = { type: 'id' as const, value: '9' };
  const draw = () =>
    render(() => ParticipantCard({ book, label: 'Recipient', address: row.address, memo: requestedMemo }));
  let root = draw();
  expect(nodes(root, AccountIdentityCard)[0].props).toMatchObject({
    name: 'Plain label',
    secondary: 'contacts.source.addressOnly',
  });
  nodes(root, Pressable)[0].props.onPress!();
  root = draw();
  button(root, 'contacts.add')();
  const editor = nodes(draw(), ContactEditor)[0];
  expect(editor.props.id).toBeUndefined();
  expect(editor.props.initial).toEqual({ name: '', address: row.address, memo: requestedMemo });
  expect(book.store.save).not.toHaveBeenCalled();
});

it('prefers exact memo contact for display and editor; ambiguous legacy matches do not claim that name', () => {
  const exact = { ...row, id: 'exact', name: 'Memo subaccount', memo: { type: 'id' as const, value: '7' } };
  rows = [row, exact];
  const draw = () =>
    render(() =>
      ParticipantCard({ book, label: 'Recipient', address: row.address, memo: { type: 'id', value: '007' } }),
    );
  let root = draw();
  expect(nodes(root, AccountIdentityCard)[0].props.name).toBe('Memo subaccount');
  nodes(root, Pressable)[0].props.onPress!();
  button(draw(), 'contacts.edit')();
  expect(nodes(draw(), ContactEditor)[0].props.id).toBe('exact');

  // Ambiguous identities can use the own-wallet label, not a conflicting
  // contact label or an unrelated address-only fallback.
  values = [];
  refs = [];
  rows = [row, exact, { ...exact, id: 'legacy', name: 'Other memo', networkId: 'main' }];
  const account = {
    address: row.address,
    networkId: 'test',
    label: 'My Wallet',
    identityKind: 'classic',
    hidden: false,
  } as AccountRecord;
  root = render(() =>
    ParticipantCard({
      book,
      label: 'Recipient',
      accounts: [account],
      address: row.address,
      memo: { type: 'id', value: '7' },
    }),
  );
  expect(nodes(root, AccountIdentityCard)[0].props).toMatchObject({
    name: 'My Wallet',
    secondary: 'contacts.source.account',
  });
});

it('keeps own-wallet labels network-isolated when no contact is saved', () => {
  rows = [];
  const account = {
    address: row.address,
    networkId: 'test',
    label: 'Wallet A',
    identityKind: 'classic',
    hidden: false,
  } as AccountRecord;
  expect(
    nodes(
      render(() => ParticipantCard({ book, label: 'Recipient', accounts: [account], address: row.address })),
      AccountIdentityCard,
    )[0].props.name,
  ).toBe('Wallet A');
  expect(
    nodes(
      render(() =>
        ParticipantCard({
          book,
          label: 'Recipient',
          accounts: [{ ...account, networkId: 'main' }],
          address: row.address,
        }),
      ),
      AccountIdentityCard,
    )[0].props.name,
  ).toBe('');
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
it('shows sorted/searchable global contacts and wires list-to-editor without saving on cancel', () => {
  rows = [{ ...row, id: 'z', name: 'Zoe' }, row, { ...row, id: 'main', networkId: 'main', name: 'Other' }];
  const draw = () => render(() => AddressBookScreen({ book, onBack: jest.fn() }));
  let root = draw();
  const sections = nodes(root, SectionedList)[0].props;
  expect(sections.sections?.map(section => section.title)).toEqual(['A', 'O', 'Z']);
  expect(sections.sections?.flatMap(section => section.data.map(contact => contact.name))).toEqual([
    'Alice',
    'Other',
    'Zoe',
  ]);
  expect(sections.keyExtractor?.(row)).toBe(row.id);
  const card = sections.renderItem!(row);
  expect(card.type).toBe(AccountIdentityCard);
  expect(card.props.presentation).toBe('selectable');
  nodes(root, Field)[0].props.onChangeText!('zo');
  root = draw();
  const filtered = nodes(root, SectionedList)[0].props;
  expect(filtered.sections?.map(section => section.title)).toEqual(['Z']);
  expect(filtered.sections?.[0].data).toHaveLength(1);
  nodes(root, Field)[0].props.onChangeText!('no match');
  root = draw();
  expect(nodes(root, SectionedList)[0].props.sections).toEqual([]);
  nodes(root, Field)[0].props.onChangeText!('zo');
  root = draw();
  const matching = nodes(root, SectionedList)[0].props;
  matching.renderItem!(matching.sections![0].data[0]).props.onPress!();
  root = draw();
  const editor = nodes(root, ContactEditor)[0];
  expect(editor.props.id).toBe('z');
  editor.props.onClose!();
  expect(editor.props.isCurrent!()).toBe(false);
  expect(book.store.save).not.toHaveBeenCalled();
});
it('scans a validated recipient and memo into the editor without saving or accepting stale scan events', async () => {
  const ScannerView = () => null;
  const scanner: ContactScanner = {
    ScannerView,
    ingress: {
      checkCameraPermission: jest.fn().mockResolvedValue('granted'),
      requestCameraPermission: jest.fn(),
      openCameraSettings: jest.fn(),
    },
  };
  const draw = () => render(() => ContactEditor({ book, scanner, onClose: jest.fn() }));
  button(draw(), 'contacts.scan.open')();
  await Promise.resolve();
  let root = draw();
  const first = nodes(root, ScannerView)[0].props.onCode!;
  first('web+stellar:pay?destination=GVALID&memo=007&memo_type=MEMO_ID&network_passphrase=test-passphrase');
  expect(values.slice(1, 4)).toEqual(['GVALID', 'id', '7']);
  expect(book.store.save).not.toHaveBeenCalled();
  expect(nodes(draw(), ScannerView)).toHaveLength(0);

  button(draw(), 'contacts.scan.open')();
  await Promise.resolve();
  root = draw();
  first('GVALID');
  expect(values.slice(1, 4)).toEqual(['GVALID', 'id', '7']);
  const second = nodes(root, ScannerView)[0].props.onCode!;
  second('GVALID');
  expect(values.slice(1, 4)).toEqual(['GVALID', 'none', '']);
  expect(book.store.save).not.toHaveBeenCalled();
});

it('cannot save from a stale editor callback while scanning or after scanner cancellation', async () => {
  const ScannerView = () => null;
  const scanner: ContactScanner = {
    ScannerView,
    ingress: {
      checkCameraPermission: jest.fn().mockResolvedValue('granted'),
      requestCameraPermission: jest.fn(),
      openCameraSettings: jest.fn(),
    },
  };
  const onClose = jest.fn();
  const draw = () => render(() => ContactEditor({ book, scanner, initial: row, id: row.id, onClose }));
  const old = draw();
  const staleSave = button(old, 'contacts.save');
  button(old, 'contacts.scan.open')();
  await Promise.resolve();
  staleSave();
  button(draw(), 'contacts.save')();
  expect(book.store.save).not.toHaveBeenCalled();
  nodes(draw(), BottomSheet)[0].props.onClose!();
  staleSave();
  expect(book.store.save).not.toHaveBeenCalled();
  button(draw(), 'contacts.save')();
  expect(book.store.save).toHaveBeenCalledTimes(1);
  expect(onClose).toHaveBeenCalledTimes(1);
});

it('closes the camera on cancel and ignores a late camera permission response', async () => {
  let resolvePermission: (value: 'granted') => void = () => {};
  const ScannerView = () => null;
  const scanner: ContactScanner = {
    ScannerView,
    ingress: {
      checkCameraPermission: jest.fn(
        () =>
          new Promise<'granted'>(resolve => {
            resolvePermission = resolve;
          }),
      ),
      requestCameraPermission: jest.fn(),
      openCameraSettings: jest.fn(),
    },
  };
  const draw = () => render(() => ContactEditor({ book, scanner, onClose: jest.fn() }));
  button(draw(), 'contacts.scan.open')();
  let root = draw();
  expect(nodes(root, ScannerView)).toHaveLength(0);
  nodes(root, BottomSheet)[0].props.onClose!();
  resolvePermission('granted');
  await Promise.resolve();
  root = draw();
  expect(nodes(root, BottomSheet)).toHaveLength(0);
  expect(nodes(root, ScannerView)).toHaveLength(0);
  expect(book.store.save).not.toHaveBeenCalled();
});

it('rejects unsupported QR content, permits explicit retry, and does not revive the old scanner frame', async () => {
  const ScannerView = () => null;
  const scanner: ContactScanner = {
    ScannerView,
    ingress: {
      checkCameraPermission: jest.fn().mockResolvedValue('granted'),
      requestCameraPermission: jest.fn(),
      openCameraSettings: jest.fn(),
    },
  };
  const draw = () => render(() => ContactEditor({ book, scanner, onClose: jest.fn() }));
  button(draw(), 'contacts.scan.open')();
  await Promise.resolve();
  let root = draw();
  const stale = nodes(root, ScannerView)[0].props.onCode!;
  stale('web+stellar:tx?xdr=private');
  expect(values[7]).toBe('contacts.scan.invalid');
  expect(values[1]).toBe('');
  expect(nodes(draw(), ScannerView)).toHaveLength(0);
  button(draw(), 'activity.retry')();
  expect(scanner.ingress.checkCameraPermission).toHaveBeenCalledTimes(2);
  expect(nodes(draw(), ScannerView)).toHaveLength(0);
  await Promise.resolve();
  root = draw();
  stale('GVALID');
  expect(values[1]).toBe('');
  nodes(root, ScannerView)[0].props.onCode!('GVALID');
  expect(values[1]).toBe('GVALID');
  expect(book.store.save).not.toHaveBeenCalled();
});

it('rechecks permission after a camera permission query exception before mounting a camera', async () => {
  const ScannerView = () => null;
  const scanner: ContactScanner = {
    ScannerView,
    ingress: {
      checkCameraPermission: jest
        .fn()
        .mockRejectedValueOnce(new Error('permission-check-failed'))
        .mockResolvedValueOnce('granted'),
      requestCameraPermission: jest.fn(),
      openCameraSettings: jest.fn(),
    },
  };
  const draw = () => render(() => ContactEditor({ book, scanner, onClose: jest.fn() }));
  button(draw(), 'contacts.scan.open')();
  await Promise.resolve();
  expect(nodes(draw(), ScannerView)).toHaveLength(0);

  button(draw(), 'activity.retry')();
  expect(scanner.ingress.checkCameraPermission).toHaveBeenCalledTimes(2);
  expect(nodes(draw(), ScannerView)).toHaveLength(0);
  await Promise.resolve();
  expect(nodes(draw(), ScannerView)).toHaveLength(1);
  expect(scanner.ingress.requestCameraPermission).not.toHaveBeenCalled();
  expect(book.store.save).not.toHaveBeenCalled();
});

it('rechecks and requests permission after a camera permission request exception', async () => {
  const ScannerView = () => null;
  const scanner: ContactScanner = {
    ScannerView,
    ingress: {
      checkCameraPermission: jest.fn().mockResolvedValue('denied'),
      requestCameraPermission: jest
        .fn()
        .mockRejectedValueOnce(new Error('permission-request-failed'))
        .mockResolvedValueOnce('blocked'),
      openCameraSettings: jest.fn(),
    },
  };
  const draw = () => render(() => ContactEditor({ book, scanner, onClose: jest.fn() }));
  button(draw(), 'contacts.scan.open')();
  await Promise.resolve();
  await Promise.resolve();
  expect(nodes(draw(), ScannerView)).toHaveLength(0);
  expect(scanner.ingress.requestCameraPermission).toHaveBeenCalledTimes(1);

  button(draw(), 'activity.retry')();
  expect(scanner.ingress.checkCameraPermission).toHaveBeenCalledTimes(2);
  expect(nodes(draw(), ScannerView)).toHaveLength(0);
  await Promise.resolve();
  expect(scanner.ingress.requestCameraPermission).toHaveBeenCalledTimes(2);
  expect(nodes(draw(), ScannerView)).toHaveLength(0);
  await Promise.resolve();
  expect(nodes(draw(), ScannerView)).toHaveLength(0);
  expect(nodes(draw(), BottomSheet)).toHaveLength(1);
  expect(book.store.save).not.toHaveBeenCalled();
});

it('keeps camera denied and blocked permissions out of camera view and supports settings handoff', async () => {
  const ScannerView = () => null;
  const scanner: ContactScanner = {
    ScannerView,
    ingress: {
      checkCameraPermission: jest.fn().mockResolvedValue('denied'),
      requestCameraPermission: jest.fn().mockResolvedValue('blocked'),
      openCameraSettings: jest.fn().mockResolvedValue(undefined),
    },
  };
  const draw = () => render(() => ContactEditor({ book, scanner, onClose: jest.fn() }));
  button(draw(), 'contacts.scan.open')();
  await Promise.resolve();
  await Promise.resolve();
  expect(nodes(draw(), ScannerView)).toHaveLength(0);
  button(draw(), 'contacts.scan.settings')();
  expect(scanner.ingress.openCameraSettings).toHaveBeenCalledTimes(1);
  nodes(draw(), BottomSheet)[0].props.onClose!();
  expect(nodes(draw(), ScannerView)).toHaveLength(0);
});
it('Send QR scan requires camera permission and returns only address and exact typed memo', async () => {
  const ScannerView = () => null;
  const scanner: ContactScanner = {
    ScannerView,
    ingress: {
      checkCameraPermission: jest.fn().mockResolvedValue('granted'),
      requestCameraPermission: jest.fn(),
      openCameraSettings: jest.fn(),
    },
  };
  const onSelect = jest.fn();
  const draw = () => render(() =>
    RecipientScanSheet({ book, scanner, active: true, onClose: jest.fn(), onSelect }),
  );
  draw();
  const mount = jest.mocked(useEffect).mock.calls[0][0];
  mount();
  await Promise.resolve();
  const root = draw();
  expect(nodes(root, ScannerView)).toHaveLength(1);
  const code = nodes(root, ScannerView)[0].props.onCode!;
  code('web+stellar:pay?destination=GVALID&memo=007&memo_type=MEMO_ID&amount=2&network_passphrase=test-passphrase');
  expect(onSelect).toHaveBeenCalledWith({ address: row.address, memo: { type: 'id', value: '7' } });
  expect(onSelect).toHaveBeenCalledTimes(1);
  code('GVALID');
  expect(onSelect).toHaveBeenCalledTimes(1);
  expect(scanner.ingress.requestCameraPermission).not.toHaveBeenCalled();
  expect(book.store.save).not.toHaveBeenCalled();
});

it('Send QR retry rechecks and requests OS permission instead of promoting an error to granted', async () => {
  const ScannerView = () => null;
  const scanner: ContactScanner = {
    ScannerView,
    ingress: {
      checkCameraPermission: jest.fn().mockRejectedValueOnce(new Error('OS error')).mockResolvedValueOnce('denied'),
      requestCameraPermission: jest.fn().mockResolvedValue('blocked'),
      openCameraSettings: jest.fn().mockResolvedValue(undefined),
    },
  };
  const onSelect = jest.fn();
  const draw = () => render(() =>
    RecipientScanSheet({ book, scanner, active: true, onClose: jest.fn(), onSelect }),
  );
  draw();
  jest.mocked(useEffect).mock.calls[0][0]();
  await Promise.resolve();
  expect(nodes(draw(), ScannerView)).toHaveLength(0);
  button(draw(), 'activity.retry')();
  expect(scanner.ingress.checkCameraPermission).toHaveBeenCalledTimes(2);
  expect(nodes(draw(), ScannerView)).toHaveLength(0);
  await Promise.resolve();
  expect(scanner.ingress.requestCameraPermission).toHaveBeenCalledTimes(1);
  await Promise.resolve();
  expect(nodes(draw(), ScannerView)).toHaveLength(0);
  button(draw(), 'contacts.scan.settings')();
  expect(scanner.ingress.openCameraSettings).toHaveBeenCalledTimes(1);
  expect(onSelect).not.toHaveBeenCalled();
});

it('Send QR rejects foreign-network/unsupported QR without filling a recipient', async () => {
  const ScannerView = () => null;
  const scanner: ContactScanner = {
    ScannerView,
    ingress: {
      checkCameraPermission: jest.fn().mockResolvedValue('granted'),
      requestCameraPermission: jest.fn(),
      openCameraSettings: jest.fn(),
    },
  };
  const onSelect = jest.fn();
  const draw = () => render(() =>
    RecipientScanSheet({ book, scanner, active: true, onClose: jest.fn(), onSelect }),
  );
  draw();
  jest.mocked(useEffect).mock.calls[0][0]();
  await Promise.resolve();
  let root = draw();
  const stale = nodes(root, ScannerView)[0].props.onCode!;
  stale('web+stellar:pay?destination=GVALID&memo=7&memo_type=MEMO_ID&network_passphrase=foreign');
  expect(onSelect).not.toHaveBeenCalled();
  expect(nodes(draw(), ScannerView)).toHaveLength(0);
  button(draw(), 'activity.retry')();
  await Promise.resolve();
  root = draw();
  stale('GVALID');
  expect(onSelect).not.toHaveBeenCalled();
  nodes(root, ScannerView)[0].props.onCode!('GVALID');
  expect(onSelect).toHaveBeenCalledWith({ address: row.address });
});

it('Send QR cancel retires an in-flight permission check and late camera callbacks', async () => {
  let grant: (permission: 'granted') => void = () => {};
  const ScannerView = () => null;
  const scanner: ContactScanner = {
    ScannerView,
    ingress: {
      checkCameraPermission: jest.fn(
        () => new Promise<'granted'>(resolve => { grant = resolve; }),
      ),
      requestCameraPermission: jest.fn(),
      openCameraSettings: jest.fn(),
    },
  };
  const onClose = jest.fn();
  const onSelect = jest.fn();
  const draw = () => render(() => RecipientScanSheet({ book, scanner, active: true, onClose, onSelect }));
  draw();
  jest.mocked(useEffect).mock.calls[0][0]();
  const checking = draw();
  nodes(checking, BottomSheet)[0].props.onClose!();
  grant('granted');
  await Promise.resolve();
  expect(nodes(draw(), ScannerView)).toHaveLength(0);
  expect(onSelect).not.toHaveBeenCalled();
  expect(onClose).toHaveBeenCalledTimes(1);
});

it('Send amount and asset step precedes recipient selection and supports Back without losing the draft', () => {
  const asset = { kind: 'native' as const, code: 'XLM' as const };
  values = [{ kind: 'ready', balances: [{ asset, balance: '12' }] }, { kind: 'form' },
    asset, 'GVALID', '0', 'id', '007', false, false, false, '', undefined, false];
  const account = { id: 'sender', networkId: book.network.id } as AccountRecord;
  const dependencies = { network: book.network } as SendProductDependencies;
  const draw = () => render(() => SendFlowScreen({ account, dependencies, contacts: book, onDone: jest.fn() }));
  let form = nodes(draw(), SendFormScreen)[0];
  expect(form.props.step).toBe('details');
  form.props.onContinue!();
  expect(nodes(draw(), SendFormScreen)[0].props.step).toBe('details');
  expect(values[11]).toBe('send.step.amountInvalid');
  values[4] = '1.5';
  form = nodes(draw(), SendFormScreen)[0];
  form.props.onContinue!();
  expect(nodes(draw(), SendFormScreen)[0].props.step).toBe('recipient');
  form = nodes(draw(), SendFormScreen)[0];
  expect(form.props.amount).toBe('1.5');
  expect(form.props.memoType).toBe('id');
  expect(form.props.memoValue).toBe('007');
  form.props.onBack!();
  expect(nodes(draw(), SendFormScreen)[0].props.step).toBe('details');
  expect([values[3], values[4], values[5], values[6]]).toEqual(['GVALID', '1.5', 'id', '007']);
});

it('Recipient QR fills an exact address/memo and retires a cancelled scan frame', () => {
  const asset = { kind: 'native' as const, code: 'XLM' as const };
  values = [{ kind: 'ready', balances: [{ asset, balance: '12' }] }, { kind: 'form' },
    asset, '', '1', 'none', '', false, false, false, '', undefined, false];
  const account = { id: 'sender', networkId: book.network.id } as AccountRecord;
  const scanner: ContactScanner = {
    ScannerView: () => null,
    ingress: {
      checkCameraPermission: jest.fn().mockResolvedValue('granted'),
      requestCameraPermission: jest.fn(),
      openCameraSettings: jest.fn(),
    },
  };
  const draw = (active = true) => render(() =>
    SendFlowScreen({ account, dependencies: { network: book.network } as SendProductDependencies,
      contacts: book, scanner, active, onDone: jest.fn() }),
  );
  nodes(draw(), SendFormScreen)[0].props.onContinue!();
  nodes(draw(), SendFormScreen)[0].props.onScanRecipient!();
  const sheet = nodes(draw(), RecipientScanSheet)[0];
  expect(sheet.props).toBeDefined();
  expect(values[3]).toBe('');
  sheet.props.onSelect!({ address: 'GVALID', memo: { type: 'id', value: '007' } });
  expect([values[3], values[5], values[6]]).toEqual(['GVALID', 'id', '007']);
  expect(nodes(draw(), RecipientScanSheet)).toHaveLength(0);
  sheet.props.onSelect!({ address: 'GWRONG' });
  expect(values[3]).toBe('GVALID');
  expect(book.store.save).not.toHaveBeenCalled();
});

it('removing or editing a previously selected contact address does not reuse its original saved Memo', () => {
  const asset = { kind: 'native' as const, code: 'XLM' as const };
  values = [{ kind: 'ready', balances: [{ asset, balance: '12' }] }, { kind: 'form' },
    asset, '', '1', 'none', '', false, false, false, '', undefined, false];
  const account = { id: 'sender', networkId: book.network.id } as AccountRecord;
  const draw = () => render(() =>
    SendFlowScreen({ account, dependencies: { network: book.network } as SendProductDependencies,
      contacts: book, onDone: jest.fn() }),
  );
  nodes(draw(), SendFormScreen)[0].props.onContinue!();
  nodes(draw(), SendFormScreen)[0].props.onChooseRecipient!();
  nodes(draw(), DestinationPicker)[0].props.onSelect!({ address: 'GVALID', memo: { type: 'id', value: '7' } });
  expect([values[3], values[5], values[6]]).toEqual(['GVALID', 'id', '7']);
  nodes(draw(), SendFormScreen)[0].props.onChangeDestination!('GCHANGED');
  expect([values[3], values[5], values[6]]).toEqual(['GCHANGED', 'none', '']);
  // A memo subsequently entered deliberately by the user is no longer treated as a contact prefill.
  nodes(draw(), SendFormScreen)[0].props.onChangeMemoValue!('my-memo');
  nodes(draw(), SendFormScreen)[0].props.onChangeDestination!('GANOTHER');
  expect([values[3], values[6]]).toEqual(['GANOTHER', 'my-memo']);
});

it('Activity participant editor receives the injected scanner without changing the contact identity', () => {
  const scanner: ContactScanner = {
    ScannerView: () => null,
    ingress: {
      checkCameraPermission: jest.fn(),
      requestCameraPermission: jest.fn(),
      openCameraSettings: jest.fn(),
    },
  };
  const draw = () => render(() =>
    ParticipantCard({ book, address: row.address, label: 'Counterparty', scanner }),
  );
  nodes(draw(), Pressable)[0].props.onPress!();
  button(draw(), 'contacts.edit')();
  const editor = nodes(draw(), ContactEditor)[0];
  expect(editor.props).toMatchObject({ scanner, id: row.id, initial: row });
  expect(book.store.save).not.toHaveBeenCalled();
});

it('keeps Return and Hash contacts distinct through Send selection, Back, and manual destination edits', () => {
  const value = 'ab'.repeat(32);
  rows = [
    { ...row, id: 'return-contact', name: 'Return', memo: { type: 'return', value } },
    { ...row, id: 'hash-contact', name: 'Hash', memo: { type: 'hash', value } },
  ];
  const selected: Recipient[] = [];
  const contactPicker = render(() => DestinationPicker({
    book, accounts: [], onSelect: recipient => selected.push(recipient), onClose: jest.fn(),
  }));
  const contactRows = nodes(contactPicker, AccountIdentityCard);
  expect(contactRows).toHaveLength(2);
  contactRows.find(card => card.props.name === 'Return')?.props.onPress!();
  contactRows.find(card => card.props.name === 'Hash')?.props.onPress!();
  expect(selected).toEqual([
    { address: row.address, memo: { type: 'return', value } },
    { address: row.address, memo: { type: 'hash', value } },
  ]);
  const asset = { kind: 'native' as const, code: 'XLM' as const };
  values = [{ kind: 'ready', balances: [{ asset, balance: '10' }] }, { kind: 'form' },
    asset, '', '1', 'none', '', false, false, false, '', undefined, false];
  const account = { id: 'sender', networkId: book.network.id } as AccountRecord;
  const draw = () => render(() => SendFlowScreen({
    account, dependencies: { network: book.network } as SendProductDependencies,
    contacts: book, onDone: jest.fn(),
  }));
  nodes(draw(), SendFormScreen)[0].props.onContinue!();
  nodes(draw(), SendFormScreen)[0].props.onChooseRecipient!();
  let picker = nodes(draw(), DestinationPicker)[0];
  picker.props.onSelect!(selected[0]);
  expect([values[3], values[5], values[6]]).toEqual([row.address, 'return', value]);
  nodes(draw(), SendFormScreen)[0].props.onBack!();
  expect(nodes(draw(), SendFormScreen)[0].props.step).toBe('details');
  nodes(draw(), SendFormScreen)[0].props.onContinue!();
  expect([values[3], values[5], values[6]]).toEqual([row.address, 'return', value]);
  nodes(draw(), SendFormScreen)[0].props.onChangeDestination!('GCHANGED');
  expect([values[3], values[5], values[6]]).toEqual(['GCHANGED', 'none', '']);
  nodes(draw(), SendFormScreen)[0].props.onChooseRecipient!();
  picker = nodes(draw(), DestinationPicker)[0];
  picker.props.onSelect!(selected[1]);
  expect([values[3], values[5], values[6]]).toEqual([row.address, 'hash', value]);
  expect(book.store.save).not.toHaveBeenCalled();
});

it('retains SEP-7 MEMO_RETURN as typed hex when the Send scanner fills Recipient', async () => {
  const ScannerView = () => null;
  const scanner: ContactScanner = {
    ScannerView,
    ingress: {
      checkCameraPermission: jest.fn().mockResolvedValue('granted'),
      requestCameraPermission: jest.fn(),
      openCameraSettings: jest.fn(),
    },
  };
  const recipient = { address: row.address, memo: { type: 'return' as const, value: 'AB'.repeat(32) } };
  const qr = contactShareUri(book, recipient);
  expect(qr).toContain('memo_type=MEMO_RETURN');
  const onSelect = jest.fn();
  const draw = () => render(() =>
    RecipientScanSheet({ book, scanner, active: true, onClose: jest.fn(), onSelect }),
  );
  draw();
  jest.mocked(useEffect).mock.calls[0][0]();
  await Promise.resolve();
  nodes(draw(), ScannerView)[0].props.onCode!(qr);
  expect(onSelect).toHaveBeenCalledWith({
    address: row.address, memo: { type: 'return', value: 'ab'.repeat(32) },
  });
  expect(book.store.save).not.toHaveBeenCalled();
});

it('picker re-reads a selected contact instead of returning stale memo data', () => {
  const onSelect = jest.fn();
  const root = render(() => DestinationPicker({ book, accounts: [], onSelect, onClose: jest.fn() }));
  rows = [{ ...row, memo: { type: 'id', value: '8' } }];
  const selectedCard = nodes(root, AccountIdentityCard)[0];
  expect(selectedCard.props.presentation).toBe('selectable');
  expect(selectedCard.props.secondary).toBe('contacts.source.contact');
  selectedCard.props.onPress!();
  expect(onSelect).toHaveBeenLastCalledWith({ address: row.address, memo: { type: 'id', value: '8' } });
  rows = [];
  selectedCard.props.onPress!();
  expect(onSelect).toHaveBeenCalledTimes(1);
});

it('Send picker uses shared identity rows, keeps contacts global and own wallets network-scoped', () => {
  rows = [
    { ...row, networkId: 'main', memo: { type: 'text', value: 'ref-7' } },
    { ...row, id: 'other', name: 'Second', memo: undefined },
  ];
  const own = {
    id: 'own',
    label: 'Wallet',
    address: 'GOWN',
    networkId: 'test',
    identityKind: 'classic',
    hidden: false,
  } as AccountRecord;
  const foreign = { ...own, id: 'foreign', networkId: 'main', label: 'Wrong network' };
  const onSelect = jest.fn();
  const root = render(() =>
    DestinationPicker({
      book,
      accounts: [foreign, own],
      onSelect,
      onClose: jest.fn(),
    }),
  );
  const cards = nodes(root, AccountIdentityCard);
  expect(cards.map(card => card.props.name)).toEqual(['Alice', 'Second', 'Wallet']);
  expect(cards.map(card => card.props.secondary)).toEqual([
    'contacts.source.contact',
    'contacts.source.contact',
    'contacts.source.account',
  ]);
  expect(cards[0].props.memoText).toBe('send.memo.type.text: ref-7');
  cards[0].props.onPress!();
  expect(onSelect).toHaveBeenLastCalledWith({
    address: row.address,
    memo: { type: 'text', value: 'ref-7' },
  });
  cards[2].props.onPress!();
  expect(onSelect).toHaveBeenLastCalledWith({ address: own.address });
});
it('keeps another same-network wallet name from recipient selection through Send review and submitted result', () => {
  rows = [];
  const asset = { kind: 'native' as const, code: 'XLM' as const };
  const sender = {
    id: 'a',
    address: 'GSENDER',
    label: 'Sender A',
    networkId: 'test',
    identityKind: 'classic',
    hidden: false,
  } as AccountRecord;
  const receiver = { ...sender, id: 'b', address: 'GRECEIVER', label: 'Wallet B' };
  const foreign = { ...receiver, id: 'other-network', networkId: 'main', label: 'Foreign label' };
  const dependencies = { network: book.network } as SendProductDependencies;
  values = [
    { kind: 'ready', balances: [{ asset, balance: '10' }] },
    { kind: 'form' },
    asset,
    '',
    '1',
    'none',
    '',
    false,
    false,
    false,
    '',
    undefined,
    false,
  ];
  const props = {
    account: sender,
    dependencies,
    contacts: book,
    destinationAccounts: [sender, receiver, foreign],
    onDone: jest.fn(),
  };
  const draw = () => render(() => SendFlowScreen(props));
  expect(nodes(draw(), SendFormScreen)[0].props.step).toBe('details');
  nodes(draw(), SendFormScreen)[0].props.onContinue!();
  expect(nodes(draw(), SendFormScreen)[0].props.step).toBe('recipient');
  nodes(draw(), SendFormScreen)[0].props.onChooseRecipient!();
  const picker = nodes(draw(), DestinationPicker)[0];
  expect(picker.props.accounts).toEqual([sender, receiver, foreign]);
  picker.props.onSelect!({ address: receiver.address });
  expect(values[3]).toBe(receiver.address);
  expect(values[5]).toBe('none');
  expect(values[6]).toBe('');

  const display = (card: React.ReactElement) => {
    values = [];
    refs = [];
    const rendered = render(() => ParticipantCard(card.props as React.ComponentProps<typeof ParticipantCard>));
    return nodes(rendered, AccountIdentityCard)[0].props;
  };
  const state = values;
  const sharedRefs = refs;
  state[1] = { kind: 'review', review: { destination: receiver.address, memo: undefined } };
  const reviewCard = nodes(draw(), SendReviewScreen)[0].props.recipientCard as React.ReactElement<
    React.ComponentProps<typeof ParticipantCard>
  >;
  expect(display(reviewCard)).toMatchObject({ name: 'Wallet B', secondary: 'contacts.source.account' });

  values = state;
  refs = sharedRefs;
  state[1] = { kind: 'result', result: { status: 'submitted' }, recipient: { address: receiver.address } };
  const resultCard = nodes(draw(), SendResultScreen)[0].props.recipientCard as React.ReactElement<
    React.ComponentProps<typeof ParticipantCard>
  >;
  expect(display(resultCard)).toMatchObject({ name: 'Wallet B', secondary: 'contacts.source.account' });
  expect(reviewCard.props.address).toBe(receiver.address);
  expect(resultCard.props.address).toBe(receiver.address);
  expect(reviewCard.props.memo).toBeUndefined();
  expect(resultCard.props.memo).toBeUndefined();
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
  nodes(root, SendFormScreen)[0].props.onContinue!();
  root = draw();
  expect(nodes(root, SendFormScreen)[0].props.step).toBe('recipient');
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
  nodes(root, SendFormScreen)[0].props.onContinue!();
  root = draw(true);
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

it('uses the same address avatar for participant cards and disables it with an inactive detail', () => {
  const root = render(() => ParticipantCard({ book, label: 'Recipient', address: row.address, active: false }));
  const avatar = nodes(root, AccountIdentityCard)[0].props.avatar;
  expect(avatar?.type).toBe(AccountAvatar);
  expect(avatar?.props).toMatchObject({ address: row.address, active: false });
});

it('marks participant cards as opening more actions without adding a second touch target', () => {
  const root = render(() => ParticipantCard({ book, label: 'Sender', address: row.address }));
  const pressables = nodes(root, Pressable);
  expect(pressables).toHaveLength(1);
  expect(pressables[0].props).toMatchObject({ accessibilityHint: 'contacts.actionsHint' });
  const card = nodes(root, AccountIdentityCard)[0];
  const trailing = (card.props as { trailing?: React.ReactNode }).trailing;
  const glyph = nodes(trailing, Text)[0];
  expect(glyph.props).toMatchObject({
    children: '⋯', accessible: false, accessibilityElementsHidden: true,
    importantForAccessibility: 'no-hide-descendants',
  });
  pressables[0].props.onPress!();
  expect(nodes(render(() => ParticipantCard({ book, label: 'Sender', address: row.address })), BottomSheet)).toHaveLength(1);
});
