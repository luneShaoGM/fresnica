import React, { useSyncExternalStore } from 'react';
import type { AccountRecord } from '@capabilities/account/types';
import type { Contact } from '@capabilities/contacts/contacts';
import type { AppServices } from '../../createAppServices';
import { ActivityStackNavigator } from '../ActivityStackNavigator';
import { ActivityScreen } from '@features/activity/ActivityScreen';

jest.mock('react', () => ({
  ...jest.requireActual('react'),
  useMemo: (factory: () => unknown) => factory(),
  useSyncExternalStore: jest.fn(),
}));
jest.mock('@react-navigation/native-stack', () => ({
  createNativeStackNavigator: () => ({ Navigator: 'Navigator', Screen: 'Screen' }),
}));
jest.mock('@react-navigation/native', () => ({ useIsFocused: () => true }));
jest.mock('@features/activity/ActivityScreen', () => ({ ActivityScreen: () => null }));
jest.mock('@features/activity/OperationDetailsScreen', () => ({ OperationDetailsScreen: () => null }));

const now = new Date();
const account: AccountRecord = {
  id: 'a',
  address: 'GLOCAL',
  networkId: 'test',
  identityKind: 'classic',
  label: 'Local',
  hidden: false,
  sortOrder: 0,
  createdAt: now,
  updatedAt: now,
};
type ScreenProps = React.ComponentProps<typeof ActivityScreen>;
type RouteProps = {
  name: string;
  children(context: { navigation: { navigate: jest.Mock } }): React.ReactElement<ScreenProps>;
};
it('subscribes at composition, updates contacts and failures without replacing history dependencies, and preserves exact detail route', () => {
  let contacts: Contact[] = [{ id: 'c', networkId: 'test', address: 'GLOCAL', name: 'Alice' }];
  let failed = false;
  let revision = 0;
  const listeners = new Set<() => void>();
  const subscribe = jest.fn((listener: () => void) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  });
  let dirty = false;
  jest.mocked(useSyncExternalStore).mockImplementation((subscribeStore, getSnapshot) => {
    if (subscribeStore === subscribe && !listeners.size)
      subscribeStore(() => {
        dirty = true;
      });
    return getSnapshot();
  });
  const history = {};
  const services = {
    contacts: {
      network: { id: 'test' },
      store: {
        subscribe,
        getRevision: () => revision,
        list: jest.fn(() => {
          if (failed) throw new Error('unavailable');
          return contacts;
        }),
      },
    },
    ledgerReadRuntime: { subscribe: () => () => {}, getSnapshot: () => ({ foreground: true }) },
    ledgerReadInvalidation: { subscribe: () => () => {}, getRevision: () => 0 },
    history,
    transactionRecovery: { reconcile: jest.fn() },
  } as unknown as AppServices;
  const navigation = { navigate: jest.fn() };
  const render = (accounts = [account], selectedAccountId = account.id) => {
    const tree = ActivityStackNavigator({ accounts, selectedAccountId, services });
    const route = React.Children.toArray(tree.props.children).find(
      child => React.isValidElement<RouteProps>(child) && child.props.name === 'activity',
    ) as React.ReactElement<RouteProps>;
    return route.props.children({ navigation });
  };
  const update = () => {
    revision += 1;
    dirty = false;
    listeners.forEach(listener => listener());
    expect(dirty).toBe(true);
  };
  const initial = render();
  expect(subscribe).toHaveBeenCalledTimes(1);
  expect(initial.props.identityNames?.get('GLOCAL')).toBe('Alice');
  contacts = [{ ...contacts[0], name: 'Bob' }];
  update();
  expect(render().props.identityNames?.get('GLOCAL')).toBe('Bob');
  contacts = [];
  update();
  expect(render().props.identityNames?.get('GLOCAL')).toBe('Local');
  contacts = [{ id: 'c', networkId: 'test', address: 'GLOCAL', name: 'Bob' }];
  failed = true;
  update();
  const failure = render();
  expect(failure.props.identityNames?.get('GLOCAL')).toBe('Local');
  expect(failure.props.dependencies).toBe(history);
  expect(failure.props.invalidationRevision).toBe(initial.props.invalidationRevision);
  failure.props.onOpenOperation('exact-op');
  expect(navigation.navigate).toHaveBeenCalledWith('operation-details', { accountId: 'a', operationId: 'exact-op' });
  failed = false;
  const foreign = { ...account, id: 'other', networkId: 'main', label: 'Main local' };
  const switched = render([account, foreign], foreign.id);
  // Contacts are global, but the selected account and history route remain network-scoped.
  expect(switched.props.identityNames?.get('GLOCAL')).toBe('Bob');
  expect(switched.props.account.id).toBe(foreign.id);
  expect(switched.props.account.networkId).toBe('main');
  expect(switched.props.dependencies).toBe(history);
  switched.props.onOpenOperation('main-op');
  expect(navigation.navigate).toHaveBeenCalledWith('operation-details', {
    accountId: foreign.id,
    operationId: 'main-op',
  });
});
