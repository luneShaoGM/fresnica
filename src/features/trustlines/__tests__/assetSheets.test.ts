import React from 'react';
import { Pressable, TextInput } from 'react-native';
import type { AccountRecord } from '@capabilities/account/types';
import type { BalanceProductDependencies } from '@capabilities/balance/BalanceCacheHydration';
import { InMemoryBalanceCacheRepository } from '../../../platform/persistence/memory/InMemoryBalanceCacheRepository';
import { AssetDetailsSheet } from '../../home/AssetDetailsSheet';
import type { BalanceDisplayState } from '../../home/balanceReadModel';
import { useBalanceDisplay } from '../../home/useBalanceDisplay';
import { ManageAssetsScreen } from '../ManageAssetsScreen';
import { prepareTrustlineProductReview, type TrustlineProductDependencies } from '../trustlineProductFlow';
import type { TrustlineReview } from '@capabilities/trustline/buildTrustlineReview';
import { AddAssetSheet } from '../AddAssetSheet';

type Slot = { value?: unknown; deps?: readonly unknown[]; cleanup?: () => void };
let mockSlots: Slot[] = [];
let mockCursor = 0;
let mockEffects: Array<() => void> = [];
jest.mock('react', () => ({
  ...jest.requireActual('react'),
  useCallback: (fn: unknown) => fn,
  useState: (initial: unknown) => {
    const i = mockCursor++;
    if (!mockSlots[i]) mockSlots[i] = { value: initial };
    return [
      mockSlots[i].value,
      (next: unknown) => {
        mockSlots[i].value = typeof next === 'function' ? next(mockSlots[i].value) : next;
      },
    ];
  },
  useRef: (initial: unknown) => {
    const i = mockCursor++;
    if (!mockSlots[i]) mockSlots[i] = { value: { current: initial } };
    return mockSlots[i].value;
  },
  useEffect: (effect: () => (() => void) | undefined, deps: readonly unknown[]) => {
    const i = mockCursor++;
    if (mockSlots[i]?.deps?.every((value, index) => Object.is(value, deps[index]))) return;
    const previous = mockSlots[i]?.cleanup;
    mockSlots[i] = { deps };
    mockEffects.push(() => {
      previous?.();
      mockSlots[i].cleanup = effect();
    });
  },
}));
jest.mock('@react-navigation/native', () => ({ useIsFocused: () => true }));
jest.mock('../trustlineProductFlow', () => ({
  prepareTrustlineProductReview: jest.fn(),
  submitTrustlineProductReview: jest.fn(),
}));
jest.mock('@capabilities/balance/loadBalanceSnapshot', () => ({
  loadBalanceSnapshot: jest.fn(async () => ({ status: 'inactive' })),
}));
jest.mock('@fresnica/ui-native', () => ({ Button: () => null }));
jest.mock('@ui/theme', () => {
  const actual = jest.requireActual('@ui/theme');
  return {
    ...actual,
    useAppTheme: () => actual.defaultTheme,
    useThemedStyles: (factory: (theme: unknown) => unknown) => factory(actual.defaultTheme),
  };
});
jest.mock('../../../locale', () => ({ useLocalization: () => ({ t: (key: string) => key }) }));
jest.mock('../../home/useBalanceDisplay', () => ({ useBalanceDisplay: jest.fn() }));
const display = jest.mocked(useBalanceDisplay);
const issuer = 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN';
const asset = { kind: 'credit' as const, code: 'usd', issuer };
const account: AccountRecord = {
  id: 'a',
  address: 'GA',
  networkId: 'stellar-testnet',
  identityKind: 'classic',
  label: 'A',
  hidden: false,
  sortOrder: 0,
  createdAt: new Date(0),
  updatedAt: new Date(0),
};
const dependencies: BalanceProductDependencies = {
  cache: new InMemoryBalanceCacheRepository(),
  gateway: { loadAccountBalances: jest.fn() },
  networkId: account.networkId,
  now: () => new Date(0),
};
const ready = (balance = '0.0000000', stale = false): BalanceDisplayState => ({
  kind: 'ready',
  snapshot: {
    status: 'active',
    address: account.address,
    balances: [{ asset, balance }],
    hiddenLiquidityPoolShareCount: 0,
  },
  stale,
  refreshing: false,
  refreshFailed: stale,
  lastSuccessfulUpdateAt: new Date(0),
});
type Props = {
  children?: React.ReactNode;
  onPress?: () => void;
  onChangeText?: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  canSend?: boolean;
  canRemove?: boolean;
  spendable?: string;
  value?: string;
  canSign?: boolean;
  asset?: { code: string; issuer: string };
  state?: BalanceDisplayState;
};
function find(
  root: React.ReactNode,
  predicate: (node: React.ReactElement<Props>) => boolean,
): React.ReactElement<Props> | undefined {
  if (!React.isValidElement<Props>(root)) return undefined;
  if (predicate(root)) return root;
  let found: React.ReactElement<Props> | undefined;
  React.Children.forEach(root.props.children, child => {
    found ??= find(child, predicate);
  });
  return found;
}
function hasText(root: React.ReactNode, text: string): boolean {
  if (root === text) return true;
  if (!React.isValidElement<Props>(root)) return false;
  return React.Children.toArray(root.props.children).some(child => hasText(child, text));
}
function button(root: React.ReactNode, text: string) {
  const found = find(root, node => node.type === Pressable && hasText(node, text));
  if (!found) throw new Error(`missing-button:${text}`);
  return found;
}
function render<T>(fn: () => T): T {
  mockCursor = 0;
  return fn();
}
function effects() {
  const pending = mockEffects;
  mockEffects = [];
  pending.forEach(effect => effect());
}
async function settle() {
  for (let i = 0; i < 15; i++) await Promise.resolve();
}
beforeEach(() => {
  mockSlots = [];
  mockCursor = 0;
  mockEffects = [];
  display.mockReturnValue({ state: ready(), refresh: jest.fn() });
});
afterEach(() => mockSlots.forEach(slot => slot.cleanup?.()));

describe('asset sheet current balance integration', () => {
  it('passes the lifecycle and invalidation inputs and disables actions for stale/error/watch-only details', () => {
    const props = {
      account,
      asset,
      balanceDependencies: dependencies,
      active: true,
      invalidationRevision: 7,
      visible: true,
      canSign: true,
      copyPublicText: jest.fn(async () => undefined),
      onClose: jest.fn(),
      onSend: jest.fn(),
      onRemove: jest.fn(),
    };
    const issued = (root: React.ReactNode) =>
      find(root, node => typeof node.type === 'function' && node.type.name === 'IssuedAsset');
    let root = render(() => AssetDetailsSheet(props));
    expect(display).toHaveBeenLastCalledWith(account, dependencies, true, 7);
    expect(issued(root)?.props).toMatchObject({ canSend: false, canRemove: true });
    display.mockReturnValue({ state: ready('1.0000000', true), refresh: jest.fn() });
    root = render(() => AssetDetailsSheet(props));
    expect(issued(root)?.props).toMatchObject({ canSend: false, canRemove: false });
    display.mockReturnValue({ state: ready('1.0000000'), refresh: jest.fn() });
    expect(issued(render(() => AssetDetailsSheet({ ...props, canSign: false })))?.props.canSend).toBe(false);
    render(() => AssetDetailsSheet({ ...props, active: false }));
    expect(display).toHaveBeenLastCalledWith(account, dependencies, false, 7);
    const refresh = jest.fn();
    display.mockReturnValue({ state: { kind: 'error', message: 'offline' }, refresh });
    root = render(() => AssetDetailsSheet(props));
    expect(issued(root)).toBeUndefined();
    button(root, 'trustlines.add.retry').props.onPress?.();
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('preserves manual code case and blocks held or stale assets before Trustline review', () => {
    const onAddAndSign = jest.fn();
    const catalog = { read: jest.fn() };
    const props = {
      account,
      balanceDependencies: dependencies,
      catalog,
      active: true,
      visible: true,
      invalidationRevision: 3,
      onClose: jest.fn(),
      onAddAndSign,
    };
    const show = () => render(() => AddAssetSheet(props));
    let root = show();
    effects();
    find(
      root,
      node => node.type === TextInput && node.props.placeholder === 'trustlines.add.assetCodePlaceholder',
    )?.props.onChangeText?.('Usd');
    find(
      root,
      node => node.type === TextInput && node.props.placeholder === 'trustlines.add.issuerPlaceholder',
    )?.props.onChangeText?.(issuer);
    root = show();
    expect(button(root, 'trustlines.add.addAndSign').props.disabled).toBe(false);
    button(root, 'trustlines.add.addAndSign').props.onPress?.();
    expect(onAddAndSign).toHaveBeenCalledWith({ code: 'Usd', issuer });
    find(
      root,
      node => node.type === TextInput && node.props.placeholder === 'trustlines.add.assetCodePlaceholder',
    )?.props.onChangeText?.('usd');
    expect(button(show(), 'trustlines.add.addAndSign').props.disabled).toBe(true);
    display.mockReturnValue({ state: ready('0', true), refresh: jest.fn() });
    expect(button(show(), 'trustlines.add.addAndSign').props.disabled).toBe(true);
    expect(catalog.read).not.toHaveBeenCalled();
  });

  it('aborts manual metadata loading on dismissal and ignores late completion', async () => {
    let resolve!: (body: string) => void;
    const read = jest.fn(
      (_url: string, _signal: AbortSignal) =>
        new Promise<string>(done => {
          resolve = done;
        }),
    );
    const props = {
      account,
      balanceDependencies: dependencies,
      catalog: { read },
      active: true,
      visible: true,
      invalidationRevision: 0,
      onClose: jest.fn(),
      onAddAndSign: jest.fn(),
    };
    let root = render(() => AddAssetSheet(props));
    effects();
    find(
      root,
      node => node.type === TextInput && node.props.placeholder === 'https://example.com',
    )?.props.onChangeText?.('example.com');
    root = render(() => AddAssetSheet(props));
    button(root, 'trustlines.add.load').props.onPress?.();
    expect(read).toHaveBeenCalledTimes(1);
    render(() => AddAssetSheet({ ...props, visible: false }));
    effects();
    expect(read.mock.calls[0][1].aborted).toBe(true);
    resolve(JSON.stringify([{ code: 'BTC', issuer }]));
    await settle();
    root = render(() => AddAssetSheet({ ...props, visible: false }));
    const code = find(
      root,
      node => node.type === TextInput && node.props.placeholder === 'trustlines.add.assetCodePlaceholder',
    );
    expect(code?.props.value).toBe('');
    expect(read).toHaveBeenCalledTimes(1);
  });
});

describe('sheet-to-Trustline review lifecycle', () => {
  const review = {
    operation: 'add',
    asset: { code: 'usd', issuer },
    source: account.address,
    networkId: account.networkId,
    fee: '100',
    transactionXdrBase64: 'AAAA',
    limit: '100',
  } as TrustlineReview;
  const requestedAdd = { code: 'usd', issuer };
  function props() {
    return {
      account,
      dependencies: { network: { id: account.networkId }, gateway: {} } as unknown as TrustlineProductDependencies,
      balanceDependencies: dependencies,
      catalog: { read: jest.fn() },
      foreground: true,
      invalidationRevision: 0,
      requestedAdd,
      onReviewDismiss: jest.fn(),
      onDone: jest.fn(),
    };
  }
  it('does not revive a dismissed preparation when the review arrives late', async () => {
    let resolve!: (value: TrustlineReview) => void;
    jest.mocked(prepareTrustlineProductReview).mockReturnValueOnce(
      new Promise(done => {
        resolve = done;
      }),
    );
    const current = props();
    const root = render(() => ManageAssetsScreen(current));
    effects();
    root.props.onBack();
    expect(current.onReviewDismiss).toHaveBeenCalledTimes(1);
    resolve(review);
    await settle();
    expect(render(() => ManageAssetsScreen(current)).type).toBe(root.type);
  });
  it('offers retry after a requested preparation fails and reaches the existing review', async () => {
    jest
      .mocked(prepareTrustlineProductReview)
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(review);
    const current = props();
    const first = render(() => ManageAssetsScreen(current));
    effects();
    await settle();
    const failed = render(() => ManageAssetsScreen(current));
    expect(failed.props.onAction).toBeDefined();
    failed.props.onAction();
    await settle();
    expect(render(() => ManageAssetsScreen(current)).type).not.toBe(first.type);
    expect(prepareTrustlineProductReview).toHaveBeenLastCalledWith(current.dependencies, account, {
      action: 'add',
      asset: requestedAdd,
    });
  });
  it('invalidates preparation across backgrounding and requires a fresh retry', async () => {
    let resolve!: (value: TrustlineReview) => void;
    jest.mocked(prepareTrustlineProductReview).mockReturnValueOnce(
      new Promise(done => {
        resolve = done;
      }),
    );
    const current = props();
    const first = render(() => ManageAssetsScreen(current));
    effects();
    render(() => ManageAssetsScreen({ ...current, foreground: false }));
    effects();
    resolve(review);
    await settle();
    const resumed = render(() => ManageAssetsScreen(current));
    effects();
    expect(resumed.type).toBe(first.type);
    expect(resumed.props.onAction).toBeDefined();
  });
});

it('loads the well-known TOML when a domain homepage fails', async () => {
  const read = jest
    .fn()
    .mockRejectedValueOnce(new Error('homepage-404'))
    .mockResolvedValueOnce(`[[CURRENCIES]]\ncode="EUR"\nissuer="${issuer}"`);
  const props = {
    account,
    balanceDependencies: dependencies,
    catalog: { read },
    active: true,
    visible: true,
    invalidationRevision: 0,
    onClose: jest.fn(),
    onAddAndSign: jest.fn(),
  };
  let root = render(() => AddAssetSheet(props));
  effects();
  find(root, node => node.type === TextInput && node.props.placeholder === 'https://example.com')?.props.onChangeText?.(
    'example.com',
  );
  root = render(() => AddAssetSheet(props));
  button(root, 'trustlines.add.load').props.onPress?.();
  await settle();
  expect(read.mock.calls.map(call => call[0])).toEqual([
    'https://example.com/',
    'https://example.com/.well-known/stellar.toml',
  ]);
  root = render(() => AddAssetSheet(props));
  const code = find(
    root,
    node => node.type === TextInput && node.props.placeholder === 'trustlines.add.assetCodePlaceholder',
  );
  expect(code?.props.value).toBe('EUR');
  expect(button(root, 'trustlines.add.addAndSign').props.disabled).toBe(false);
});

it('cannot submit an auto-selected catalog asset hidden by search', async () => {
  const onAddAndSign = jest.fn();
  const read = jest.fn(async () =>
    JSON.stringify([
      { code: 'BTC', issuer },
      { code: 'ETH', issuer },
    ]),
  );
  const props = {
    account: { ...account, networkId: 'stellar-mainnet' },
    balanceDependencies: { ...dependencies, networkId: 'stellar-mainnet' },
    catalog: { read },
    active: true,
    visible: true,
    invalidationRevision: 0,
    onClose: jest.fn(),
    onAddAndSign,
  };
  render(() => AddAssetSheet(props));
  effects();
  await settle();
  let root = render(() => AddAssetSheet(props));
  expect(button(root, 'trustlines.add.addAndSign').props.disabled).toBe(false);
  find(
    root,
    node => node.type === TextInput && node.props.placeholder === 'trustlines.add.search',
  )?.props.onChangeText?.('no-matches');
  root = render(() => AddAssetSheet(props));
  expect(button(root, 'trustlines.add.addAndSign').props.disabled).toBe(true);
  button(root, 'trustlines.add.addAndSign').props.onPress?.();
  expect(onAddAndSign).not.toHaveBeenCalled();
  find(
    root,
    node => node.type === TextInput && node.props.placeholder === 'trustlines.add.search',
  )?.props.onChangeText?.('ETH');
  root = render(() => AddAssetSheet(props));
  expect(button(root, 'trustlines.add.addAndSign').props.disabled).toBe(true);
  find(root, node => node.props.asset?.code === 'ETH')?.props.onPress?.();
  root = render(() => AddAssetSheet(props));
  expect(button(root, 'trustlines.add.addAndSign').props.disabled).toBe(false);
  button(root, 'trustlines.add.addAndSign').props.onPress?.();
  expect(onAddAndSign).toHaveBeenCalledWith({ code: 'ETH', issuer });
});
