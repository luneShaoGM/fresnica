import React from 'react';
import { AppState, FlatList, Pressable, ScrollView, TextInput, type AppStateStatus } from 'react-native';
import type { AccountRecord } from '@capabilities/account/types';
import type { BalanceProductDependencies } from '@capabilities/balance/BalanceCacheHydration';
import { InMemoryBalanceCacheRepository } from '../../../platform/persistence/memory/InMemoryBalanceCacheRepository';
import { AssetDetailsSheet } from '../../home/AssetDetailsSheet';
import type { BalanceDisplayState } from '../../home/balanceReadModel';
import { useBalanceDisplay } from '../../home/useBalanceDisplay';
import { ManageAssetsScreen } from '../ManageAssetsScreen';
import {
  prepareTrustlineProductReview,
  submitTrustlineProductReview,
  type TrustlineProductDependencies,
  type TrustlineSubmissionResult,
} from '../trustlineProductFlow';
import type { TrustlineReview } from '@capabilities/trustline/buildTrustlineReview';
import { AddAssetSheet } from '../AddAssetSheet';
import {
  PassphraseInput,
  createTransientPassphraseBuffer,
  type PassphraseInputHandle,
} from '@ui/components/PassphraseInput';
import { SlideToConfirm } from '../../../ui/SlideToConfirm';
import { captureAccountRouteSession, type SwapCurrentSelection } from '../../../app/navigation/swapCurrentSession';

type Slot = { value?: unknown; deps?: readonly unknown[]; cleanup?: () => void };
let mockSlots: Slot[] = [];
let mockCursor = 0;
let mockEffects: Array<() => void> = [];
let mockFocused = true;
let mockBlur: (() => void) | undefined;
jest.mock('react', () => ({
  ...jest.requireActual('react'),
  useCallback: (fn: unknown, deps: readonly unknown[]) => {
    const i = mockCursor++;
    if (!mockSlots[i]?.deps?.every((value, index) => Object.is(value, deps[index]))) {
      mockSlots[i] = { value: fn, deps };
    }
    return mockSlots[i].value;
  },
  useMemo: (factory: () => unknown) => factory(),
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
jest.mock('@react-navigation/native', () => ({
  useIsFocused: () => mockFocused,
  useFocusEffect: (effect: () => () => void) => {
    if (mockFocused && !mockBlur) mockBlur = effect();
  },
}));
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
    balances: [{ asset, balance, buyingLiabilities: '0', sellingLiabilities: '0', isAuthorized: true }],
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
  onComplete?: () => void;
  onPresenceChange?: (present: boolean) => void;
  ref?: { current: PassphraseInputHandle | null };
  placeholder?: string;
  disabled?: boolean;
  canSend?: boolean;
  canRemove?: boolean;
  spendable?: string;
  value?: string;
  canSign?: boolean;
  asset?: { code: string; issuer: string };
  state?: BalanceDisplayState;
  ListHeaderComponent?: React.ReactNode;
  ListFooterComponent?: React.ReactNode;
  ListEmptyComponent?: React.ReactNode;
  data?: readonly { code: string; issuer: string }[];
  renderItem?: (info: { item: { code: string; issuer: string }; index: number }) => React.ReactNode;
};
function children(root: React.ReactElement<Props>): React.ReactNode[] {
  if (root.type !== FlatList) return React.Children.toArray(root.props.children);
  const data = root.props.data ?? [];
  return [
    root.props.ListHeaderComponent,
    ...(data.length > 0
      ? data.map((item, index) => root.props.renderItem?.({ item, index }))
      : [root.props.ListEmptyComponent]),
    root.props.ListFooterComponent,
  ];
}
function find(
  root: React.ReactNode,
  predicate: (node: React.ReactElement<Props>) => boolean,
): React.ReactElement<Props> | undefined {
  if (!React.isValidElement<Props>(root)) return undefined;
  if (predicate(root)) return root;
  let found: React.ReactElement<Props> | undefined;
  children(root).forEach(child => {
    found ??= find(child, predicate);
  });
  return found;
}
function hasText(root: React.ReactNode, text: string): boolean {
  if (root === text) return true;
  if (!React.isValidElement<Props>(root)) return false;
  return children(root).some(child => hasText(child, text));
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
  mockFocused = true;
  mockBlur = undefined;
  pending.forEach(effect => effect());
}
async function settle() {
  for (let i = 0; i < 15; i++) await Promise.resolve();
}
beforeEach(() => {
  mockSlots = [];
  mockCursor = 0;
  mockEffects = [];
  display.mockReturnValue({ hasFreshInactiveSnapshot: () => false, state: ready(), refresh: jest.fn() });
});
afterEach(() => {
  mockBlur?.();
  mockSlots.forEach(slot => slot.cleanup?.());
  jest.restoreAllMocks();
});

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
    display.mockReturnValue({
      hasFreshInactiveSnapshot: () => false,
      state: ready('1.0000000', true),
      refresh: jest.fn(),
    });
    root = render(() => AssetDetailsSheet(props));
    expect(issued(root)?.props).toMatchObject({ canSend: false, canRemove: false });
    display.mockReturnValue({ hasFreshInactiveSnapshot: () => false, state: ready('1.0000000'), refresh: jest.fn() });
    expect(issued(render(() => AssetDetailsSheet({ ...props, canSign: false })))?.props.canSend).toBe(false);
    render(() => AssetDetailsSheet({ ...props, active: false }));
    expect(display).toHaveBeenLastCalledWith(account, dependencies, false, 7);
    const refresh = jest.fn();
    display.mockReturnValue({
      hasFreshInactiveSnapshot: () => false,
      state: { kind: 'error', message: 'offline' },
      refresh,
    });
    root = render(() => AssetDetailsSheet(props));
    expect(issued(root)).toBeUndefined();
    button(root, 'trustlines.add.retry').props.onPress?.();
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('keeps add-asset controls in one scroll region while the submit footer stays outside it', () => {
    const props = {
      account: { ...account, networkId: 'stellar-mainnet' },
      balanceDependencies: { ...dependencies, networkId: 'stellar-mainnet' },
      catalog: { read: jest.fn() },
      active: true,
      visible: true,
      invalidationRevision: 0,
      onClose: jest.fn(),
      onAddAndSign: jest.fn(),
    };
    let root = render(() => AddAssetSheet(props));
    let list = find(root, node => node.type === FlatList);
    expect(list).toBeDefined();
    expect(hasText(list?.props.ListHeaderComponent, 'trustlines.add.title')).toBe(true);
    expect(hasText(list?.props.ListHeaderComponent, 'trustlines.add.listDescription')).toBe(true);
    expect(
      find(list?.props.ListHeaderComponent, node => node.props.placeholder === 'trustlines.add.search'),
    ).toBeDefined();
    expect(find(root, node => node.type === ScrollView)).toBeUndefined();
    expect(hasText(list, 'trustlines.add.addAndSign')).toBe(false);
    expect(button(root, 'trustlines.add.addAndSign')).toBeDefined();

    button(root, 'trustlines.add.manual').props.onPress?.();
    root = render(() => AddAssetSheet(props));
    list = find(root, node => node.type === FlatList);
    expect(hasText(list?.props.ListHeaderComponent, 'trustlines.add.manualDescription')).toBe(true);
    expect(find(list?.props.ListHeaderComponent, node => node.props.placeholder === 'https://example.com')).toBeDefined();
    expect(
      find(list?.props.ListFooterComponent, node => node.props.placeholder === 'trustlines.add.assetCodePlaceholder'),
    ).toBeDefined();
    expect(
      find(list?.props.ListFooterComponent, node => node.props.placeholder === 'trustlines.add.issuerPlaceholder'),
    ).toBeDefined();
    expect(find(root, node => node.type === ScrollView)).toBeUndefined();
    expect(hasText(list, 'trustlines.add.addAndSign')).toBe(false);
    expect(button(root, 'trustlines.add.addAndSign').props.disabled).toBe(true);
  });

  it('lets Testnet open the unconfigured list without reading Mainnet sources, then return to Manual', () => {
    const read = jest.fn();
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
    expect(button(root, 'trustlines.add.list').props.disabled).not.toBe(true);
    button(root, 'trustlines.add.list').props.onPress?.();
    root = render(() => AddAssetSheet(props));
    expect(hasText(root, 'trustlines.add.networkListUnavailable')).toBe(true);
    expect(button(root, 'trustlines.add.addAndSign').props.disabled).toBe(true);
    expect(read).not.toHaveBeenCalled();
    button(root, 'trustlines.add.manual').props.onPress?.();
    root = render(() => AddAssetSheet(props));
    expect(
      find(root, node => node.type === TextInput && node.props.placeholder === 'trustlines.add.assetCodePlaceholder'),
    ).toBeDefined();
  });

  it('hydrates a Mainnet source before a failing refresh, retains manual trustline authorization and retries explicitly', async () => {
    const selected = { code: 'Usd', issuer };
    const readCachedSource = jest.fn((_networkId: string, sourceId: string) =>
      sourceId === 'lobstr' ? { assets: [selected], fromCache: true, stale: true, refreshFailed: false } : undefined,
    );
    const loadSource = jest.fn(async () => {
      throw new Error('offline');
    });
    const read = jest.fn();
    const mainnet = { ...account, networkId: 'stellar-mainnet' };
    const onAddAndSign = jest.fn();
    const props = {
      account: mainnet,
      balanceDependencies: { ...dependencies, networkId: mainnet.networkId },
      catalog: { read, loadSource, readCachedSource },
      active: true,
      visible: true,
      invalidationRevision: 0,
      onClose: jest.fn(),
      onAddAndSign,
    };
    let root = render(() => AddAssetSheet(props));
    effects();
    root = render(() => AddAssetSheet(props));
    expect(hasText(root, 'trustlines.add.cacheRefreshing')).toBe(true);
    expect(readCachedSource).toHaveBeenCalledWith('stellar-mainnet', 'lobstr');
    await settle();
    root = render(() => AddAssetSheet(props));
    expect(hasText(root, 'trustlines.add.cacheRefreshFailed')).toBe(true);
    expect(
      find(
        root,
        node => typeof node.type === 'function' && node.type.name === 'AssetRow' && node.props.asset?.code === 'Usd',
      ),
    ).toBeDefined();
    expect(button(root, 'trustlines.add.addAndSign').props.disabled).toBe(false);
    button(root, 'trustlines.add.addAndSign').props.onPress?.();
    expect(onAddAndSign).toHaveBeenCalledWith(selected);
    expect(read).not.toHaveBeenCalled();
    button(root, 'trustlines.add.retry').props.onPress?.();
    render(() => AddAssetSheet(props));
    effects();
    expect(loadSource).toHaveBeenLastCalledWith('stellar-mainnet', 'stellarexpert', expect.any(AbortSignal), true);
  });

  it('shows partial-source failure without labeling an incomplete result as fully refreshed', async () => {
    const mainnet = { ...account, networkId: 'stellar-mainnet' };
    const source = { code: 'USDC', issuer };
    const loadSource = jest.fn(async (_networkId: string, sourceId: string) => {
      if (sourceId !== 'lobstr') throw new Error('source-offline');
      return { assets: [source], fromCache: false, stale: false, refreshFailed: false };
    });
    const props = {
      account: mainnet,
      balanceDependencies: { ...dependencies, networkId: mainnet.networkId },
      catalog: { read: jest.fn(), loadSource },
      active: true,
      visible: true,
      invalidationRevision: 0,
      onClose: jest.fn(),
      onAddAndSign: jest.fn(),
    };
    render(() => AddAssetSheet(props));
    effects();
    await settle();
    const root = render(() => AddAssetSheet(props));
    expect(hasText(root, 'trustlines.add.partialSourcesFailed')).toBe(true);
    expect(hasText(root, 'trustlines.add.cachedList')).toBe(false);
    expect(button(root, 'trustlines.add.addAndSign').props.disabled).toBe(false);
    expect(loadSource).toHaveBeenCalledTimes(3);
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
    display.mockReturnValue({ hasFreshInactiveSnapshot: () => false, state: ready('0', true), refresh: jest.fn() });
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
      dependencies: {
        network: { id: account.networkId, networkPassphrase: 'Test SDF Network ; September 2015' },
        gateway: {},
      } as unknown as TrustlineProductDependencies,
      balanceDependencies: dependencies,
      catalog: { read: jest.fn() },
      foreground: true,
      selectionRevision: 1,
      captureSession: (focus: () => boolean) => focus,
      invalidationRevision: 0,
      requestedAdd,
      onReviewDismiss: jest.fn(),
      onDone: jest.fn(),
    };
  }
  beforeEach(() => {
    jest.mocked(prepareTrustlineProductReview).mockReset();
    jest.mocked(submitTrustlineProductReview).mockReset();
  });

  async function prepareReview(current = props()) {
    jest.mocked(prepareTrustlineProductReview).mockResolvedValue(review);
    render(() => ManageAssetsScreen(current));
    effects();
    await settle();
    return render(() => ManageAssetsScreen(current));
  }

  function password(root: React.ReactNode, text = 'fresh test passphrase') {
    const input = find(root, node => node.type === PassphraseInput);
    if (!input?.props.ref) throw new Error('missing-passphrase-input');
    const buffer = createTransientPassphraseBuffer();
    buffer.replace(text);
    input.props.ref.current = { consume: buffer.consume, clear: buffer.clear };
    input.props.onPresenceChange?.(true);
    return buffer;
  }

  function slide(root: React.ReactNode) {
    const action = find(root, node => node.type === SlideToConfirm)?.props.onComplete;
    if (!action) throw new Error('missing-review-slide');
    return action;
  }

  it('submits once, retires old slides on blur/refocus, and offers an explicit fresh retry', async () => {
    let resolve!: (value: TrustlineSubmissionResult) => void;
    jest.mocked(submitTrustlineProductReview).mockReturnValueOnce(new Promise(done => {
      resolve = done;
    }));
    const current = props();
    const root = await prepareReview(current);
    password(root);
    const oldSlide = slide(root);
    oldSlide();
    oldSlide();
    expect(submitTrustlineProductReview).toHaveBeenCalledTimes(1);
    const guard = jest.mocked(submitTrustlineProductReview).mock.calls[0][5]!;
    expect(guard()).toBe(true);
    mockBlur?.();
    mockBlur = undefined;
    mockFocused = false;
    render(() => ManageAssetsScreen(current));
    effects();
    mockFocused = true;
    render(() => ManageAssetsScreen(current));
    effects();
    expect(guard()).toBe(false);
    resolve({ status: 'submitted', hash: 'old-hash', authorization: 'passphrase' });
    await settle();
    const retired = render(() => ManageAssetsScreen(current));
    expect(retired.props.loading).toBe(false);
    expect(retired.props.message).toBe('trustlines.error.reviewExpired');
    expect(retired.props.onAction).toBeDefined();
    retired.props.onAction();
    await settle();
    const fresh = render(() => ManageAssetsScreen(current));
    password(fresh);
    oldSlide();
    expect(submitTrustlineProductReview).toHaveBeenCalledTimes(1);
    jest.mocked(submitTrustlineProductReview).mockResolvedValueOnce({ status: 'watch-only' });
    slide(fresh)();
    await settle();
    expect(submitTrustlineProductReview).toHaveBeenCalledTimes(2);
  });

  it('retains the original review revision through a fast A to B to A switch before rerender', async () => {
    const current = props();
    let selection: SwapCurrentSelection = {
      selectedAccountId: account.id,
      selectionRevision: 1,
      accounts: [account],
      network: current.dependencies.network,
    };
    current.captureSession = focus => captureAccountRouteSession({
      account,
      network: current.dependencies.network,
      getCurrentSelection: () => selection,
      isCurrentFocusEpoch: focus,
    });
    const root = await prepareReview(current);
    password(root);
    selection = { ...selection, selectedAccountId: 'b', selectionRevision: 2 };
    selection = { ...selection, selectedAccountId: account.id, selectionRevision: 3 };
    slide(root)();
    expect(submitTrustlineProductReview).not.toHaveBeenCalled();
  });

  it('retires a native return across a short inactive/active event without a React rerender', async () => {
    let onAppState!: (state: AppStateStatus) => void;
    jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, listener) => {
      onAppState = listener;
      return { remove: jest.fn() };
    });
    let resolve!: (value: TrustlineSubmissionResult) => void;
    jest.mocked(submitTrustlineProductReview).mockReturnValueOnce(new Promise(done => {
      resolve = done;
    }));
    const current = props();
    const root = await prepareReview(current);
    password(root);
    slide(root)();
    const guard = jest.mocked(submitTrustlineProductReview).mock.calls[0][5]!;
    onAppState('inactive');
    onAppState('active');
    expect(guard()).toBe(false);
    resolve({ status: 'watch-only' });
    await settle();
    const retired = render(() => ManageAssetsScreen(current));
    expect(retired.props.onAction).toBeDefined();
    expect(retired.props.loading).toBe(false);
  });

  it('keeps a review current on harmless account object replacement and consumes a fresh password for retry', async () => {
    jest.mocked(submitTrustlineProductReview)
      .mockRejectedValueOnce(new Error('wrong-passphrase'))
      .mockResolvedValueOnce({ status: 'watch-only' });
    const current = props();
    const root = await prepareReview(current);
    const buffer = password(root, 'wrong test passphrase');
    const confirm = slide(root);
    confirm();
    await settle();
    const guard = jest.mocked(submitTrustlineProductReview).mock.calls[0][5]!;
    render(() => ManageAssetsScreen({ ...current, account: { ...account, label: 'Renamed' } }));
    effects();
    expect(guard()).toBe(true);
    confirm();
    expect(submitTrustlineProductReview).toHaveBeenCalledTimes(1);
    buffer.replace('correct fresh test passphrase');
    confirm();
    await settle();
    expect(submitTrustlineProductReview).toHaveBeenCalledTimes(2);
    buffer.replace('another test passphrase');
    confirm();
    expect(submitTrustlineProductReview).toHaveBeenCalledTimes(2);
  });
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
