import React from 'react';
import type { AccountRecord } from '../../../capabilities/account/types';
import {
  createClaimableProduct,
  type ClaimableCacheStore,
  type ClaimableProduct,
  type ClaimableReadPort,
} from '../../../capabilities/claimable/createClaimableProduct';
import { mapClaimableRecord, type ClaimableSnapshot } from '../../../capabilities/claimable/records';
import { HomeScreen } from '../../../features/home/HomeScreen';
import { ContractAssetsPanel } from '../../../features/assets/ContractAssetsPanel';
import type { ContractAssets } from '@capabilities/assets/contractAssets';
import { AssetCategoryDialog } from '../../../features/home/components/AssetCategoryDialog';
import type { AppServices } from '../../createAppServices';
import { createLedgerReadInvalidationStore } from '../../readModels/LedgerReadInvalidationStore';
import { HomeStackNavigator } from '../HomeStackNavigator';

type Slot = {
  value?: unknown;
  deps?: readonly unknown[];
  cleanup?: () => void;
  update?: (next: unknown) => void;
};
type HookHost = {
  slots: Slot[];
  cursor: number;
  effects: Array<() => void>;
  changed: boolean;
  mounted: boolean;
};
let mockHost: HookHost;
const mockHosts: HookHost[] = [];

// Execute only the actual composition components. State, memoized callbacks
// and effect cleanups retain their normal lifetime across explicit renders.
jest.mock('react', () => ({
  ...jest.requireActual('react'),
  useState: (initial: unknown) => {
    const host = mockHost;
    const index = host.cursor++;
    if (!host.slots[index]) {
      const slot: Slot = { value: typeof initial === 'function' ? initial() : initial };
      slot.update = next => {
        if (!host.mounted) return;
        const value = typeof next === 'function' ? next(slot.value) : next;
        if (!Object.is(value, slot.value)) {
          slot.value = value;
          host.changed = true;
        }
      };
      host.slots[index] = slot;
    }
    const slot = host.slots[index];
    return [slot.value, slot.update];
  },
  useRef: (initial: unknown) => {
    const index = mockHost.cursor++;
    mockHost.slots[index] ??= { value: { current: initial } };
    return mockHost.slots[index].value;
  },
  useCallback: (callback: unknown, deps: readonly unknown[]) => {
    const index = mockHost.cursor++;
    if (!mockHost.slots[index]?.deps?.every((value, i) => Object.is(value, deps[i]))) {
      mockHost.slots[index] = { value: callback, deps };
    }
    return mockHost.slots[index].value;
  },
  useEffect: (effect: () => void | (() => void), deps: readonly unknown[]) => {
    const host = mockHost;
    const index = host.cursor++;
    const previous = host.slots[index];
    if (previous?.deps?.every((value, i) => Object.is(value, deps[i]))) return;
    const slot: Slot = { deps };
    host.slots[index] = slot;
    host.effects.push(() => {
      previous?.cleanup?.();
      const cleanup = effect();
      slot.cleanup = typeof cleanup === 'function' ? cleanup : undefined;
    });
  },
  useSyncExternalStore: (_subscribe: unknown, snapshot: () => unknown) => snapshot(),
}));
jest.mock('@react-navigation/native', () => ({ useIsFocused: () => true, useFocusEffect: jest.fn() }));
jest.mock('@react-navigation/native-stack', () => ({
  createNativeStackNavigator: () => ({ Navigator: 'TestNavigator', Screen: 'TestScreen' }),
}));
jest.mock('@fresnica/ui-native', () => ({ Button: () => null, StateView: () => null }));
jest.mock('@ui/components', () => ({ Screen: () => null, StateView: () => null }));
jest.mock('@ui/theme', () => ({ useAppTheme: () => jest.requireActual('@ui/theme').defaultTheme }));
jest.mock('@features/accounts/AddAccountScreen', () => ({ AddAccountScreen: () => null }));
jest.mock('@features/trustlines/AddAssetSheet', () => ({ AddAssetSheet: () => null }));
jest.mock('@features/trustlines/ManageAssetsScreen', () => ({ ManageAssetsScreen: () => null }));
jest.mock('@features/home/AssetDetailsSheet', () => ({ AssetDetailsSheet: () => null }));
jest.mock('@features/home/AssetDetailsScreen', () => ({ AssetDetailsScreen: () => null }));
jest.mock('@features/home/HomeScreen', () => ({ HomeScreen: () => null }));
jest.mock('@features/home/components/AssetCategoryDialog', () => ({ AssetCategoryDialog: () => null }));
jest.mock('@features/send/SendFlowScreen', () => ({ SendFlowScreen: () => null }));
jest.mock('@features/request/RequestFlowScreen', () => ({ RequestFlowScreen: () => null }));
jest.mock('@features/swap/SwapPreviewScreen', () => ({
  SwapPreviewScreen: () => null,
  SwapUnavailableScreen: () => null,
}));
jest.mock('@platform/system/RequestQrScannerView', () => ({ ReactNativeRequestQrScannerView: () => null }));
jest.mock('@platform/system/requestIngress', () => ({ reactNativeRequestIngress: {} }));

const network = { id: 'stellar-testnet', networkPassphrase: 'Test SDF Network ; September 2015' };
const account: AccountRecord = {
  id: 'account-A',
  address: 'G' + 'A'.repeat(55),
  networkId: network.id,
  identityKind: 'classic',
  label: 'A',
  hidden: false,
  sortOrder: 0,
  createdAt: new Date(0),
  updatedAt: new Date(0),
};
const accounts = [account];

function host(): HookHost {
  const value: HookHost = { slots: [], cursor: 0, effects: [], changed: false, mounted: true };
  mockHosts.push(value);
  return value;
}

function render<T>(target: HookHost, component: () => T): T {
  for (let pass = 0; pass < 10; pass += 1) {
    mockHost = target;
    target.cursor = 0;
    target.changed = false;
    const result = component();
    const effects = target.effects.splice(0);
    effects.forEach(effect => effect());
    if (!target.changed) return result;
  }
  throw new Error('composition-did-not-settle');
}

function claim(hex = 'a') {
  return mapClaimableRecord(
    {
      id: '00000000' + hex.repeat(64),
      asset: 'native',
      amount: '2.0000000',
      sponsor: 'G' + 'B'.repeat(55),
      claimants: [{ destination: account.address, predicate: { unconditional: true } }],
    },
    account.address,
  );
}

function deferredPage() {
  let resolve!: (value: Awaited<ReturnType<ClaimableReadPort['page']>>) => void;
  const promise = new Promise<Awaited<ReturnType<ClaimableReadPort['page']>>>(done => {
    resolve = done;
  });
  return { promise, resolve };
}

async function settle() {
  for (let i = 0; i < 20; i += 1) await Promise.resolve();
}

type Tree = React.ReactElement<{ children?: React.ReactNode }>;
function child<P>(tree: Tree, component: unknown): React.ReactElement<P> {
  const found = React.Children.toArray(tree.props.children).find(
    item => React.isValidElement(item) && item.type === component,
  );
  if (!React.isValidElement<P>(found)) throw new Error('missing-home-child');
  return found;
}

function fixture(seedEmpty = true) {
  const clock = Date.now();
  const invalidation = createLedgerReadInvalidationStore();
  let saved: ClaimableSnapshot | undefined = seedEmpty
    ? { networkId: network.id, address: account.address, savedAt: clock - 1_000, records: [], everSeen: false }
    : undefined;
  const replace = jest.fn((snapshot: ClaimableSnapshot) => {
    saved = snapshot;
  });
  const cache: ClaimableCacheStore = {
    read: (networkId, address) => (networkId === network.id && address === account.address ? saved : undefined),
    replace,
    userSpam: () => undefined,
    setUserSpam: () => undefined,
    clearPartition: () => { saved = undefined; },
  };
  const page = jest
    .fn<ReturnType<ClaimableReadPort['page']>, Parameters<ClaimableReadPort['page']>>()
    .mockResolvedValue({ records: [] });
  const createProduct = (readPage = page) =>
    createClaimableProduct({
      networkId: network.id,
      cache,
      read: { page: readPage, byId: async () => undefined },
      now: () => clock,
      getRevision: target => invalidation.getRevision(target.networkId, target.id),
    });
  const product = createProduct();
  let selectionRevision = 1;
  const services = {
    contractAssets: undefined as ContractAssets | undefined,
    onboarding: { repository: { isWatchOnly: () => false } },
    ledgerReadRuntime: { subscribe: jest.fn(), getSnapshot: () => ({ foreground: true }) },
    ledgerReadInvalidation: invalidation,
    networkSettings: { getSnapshot: () => ({ preferences: { developerMode: false } }) },
    transactionRecovery: { reconcile: jest.fn() },
    claimables: product,
    claimableTransaction: {},
    send: { network },
    trustline: { network },
  };
  const props = {
    accounts,
    selectedAccountId: account.id,
    selectableAccounts: accounts,
    services: services as unknown as AppServices,
    swapEnabled: false,
    onAccountsChanged: jest.fn(),
    onCreatedAccountReady: jest.fn(),
    onSelectAccount: jest.fn(),
    getCurrentSwapSelection: () => ({ selectedAccountId: account.id, selectionRevision, accounts, network }),
    subscribeToSwapSelection: () => () => undefined,
  };
  const navigation = { isFocused: () => true, navigate: jest.fn() };
  const stackHost = host();
  const homeHost = host();
  function renderHome() {
    const stack = render(stackHost, () => HomeStackNavigator(props));
    const homeRoute = React.Children.toArray(stack.props.children).find(
      item => React.isValidElement<{ name: string }>(item) && item.props.name === 'home',
    ) as React.ReactElement<{ children: (input: { navigation: typeof navigation }) => Tree }>;
    const route = homeRoute.props.children({ navigation });
    const wrapper = React.Children.toArray(route.props.children).find(React.isValidElement) as React.ReactElement;
    const renderWrapper = wrapper.type as (input: unknown) => Tree;
    const tree = render(homeHost, () => renderWrapper(wrapper.props));
    return {
      home: child<React.ComponentProps<typeof HomeScreen>>(tree, HomeScreen).props,
      categories: child<React.ComponentProps<typeof AssetCategoryDialog>>(tree, AssetCategoryDialog).props,
    };
  }
  return {
    page,
    product,
    replace,
    createProduct,
    renderHome,
    setContractProduct: (product: ContractAssets) => { services.contractAssets = product; },
    changeSelectionRevision: () => { selectionRevision += 1; },
    replaceProduct: (next: ClaimableProduct) => {
      services.claimables = next;
    },
    invalidate: () => invalidation.refresh({ networkId: network.id, accountId: account.id, reason: 'account-effects' }),
  };
}

afterEach(() => {
  for (const current of mockHosts.splice(0)) {
    current.mounted = false;
    current.slots.forEach(slot => slot.cleanup?.());
  }
});

describe('Home first Claimable discovery from ledger invalidation', () => {
  it('reveals the category inside an empty cache TTL with Developer Mode off and no unrelated prop change', async () => {
    const f = fixture();
    f.page.mockResolvedValue({ records: [claim()] });
    const initial = f.renderHome();
    await settle();
    expect(initial.categories.showClaimable).toBe(false);
    expect(initial.home.onShowClaimable).toBeUndefined();
    expect(f.page).not.toHaveBeenCalled();
    f.renderHome();
    expect(f.page).not.toHaveBeenCalled();

    f.invalidate();
    const loading = f.renderHome();
    expect(loading.categories.showClaimable).toBe(false);
    expect(f.page).toHaveBeenCalledTimes(1);
    await settle();
    const discovered = f.renderHome();
    expect(discovered.categories.showClaimable).toBe(true);
    expect(discovered.home.onShowClaimable).toEqual(expect.any(Function));
    expect(discovered.home.claimableNowCount).toBe(1);
    expect(f.product.readCached(account)?.stale).toBe(false);
    f.renderHome();
    f.renderHome();
    await settle();
    expect(f.page).toHaveBeenCalledTimes(1);
    expect(f.replace).toHaveBeenCalledTimes(1);
  });

  it('retires an in-flight older revision before publishing or caching the newly discovered category', async () => {
    const f = fixture(false);
    const old = deferredPage();
    const latest = deferredPage();
    f.page.mockReturnValueOnce(old.promise).mockReturnValueOnce(latest.promise);
    f.renderHome();
    f.invalidate();
    f.renderHome();
    expect(f.page).toHaveBeenCalledTimes(1);
    old.resolve({ records: [claim('a'), claim('b')] });
    await settle();
    expect(f.page).toHaveBeenCalledTimes(2);
    expect(f.replace).not.toHaveBeenCalled();
    expect(f.renderHome().categories.showClaimable).toBe(false);
    latest.resolve({ records: [claim('c')] });
    await settle();
    const discovered = f.renderHome();
    expect(discovered.categories.showClaimable).toBe(true);
    expect(discovered.home.claimableNowCount).toBe(1);
    expect(f.replace).toHaveBeenCalledTimes(1);
    expect(f.product.readCached(account)?.snapshot.records.map(row => row.id)).toEqual([claim('c').id]);
  });

  it('does not let an old service response overwrite the replacement Home session', async () => {
    const f = fixture(false);
    const old = deferredPage();
    f.page.mockReturnValueOnce(old.promise);
    f.renderHome();
    f.product.close();
    const page = jest
      .fn<ReturnType<ClaimableReadPort['page']>, Parameters<ClaimableReadPort['page']>>()
      .mockResolvedValue({ records: [claim('c')] });
    const replacement = f.createProduct(page);
    f.replaceProduct(replacement);
    f.renderHome();
    await settle();
    expect(f.renderHome().home.claimableNowCount).toBe(1);
    old.resolve({ records: [] });
    await settle();
    const current = f.renderHome();
    expect(current.categories.showClaimable).toBe(true);
    expect(current.home.claimableNowCount).toBe(1);
    expect(f.replace).toHaveBeenCalledTimes(1);
    expect(replacement.readCached(account)?.snapshot.records.map(row => row.id)).toEqual([claim('c').id]);
    expect(page).toHaveBeenCalledTimes(1);
  });
});

it('wires the selected contract category and permanently retires old category/selection guards', () => {
  const f = fixture();
  const product: ContractAssets = { network, list: jest.fn(() => []), track: jest.fn(), refresh: jest.fn(), remove: jest.fn() };
  f.setContractProduct(product);
  const initial = f.renderHome();
  expect(initial.categories.showContracts).toBe(true);
  initial.categories.onSelect('contracts');
  const open = f.renderHome();
  expect(open.home.assetCategory).toBe('contracts');
  const panel = open.home.contractsContent as React.ReactElement<React.ComponentProps<typeof ContractAssetsPanel>>;
  expect(panel.type).toBe(ContractAssetsPanel);
  expect(panel.props.account).toEqual(account);
  expect(panel.props.product).toBe(product);
  expect(panel.props.isCurrent()).toBe(true);
  open.categories.onSelect('tokens');
  open.categories.onSelect('contracts');
  expect(panel.props.isCurrent()).toBe(false);
  const next = f.renderHome().home.contractsContent as React.ReactElement<React.ComponentProps<typeof ContractAssetsPanel>>;
  expect(next.props.isCurrent()).toBe(true);
  f.changeSelectionRevision();
  f.changeSelectionRevision();
  expect(next.props.isCurrent()).toBe(false);
});
