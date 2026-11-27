import React from 'react';
import { SelectableChip } from '@ui/components/SelectableChip';
import { defaultTheme } from '@ui/theme';
import { createStyles } from '../styles';
import { createDappRecentHistory } from '@capabilities/dapp-interaction/dappRecentHistory';

import type { DappCatalogEntry, DappCatalogPort } from '@capabilities/dapp-catalog/catalog';

jest.mock('@fresnica/ui-native', () => {
  const ReactActual = jest.requireActual<typeof import('react')>('react');
  return {
    StateView: ({ title }: { title: string }) => ReactActual.createElement('StateView', { title }),
    Field: (props: Record<string, unknown>) => ReactActual.createElement('Field', props),
    Button: (props: Record<string, unknown>) => ReactActual.createElement('Button', props),
    useUiTheme: () => ({ colors: {} }),
    Screen: ({ children }: { children?: React.ReactNode }) =>
      ReactActual.createElement(ReactActual.Fragment, null, children),
  };
});

jest.mock('@ui/components', () => ({
  Screen: ({ children }: { children?: React.ReactNode }) => children ?? null,
}));

jest.mock('@ui/theme', () => {
  const actual = jest.requireActual<typeof import('@ui/theme')>('@ui/theme');
  return {
    ...actual,
    useThemedStyles: (factory: (theme: typeof actual.defaultTheme) => unknown) => factory(actual.defaultTheme),
  };
});

jest.mock('../../../../../locale', () => ({
  useLocalization: () => ({
    t: (key: string) => key,
  }),
}));

type StateSlot = { current: unknown };
type EffectSlot = {
  effect: () => void | (() => void);
  deps: readonly unknown[];
  cleanup?: () => void;
  pending: boolean;
};

const stateSlots: StateSlot[] = [];
const refSlots: StateSlot[] = [];
let refCursor = 0;
const effectSlots: EffectSlot[] = [];
let stateCursor = 0;
let effectCursor = 0;

const react = jest.requireActual<typeof import('react')>('react');
jest.spyOn(react, 'useContext').mockReturnValue(undefined);

jest.spyOn(react, 'useState').mockImplementation(((initial: unknown) => {
  const index = stateCursor;
  stateCursor += 1;
  if (!stateSlots[index]) {
    stateSlots[index] = {
      current: typeof initial === 'function' ? (initial as () => unknown)() : initial,
    };
  }
  const slot = stateSlots[index];
  const setState = (next: unknown) => {
    slot.current = typeof next === 'function' ? (next as (value: unknown) => unknown)(slot.current) : next;
  };
  return [slot.current, setState];
}) as typeof react.useState);

jest.spyOn(react, 'useEffect').mockImplementation(((effect: () => void | (() => void), deps?: readonly unknown[]) => {
  const index = effectCursor;
  effectCursor += 1;
  const previous = effectSlots[index];
  const nextDeps = deps ?? [];
  const changed =
    previous === undefined ||
    nextDeps.length !== previous.deps.length ||
    nextDeps.some((dep, depIndex) => !Object.is(dep, previous.deps[depIndex]));
  if (changed) previous?.cleanup?.();
  effectSlots[index] = {
    effect,
    deps: nextDeps,
    pending: changed,
    cleanup: changed ? undefined : previous?.cleanup,
  };
}) as typeof react.useEffect);

jest.spyOn(react, 'useRef').mockImplementation(((initial: unknown) => {
  const index = refCursor++;
  if (!refSlots[index]) refSlots[index] = { current: initial };
  return refSlots[index];
}) as typeof react.useRef);

jest.spyOn(react, 'useMemo').mockImplementation(((factory: () => unknown) => factory()) as typeof react.useMemo);
// This light-weight tree walker executes nested function components without
// a React renderer. Read-only icon subscriptions must use the test snapshot
// without a real dispatcher or side effects.
jest
  .spyOn(react, 'useSyncExternalStore')
  .mockImplementation(((_subscribe: unknown, getSnapshot: () => unknown) =>
    getSnapshot()) as typeof react.useSyncExternalStore);

const { DAppsScreen: ScreenImplementation } = require('../DAppsScreen') as typeof import('../DAppsScreen');
const historyRepository = { read: jest.fn(() => [] as readonly string[]), replace: jest.fn() };
let history = createDappRecentHistory(historyRepository, 'stellar-testnet');
function DAppsScreen(props: Parameters<typeof ScreenImplementation>[0]) {
  return ScreenImplementation({ ...props, recentHistory: props.recentHistory ?? history });
}
const openExternalUrl = jest.fn(async (_url: string) => {});

const entry: DappCatalogEntry = {
  id: 'demo',
  title: 'Demo Exchange',
  description: 'A public catalog row',
  category: 'Exchange',
  websiteUrl: 'https://example.invalid',
};

function resetHarness() {
  history.close();
  historyRepository.read.mockReset().mockReturnValue([]);
  historyRepository.replace.mockReset();
  history = createDappRecentHistory(historyRepository, 'stellar-testnet');
  stateSlots.length = 0;
  refSlots.length = 0;
  effectSlots.length = 0;
}

function beginRender() {
  stateCursor = 0;
  refCursor = 0;
  effectCursor = 0;
}

async function settle() {
  for (const slot of effectSlots) {
    if (!slot.pending) continue;
    slot.pending = false;
    const cleanup = slot.effect();
    if (typeof cleanup === 'function') slot.cleanup = cleanup;
  }
  for (let step = 0; step < 20; step += 1) {
    await Promise.resolve();
  }
}

async function renderCatalog(
  catalog: DappCatalogPort,
  showInterfaceSample = false,
  active = true,
  online = true,
  focused = active,
) {
  const props = { catalog, showInterfaceSample, openExternalUrl, active, online, focused };
  beginRender();
  DAppsScreen(props);
  await settle();
  beginRender();
  return DAppsScreen(props);
}

type NodeProps = Readonly<{
  children?: React.ReactNode;
  title?: string;
  label?: string;
  value?: string;
  accessibilityLabel?: string;
  accessibilityRole?: string;
  accessibilityState?: { selected?: boolean };
  selected?: boolean;
  size?: string;
  autoCapitalize?: string;
  autoCorrect?: boolean;
  secureTextEntry?: boolean;
  onPress?: () => void;
  refreshControl?: React.ReactElement<{ refreshing: boolean; onRefresh: () => void }>;
  onChangeText?: (value: string) => void;
  onSubmitEditing?: () => void;
  disabled?: boolean;
  visible?: boolean;
  closeLabel?: string;
  onClose?: () => void;
}>;

function walk(node: React.ReactNode, callback: (element: React.ReactElement<NodeProps>) => void): void {
  if (Array.isArray(node)) {
    React.Children.forEach(node, child => walk(child, callback));
    return;
  }
  if (!React.isValidElement<NodeProps>(node)) return;
  callback(node);
  if (typeof node.type === 'function' && !(node.type.prototype && node.type.prototype instanceof React.Component)) {
    try {
      walk((node.type as (props: NodeProps) => React.ReactNode)(node.props), callback);
      return;
    } catch {
      // Host components from React Native keep their own hooks. Read their children instead.
    }
  }
  React.Children.forEach(node.props.children, child => walk(child, callback));
}

function elements(node: React.ReactNode) {
  const found: React.ReactElement<NodeProps>[] = [];
  walk(node, element => found.push(element));
  return found;
}

function openUrlSheetFrom(nodes: ReturnType<typeof elements>) {
  const launcher = nodes.find(node => node.props.accessibilityLabel === 'dapps.website.customTitle');
  expect(launcher).toBeDefined();
  launcher?.props.onPress?.();
}

afterAll(() => jest.restoreAllMocks());

describe('catalog presentation parity', () => {
  beforeEach(() => {
    resetHarness();
    openExternalUrl.mockClear();
  });

  it('uses the catalog recommendation order without promoting conflicting or duplicate entries', async () => {
    const alpha = { ...entry, id: 'a', title: 'Alpha', websiteUrl: 'https://alpha.example.org' };
    const beta = { ...entry, id: 'b', title: 'Beta', websiteUrl: 'https://beta.example.org' };
    const listing: DappCatalogPort = {
      load: async () => ({
        kind: 'ready',
        entries: [alpha, beta],
        featured: [{ ...alpha, websiteUrl: beta.websiteUrl }, beta, beta],
      }),
    };
    const nodes = elements(await renderCatalog(listing));
    const headingAt = (name: string) => nodes.findIndex(node => node.props.children === name);
    const recommended = headingAt('dapps.catalog.featured');
    const all = headingAt('dapps.catalog.allApps');
    expect(recommended).toBeGreaterThanOrEqual(0);
    expect(all).toBeGreaterThan(recommended);
    expect(
      nodes.slice(recommended, all).filter(node => node.props.accessibilityLabel === 'dapps.website.openInApp: Beta'),
    ).toHaveLength(1);
    expect(
      nodes.slice(recommended, all).some(node => node.props.accessibilityLabel === 'dapps.website.openInApp: Alpha'),
    ).toBe(false);
  });

  it('labels known Recent sites without granting them the catalog launch path', async () => {
    const named = { ...entry, websiteUrl: 'https://named.example.org/catalog' };
    history.record('https://named.example.org/private?q=secret');
    const listing: DappCatalogPort = {
      load: async () => ({ kind: 'ready', entries: [named] }),
      isTrustedLiveEntry: () => true,
    };
    const home = elements(await renderCatalog(listing));
    home.filter(node => node.props.accessibilityState?.selected !== undefined)[1]?.props.onPress?.();
    const recent = elements(await renderCatalog(listing));
    const row = recent.find(node => node.props.label === 'Demo Exchange · https://named.example.org');
    expect(row).toBeDefined();
    row?.props.onPress?.();
    const confirmation = elements(await renderCatalog(listing));
    expect(confirmation.some(node => node.props.children === 'dapps.website.unreviewed')).toBe(true);
    expect(openExternalUrl).not.toHaveBeenCalled();
  });
});

describe('dApp catalog pull to refresh', () => {
  beforeEach(resetHarness);

  it('keeps existing entries during a pull, coalesces repeated pulls, and displays fresh results', async () => {
    let resolveRefresh: ((value: Awaited<ReturnType<DappCatalogPort['load']>>) => void) | undefined;
    const load = jest
      .fn()
      .mockResolvedValueOnce({ kind: 'ready', entries: [entry] })
      .mockImplementationOnce(
        () =>
          new Promise(resolve => {
            resolveRefresh = resolve;
          }),
      );
    const catalog: DappCatalogPort = { load };
    const selectRefresh = (tree: React.ReactNode) =>
      elements(tree).find(node => node.props.refreshControl)?.props.refreshControl;
    const first = selectRefresh(await renderCatalog(catalog));
    expect(first?.props.refreshing).toBe(false);
    first?.props.onRefresh();
    first?.props.onRefresh();
    const waiting = await renderCatalog(catalog);
    expect(selectRefresh(waiting)?.props.refreshing).toBe(true);
    expect(
      elements(waiting).some(node => node.props.accessibilityLabel === 'dapps.website.openInApp: Demo Exchange'),
    ).toBe(true);
    expect(load).toHaveBeenCalledTimes(2);
    resolveRefresh?.({ kind: 'ready', entries: [{ ...entry, title: 'Updated directory entry' }] });
    const done = await renderCatalog(catalog);
    expect(selectRefresh(done)?.props.refreshing).toBe(false);
    expect(
      elements(done).some(node => node.props.accessibilityLabel === 'dapps.website.openInApp: Updated directory entry'),
    ).toBe(true);
  });

  it('ends the spinner and retains the catalog as stale when a refresh fails', async () => {
    const load = jest
      .fn()
      .mockResolvedValueOnce({ kind: 'ready', entries: [entry] })
      .mockRejectedValueOnce(new Error('network unavailable'));
    const catalog: DappCatalogPort = { load };
    const control = (tree: React.ReactNode) =>
      elements(tree).find(node => node.props.refreshControl)?.props.refreshControl;
    control(await renderCatalog(catalog))?.props.onRefresh();
    const done = await renderCatalog(catalog);
    expect(control(done)?.props.refreshing).toBe(false);
    const nodes = elements(done);
    expect(nodes.some(node => node.props.children === 'dapps.catalog.stale')).toBe(true);
    expect(nodes.some(node => node.props.accessibilityLabel === 'dapps.website.openInApp: Demo Exchange')).toBe(true);
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('does not expose pull to refresh on Recent or while offline', async () => {
    const load = jest.fn().mockResolvedValue({ kind: 'ready', entries: [entry] });
    const catalog: DappCatalogPort = { load };
    const initial = elements(await renderCatalog(catalog));
    initial.filter(node => node.props.accessibilityState?.selected !== undefined)[1]?.props.onPress?.();
    const recentNodes = elements(await renderCatalog(catalog));
    expect(recentNodes.some(node => node.props.title === 'dapps.website.recentEmpty')).toBe(true);
    expect(recentNodes.some(node => node.props.refreshControl)).toBe(false);
    resetHarness();
    const offlineNodes = elements(await renderCatalog(catalog, false, true, false));
    expect(offlineNodes.some(node => node.props.refreshControl)).toBe(false);
    expect(load).toHaveBeenCalledTimes(1);
  });
});

describe('DAppsScreen native field and retry', () => {
  it('uses the Tab Bar bottom inset and a compact catalog scroll ending', async () => {
    const catalog: DappCatalogPort = { load: jest.fn().mockResolvedValue({ kind: 'unavailable' }) };
    const tree = await renderCatalog(catalog);
    expect(tree.props.safeAreaEdges).toEqual(['top', 'right', 'left']);
    expect(createStyles(defaultTheme).content.paddingBottom).toBe(defaultTheme.spacing.sm);
  });

  beforeEach(() => {
    resetHarness();
  });

  it('scanned HTTPS opens only the untrusted URL confirmation, not the wallet browser', async () => {
    openExternalUrl.mockClear();
    const catalog: DappCatalogPort = { load: jest.fn().mockResolvedValue({ kind: 'unavailable' }) };
    const clearScannedUrl = jest.fn();
    const props = {
      catalog,
      showInterfaceSample: false,
      openExternalUrl,
      scannedUrl: 'https://wallet.example.org/page',
      clearScannedUrl,
    };
    beginRender();
    DAppsScreen(props);
    await settle();
    expect(clearScannedUrl).toHaveBeenCalledTimes(1);
    beginRender();
    const nodes = elements(DAppsScreen({ ...props, scannedUrl: undefined }));
    expect(nodes.some(node => node.props.label === 'dapps.website.confirm')).toBe(true);
    expect(nodes.some(node => node.props.children === 'https://wallet.example.org/page')).toBe(true);
    expect(openExternalUrl).not.toHaveBeenCalled();
    nodes.find(node => node.props.label === 'dapps.website.cancel')?.props.onPress?.();
    expect(openExternalUrl).not.toHaveBeenCalled();
  });

  it('shows the unconfigured catalog without a search field', async () => {
    const catalog: DappCatalogPort = { load: jest.fn().mockResolvedValue({ kind: 'unavailable' }) };
    const tree = await renderCatalog(catalog);
    const nodes = elements(tree);

    expect(nodes.some(node => node.props.title === 'dapps.catalog.unavailable')).toBe(true);
    expect(nodes.some(node => node.type === 'Field' && node.props.accessibilityLabel === 'dapps.catalog.search')).toBe(
      false,
    );
    expect(nodes.some(node => node.props.label === 'dapps.website.preview')).toBe(true);
  });

  it('shows a labeled layout sample under the unconfigured catalog', async () => {
    const catalog: DappCatalogPort = { load: jest.fn().mockResolvedValue({ kind: 'unavailable' }) };
    const tree = await renderCatalog(catalog, true);
    const nodes = elements(tree);
    const field = nodes.find(node => node.type === 'Field' && node.props.accessibilityLabel === 'dapps.catalog.search');
    const button = nodes.find(node => node.props.label === 'dapps.catalog.previewClear');

    expect(nodes.some(node => node.props.title === 'dapps.catalog.unavailable')).toBe(true);
    expect(nodes.some(node => node.props.children === 'dapps.catalog.previewNotice')).toBe(true);
    expect(nodes.some(node => node.props.children === 'dapps.catalog.sample.directory.title')).toBe(true);
    expect(field?.props.secureTextEntry).toBeUndefined();
    expect(button?.props.label).toBe('dapps.catalog.previewClear');
    expect(nodes.some(node => node.type === SelectableChip && node.props.size === 'compact')).toBe(true);

    field?.props.onChangeText?.('missing-sample');
    beginRender();
    const filtered = elements(DAppsScreen({ catalog, showInterfaceSample: true, openExternalUrl }));
    expect(filtered.some(node => node.props.title === 'dapps.catalog.noMatch')).toBe(true);
    expect(filtered.some(node => node.props.children === 'dapps.catalog.sample.directory.title')).toBe(false);

    filtered.find(node => node.props.label === 'dapps.catalog.previewClear')?.props.onPress?.();
    beginRender();
    const cleared = elements(DAppsScreen({ catalog, showInterfaceSample: true, openExternalUrl }));
    expect(
      cleared.find(node => node.type === 'Field' && node.props.accessibilityLabel === 'dapps.catalog.search')?.props
        .value,
    ).toBe('');
    expect(cleared.some(node => node.props.children === 'dapps.catalog.sample.tools.title')).toBe(true);
  });

  it('keeps category filtering in dApps while rendering shared compact chips', async () => {
    const utility = { ...entry, id: 'utility', title: 'Utility dApp', category: 'Utility' };
    const catalog: DappCatalogPort = {
      load: jest.fn().mockResolvedValue({ kind: 'ready', entries: [entry, utility] }),
    };
    const initial = elements(await renderCatalog(catalog));
    const exchange = initial.find(node => node.type === SelectableChip && node.props.label === 'Exchange');

    expect(exchange?.props.selected).toBe(false);
    expect(exchange?.props.size).toBe('compact');
    exchange?.props.onPress?.();
    beginRender();
    const filtered = elements(DAppsScreen({ catalog, openExternalUrl }));

    expect(filtered.find(node => node.type === SelectableChip && node.props.label === 'Exchange')?.props.selected).toBe(
      true,
    );
    expect(filtered.some(node => node.props.accessibilityLabel === 'dapps.website.openInApp: Demo Exchange')).toBe(
      true,
    );
    expect(filtered.some(node => node.props.accessibilityLabel === 'dapps.website.openInApp: Utility dApp')).toBe(
      false,
    );
  });

  it('keeps search as a public text field and reports no match', async () => {
    const catalog: DappCatalogPort = { load: jest.fn().mockResolvedValue({ kind: 'ready', entries: [entry] }) };
    const tree = await renderCatalog(catalog);
    const field = elements(tree).find(
      node => node.type === 'Field' && node.props.accessibilityLabel === 'dapps.catalog.search',
    );

    expect(field?.props.accessibilityLabel).toBe('dapps.catalog.search');
    expect(field?.props.autoCapitalize).toBe('none');
    expect(field?.props.autoCorrect).toBe(false);
    expect(field?.props.secureTextEntry).toBeUndefined();

    field?.props.onChangeText?.('missing-catalog-row');
    beginRender();
    const searched = DAppsScreen({ catalog, openExternalUrl });
    const searchedNodes = elements(searched);
    const searchedField = searchedNodes.find(
      node => node.type === 'Field' && node.props.accessibilityLabel === 'dapps.catalog.search',
    );

    expect(searchedField?.props.value).toBe('missing-catalog-row');
    expect(searchedNodes.some(node => node.props.title === 'dapps.catalog.noMatch')).toBe(true);
  });

  it('labels offline fallback rows stale and offers retry without hiding the catalog', async () => {
    const catalog: DappCatalogPort = {
      load: jest.fn().mockResolvedValue({ kind: 'ready', stale: true, entries: [entry] }),
    };
    const nodes = elements(await renderCatalog(catalog));
    expect(nodes.some(node => node.props.children === 'dapps.catalog.stale')).toBe(true);
    expect(nodes.some(node => node.props.label === 'dapps.catalog.retry')).toBe(true);
    expect(nodes.some(node => node.props.children === 'Demo Exchange')).toBe(true);
  });

  it('shows persisted public catalog on offline startup, without starting a network request', async () => {
    const load = jest.fn();
    const readCached = jest.fn(() => ({ kind: 'ready' as const, stale: true as const, entries: [entry] }));
    const catalog: DappCatalogPort = { load, readCached };
    const nodes = elements(await renderCatalog(catalog, false, true, false));
    expect(readCached).toHaveBeenCalledTimes(1);
    expect(load).not.toHaveBeenCalled();
    expect(nodes.some(node => node.props.children === 'dapps.catalog.cached')).toBe(true);
    expect(nodes.some(node => node.props.children === 'Demo Exchange')).toBe(true);
    expect(nodes.find(node => node.props.label === 'dapps.catalog.retry')?.props.disabled).toBe(true);
  });

  it('never shows the previous catalog after a source change while offline', async () => {
    const original: DappCatalogPort = {
      load: jest.fn().mockResolvedValue({ kind: 'ready', entries: [entry] }),
    };
    const first = elements(await renderCatalog(original));
    expect(first.some(node => node.props.children === 'Demo Exchange')).toBe(true);
    const other: DappCatalogPort = {
      load: jest.fn(),
      readCached: jest.fn(() => ({ kind: 'unavailable' as const })),
    };
    const second = elements(await renderCatalog(other, false, true, false));
    expect(second.some(node => node.props.children === 'Demo Exchange')).toBe(false);
    expect(second.some(node => node.props.title === 'dapps.catalog.offline')).toBe(true);
    expect(other.load).not.toHaveBeenCalled();
  });

  it('retries a failed catalog load from the native button', async () => {
    const load = jest.fn().mockRejectedValue(new Error('catalog-down'));
    const catalog = { load };
    const tree = await renderCatalog(catalog);
    const button = elements(tree).find(node => node.props.label === 'dapps.catalog.retry');

    expect(elements(tree).some(node => node.props.title === 'dapps.catalog.error')).toBe(true);
    expect(button?.props.label).toBe('dapps.catalog.retry');
    expect(button?.props.disabled).toBeUndefined();

    load.mockResolvedValueOnce({ kind: 'unavailable' });
    button?.props.onPress?.();
    const retried = await renderCatalog(catalog);

    expect(load).toHaveBeenCalledTimes(2);
    expect(elements(retried).some(node => node.props.title === 'dapps.catalog.unavailable')).toBe(true);
  });

  it.each([false, true])(
    'opens a stale=%s directory row directly without querying detail or showing a risk sheet',
    async stale => {
      const openCatalogInApp = jest.fn();
      const loadDetail = jest.fn().mockRejectedValue(new Error('detail-unavailable'));
      const catalog: DappCatalogPort = {
        load: jest.fn(async () => ({ kind: 'ready' as const, entries: [entry], stale })),
        publicMedia: {
          available: true,
          getIconState: () => ({ enabled: false, revision: 0 }),
          subscribeIcons: () => () => {},
          setIconsEnabled: jest.fn(),
          readIcon: jest.fn(),
          loadIcon: jest.fn(),
          readCachedDetail: jest.fn(),
          loadDetail,
          close: jest.fn(),
        },
        isTrustedLiveEntry: () => !stale,
      };
      await renderCatalog(catalog);
      beginRender();
      const tree = elements(DAppsScreen({ catalog, openExternalUrl, openCatalogInApp }));
      const launch = tree.find(node => node.props.accessibilityLabel === 'dapps.website.openInApp: Demo Exchange');
      expect(launch?.props.accessibilityRole).toBe('button');
      launch?.props.onPress?.();
      launch?.props.onPress?.();
      beginRender();
      const after = elements(DAppsScreen({ catalog, openExternalUrl, openCatalogInApp }));
      expect(openCatalogInApp).toHaveBeenCalledTimes(1);
      expect(openCatalogInApp).toHaveBeenCalledWith(entry, !stale);
      expect(loadDetail).not.toHaveBeenCalled();
      expect(after.some(node => node.props.children === 'dapps.website.unreviewed')).toBe(false);
      expect(openExternalUrl).not.toHaveBeenCalled();
    },
  );

  it('blocks an old row after switching the directory provider', async () => {
    const openCatalogInApp = jest.fn();
    const one: DappCatalogPort = { load: async () => ({ kind: 'ready', entries: [entry] }) };
    const two: DappCatalogPort = { load: async () => ({ kind: 'ready', entries: [] }) };
    await renderCatalog(one);
    beginRender();
    const tree = elements(DAppsScreen({ catalog: one, openExternalUrl, openCatalogInApp }));
    const old = tree.find(node => node.props.accessibilityLabel === 'dapps.website.openInApp: Demo Exchange');
    await renderCatalog(two);
    old?.props.onPress?.();
    expect(openCatalogInApp).not.toHaveBeenCalled();
  });

  it('keeps system browser confirmation when the embedded browser is unavailable', async () => {
    const publicEntry = { ...entry, websiteUrl: 'https://dex.example.org/app' };
    const catalog: DappCatalogPort = {
      load: jest.fn(async () => ({ kind: 'ready' as const, entries: [publicEntry] })),
    };
    const nodes = elements(await renderCatalog(catalog));
    nodes.find(node => node.props.accessibilityLabel === 'dapps.website.openInApp: Demo Exchange')?.props.onPress?.();
    beginRender();
    const reviewed = elements(DAppsScreen({ catalog, openExternalUrl }));
    expect(reviewed.some(node => node.props.children === 'dapps.website.unreviewed')).toBe(true);
    expect(openExternalUrl).not.toHaveBeenCalled();
  });

  it('leaves the catalog search behind when Recent is selected', async () => {
    const catalog: DappCatalogPort = { load: jest.fn().mockResolvedValue({ kind: 'ready', entries: [entry] }) };
    const tree = await renderCatalog(catalog);
    const recent = elements(tree).filter(node => node.props.accessibilityState?.selected !== undefined)[1];

    recent?.props.onPress?.();
    beginRender();
    const recentTree = DAppsScreen({ catalog, openExternalUrl });
    const nodes = elements(recentTree);

    expect(nodes.some(node => node.props.title === 'dapps.website.recentEmpty')).toBe(true);
    expect(nodes.some(node => node.type === 'Field' && node.props.accessibilityLabel === 'dapps.catalog.search')).toBe(
      false,
    );
  });
});

describe('S15 untrusted URL risk confirmation and shared Recent', () => {
  beforeEach(() => {
    resetHarness();
    openExternalUrl.mockReset().mockResolvedValue(undefined);
  });

  const catalog: DappCatalogPort = { load: jest.fn().mockResolvedValue({ kind: 'unavailable' }) };
  function websiteNodes() {
    beginRender();
    return elements(DAppsScreen({ catalog, openExternalUrl, showInterfaceSample: false }));
  }

  it('opens the URL input in a sheet and dismisses without navigating', async () => {
    const initial = elements(await renderCatalog(catalog));
    const launch = initial.find(node => node.props.accessibilityLabel === 'dapps.website.customTitle');
    expect(launch).toBeDefined();
    launch?.props.onPress?.();
    let nodes = websiteNodes();
    expect(nodes.find(node => node.props.closeLabel === 'dapps.website.cancel')?.props.visible).toBe(true);
    nodes
      .find(node => node.props.accessibilityLabel === 'dapps.website.input')
      ?.props.onChangeText?.('https://example.org');
    nodes = websiteNodes();
    nodes.find(node => node.props.closeLabel === 'dapps.website.cancel')?.props.onClose?.();
    nodes = websiteNodes();
    expect(nodes.find(node => node.props.closeLabel === 'dapps.website.cancel')?.props.visible).toBe(false);
    expect(openExternalUrl).not.toHaveBeenCalled();
  });

  it('submits a URL from the sheet into explicit risk review without opening the browser', async () => {
    await renderCatalog(catalog);
    websiteNodes()
      .find(node => node.props.accessibilityLabel === 'dapps.website.customTitle')
      ?.props.onPress?.();
    websiteNodes()
      .find(node => node.props.accessibilityLabel === 'dapps.website.input')
      ?.props.onChangeText?.('https://example.org/path');
    websiteNodes()
      .find(node => node.props.label === 'dapps.website.preview')
      ?.props.onPress?.();
    const nodes = websiteNodes();
    expect(nodes.find(node => node.props.closeLabel === 'dapps.website.cancel')?.props.visible).toBe(false);
    expect(nodes.some(node => node.props.children === 'dapps.website.unreviewed')).toBe(true);
    expect(openExternalUrl).not.toHaveBeenCalled();
  });

  it('ignores a queued keyboard Go callback after the URL sheet is cancelled', async () => {
    await renderCatalog(catalog);
    websiteNodes()
      .find(node => node.props.accessibilityLabel === 'dapps.website.customTitle')
      ?.props.onPress?.();
    websiteNodes()
      .find(node => node.props.accessibilityLabel === 'dapps.website.input')
      ?.props.onChangeText?.('https://example.org/path');

    const pending = websiteNodes();
    const lateGo = pending.find(node => node.props.accessibilityLabel === 'dapps.website.input')?.props.onSubmitEditing;
    expect(lateGo).toBeDefined();
    pending.find(node => node.props.closeLabel === 'dapps.website.cancel')?.props.onClose?.();
    lateGo?.();

    const after = websiteNodes();
    expect(after.find(node => node.props.closeLabel === 'dapps.website.cancel')?.props.visible).toBe(false);
    expect(after.some(node => node.props.children === 'dapps.website.unreviewed')).toBe(false);
    expect(openExternalUrl).not.toHaveBeenCalled();
  });

  it('rejects stale Go from a closed sheet even after another sheet is opened', async () => {
    await renderCatalog(catalog);
    websiteNodes()
      .find(node => node.props.accessibilityLabel === 'dapps.website.customTitle')
      ?.props.onPress?.();
    websiteNodes()
      .find(node => node.props.accessibilityLabel === 'dapps.website.input')
      ?.props.onChangeText?.('https://old.example/path');

    const pending = websiteNodes();
    const lateGo = pending.find(node => node.props.accessibilityLabel === 'dapps.website.input')?.props.onSubmitEditing;
    const lateText = pending.find(node => node.props.accessibilityLabel === 'dapps.website.input')?.props.onChangeText;
    pending.find(node => node.props.closeLabel === 'dapps.website.cancel')?.props.onClose?.();

    websiteNodes()
      .find(node => node.props.accessibilityLabel === 'dapps.website.customTitle')
      ?.props.onPress?.();
    lateGo?.();
    lateText?.('https://old.example/stale');

    const after = websiteNodes();
    expect(after.find(node => node.props.closeLabel === 'dapps.website.cancel')?.props.visible).toBe(true);
    expect(after.find(node => node.props.accessibilityLabel === 'dapps.website.input')?.props.value).toBe('');
    expect(after.some(node => node.props.children === 'dapps.website.unreviewed')).toBe(false);
    expect(openExternalUrl).not.toHaveBeenCalled();

    after
      .find(node => node.props.accessibilityLabel === 'dapps.website.input')
      ?.props.onChangeText?.('https://new.example/path');
    websiteNodes()
      .find(node => node.props.accessibilityLabel === 'dapps.website.input')
      ?.props.onSubmitEditing?.();
    const reviewed = websiteNodes();
    expect(reviewed.some(node => node.props.children === 'https://new.example')).toBe(true);
    expect(openExternalUrl).not.toHaveBeenCalled();
  });

  it('never opens user URL on typing or preview, and Cancel discards the proposed origin', async () => {
    const initial = elements(await renderCatalog(catalog));
    openUrlSheetFrom(initial);
    const input = websiteNodes().find(
      node => node.type === 'Field' && node.props.accessibilityLabel === 'dapps.website.input',
    );
    input?.props.onChangeText?.('https://EXAMPLE.org/asset?a=1');
    let nodes = websiteNodes();
    expect(openExternalUrl).not.toHaveBeenCalled();
    nodes.find(node => node.props.label === 'dapps.website.preview')?.props.onPress?.();
    nodes = websiteNodes();
    expect(nodes.some(node => node.props.children === 'dapps.website.unreviewed')).toBe(true);
    expect(nodes.some(node => node.props.children === 'https://example.org')).toBe(true);
    expect(openExternalUrl).not.toHaveBeenCalled();
    nodes
      .filter(node => node.props.label === 'dapps.website.cancel')
      .slice(-1)[0]
      ?.props.onPress?.();
    nodes = websiteNodes();
    expect(nodes.some(node => node.props.children === 'dapps.website.unreviewed')).toBe(false);
    expect(openExternalUrl).not.toHaveBeenCalled();
  });

  it('explains the Android fail-closed policy while retaining the consented device-browser option', async () => {
    const first = elements(await renderCatalog(catalog));
    openUrlSheetFrom(first);
    websiteNodes()
      .find(node => node.props.accessibilityLabel === 'dapps.website.input')
      ?.props.onChangeText?.('https://example.org/');
    websiteNodes()
      .find(node => node.props.label === 'dapps.website.preview')
      ?.props.onPress?.();
    beginRender();
    const nodes = elements(
      DAppsScreen({ catalog, openExternalUrl, inAppUnavailable: true, showInterfaceSample: false }),
    );
    expect(nodes.some(node => node.props.children === 'dapps.browser.androidUnavailable')).toBe(true);
    expect(nodes.some(node => node.props.label === 'dapps.website.openInApp')).toBe(false);
    const external = nodes.find(node => node.props.label === 'dapps.website.confirm');
    expect(external).toBeDefined();
    external?.props.onPress?.();
    await Promise.resolve();
    await Promise.resolve();
    expect(openExternalUrl).toHaveBeenCalledWith('https://example.org/');
  });

  it('fails closed for non-HTTPS input without creating a browser route', async () => {
    const initial = elements(await renderCatalog(catalog));
    openUrlSheetFrom(initial);
    const input = websiteNodes().find(
      node => node.type === 'Field' && node.props.accessibilityLabel === 'dapps.website.input',
    );
    input?.props.onChangeText?.('java' + 'script:alert(1)');
    websiteNodes()
      .find(node => node.props.label === 'dapps.website.preview')
      ?.props.onPress?.();
    const nodes = websiteNodes();
    expect(nodes.some(node => node.props.children === 'dapps.website.invalid')).toBe(true);
    expect(nodes.some(node => node.props.label === 'dapps.website.confirm')).toBe(false);
    expect(openExternalUrl).not.toHaveBeenCalled();
  });

  it('handles external browser failure, retains consent review and blocks double-open', async () => {
    openExternalUrl.mockRejectedValueOnce(new Error('os-browser-unavailable')).mockResolvedValueOnce(undefined);
    const initial = elements(await renderCatalog(catalog));
    openUrlSheetFrom(initial);
    websiteNodes()
      .find(node => node.type === 'Field' && node.props.accessibilityLabel === 'dapps.website.input')
      ?.props.onChangeText?.('https://example.org/path');
    websiteNodes()
      .find(node => node.props.label === 'dapps.website.preview')
      ?.props.onPress?.();
    const proposal = websiteNodes();
    const confirm = proposal.find(node => node.props.label === 'dapps.website.confirm');
    confirm?.props.onPress?.();
    confirm?.props.onPress?.();
    await Promise.resolve();
    await Promise.resolve();
    expect(openExternalUrl).toHaveBeenCalledTimes(1);
    expect(websiteNodes().some(node => node.props.children === 'dapps.website.failed')).toBe(true);
    websiteNodes()
      .find(node => node.props.label === 'dapps.website.confirm')
      ?.props.onPress?.();
    await Promise.resolve();
    await Promise.resolve();
    expect(openExternalUrl).toHaveBeenCalledTimes(2);
    const home = websiteNodes();
    home.filter(node => node.props.accessibilityState?.selected !== undefined)[1]?.props.onPress?.();
    expect(websiteNodes().some(node => node.props.label === 'https://example.org')).toBe(true);
  });

  it('keeps a successful browser open successful when Recent cannot save, with retry feedback', async () => {
    const initial = elements(await renderCatalog(catalog));
    openUrlSheetFrom(initial);
    websiteNodes()
      .find(node => node.props.accessibilityLabel === 'dapps.website.input')
      ?.props.onChangeText?.('https://example.org/path?private=x');
    websiteNodes()
      .find(node => node.props.label === 'dapps.website.preview')
      ?.props.onPress?.();
    historyRepository.replace.mockImplementationOnce(() => {
      throw new Error('disk-full');
    });
    websiteNodes()
      .find(node => node.props.label === 'dapps.website.confirm')
      ?.props.onPress?.();
    await Promise.resolve();
    await Promise.resolve();
    expect(openExternalUrl).toHaveBeenCalledTimes(1);
    expect(history.getSnapshot().origins).toEqual([]);
    expect(websiteNodes().some(node => node.props.children === 'dapps.website.failed')).toBe(false);
    expect(websiteNodes().some(node => node.props.children === 'dapps.website.recentUnavailable')).toBe(true);
    websiteNodes()
      .filter(node => node.props.accessibilityState?.selected !== undefined)[1]
      ?.props.onPress?.();
    websiteNodes()
      .find(node => node.props.label === 'dapps.catalog.retry')
      ?.props.onPress?.();
    expect(history.getSnapshot().unavailable).toBe(false);
  });

  it('shows shared history offline and reopens only after explicit confirmation', async () => {
    history.record('https://visited.example.org/path?token=private');
    const initial = elements(await renderCatalog(catalog, false, true, false));
    initial.filter(node => node.props.accessibilityState?.selected !== undefined)[1]?.props.onPress?.();
    const recent = websiteNodes();
    recent.find(node => node.props.label === 'https://visited.example.org')?.props.onPress?.();
    expect(openExternalUrl).not.toHaveBeenCalled();
    expect(websiteNodes().some(node => node.props.children === 'dapps.website.unreviewed')).toBe(true);
    expect(history.getSnapshot().origins).toEqual(['https://visited.example.org']);
  });

  it('hands only canonical origin to Recent after a pathless query opens on React Native', async () => {
    const originalURL = global.URL;
    global.URL = jest.requireActual<{ URL: typeof URL }>('react-native/Libraries/Blob/URL').URL;
    const record = jest.spyOn(history, 'record');
    try {
      const url = 'https://example.org?session=private';
      const initial = elements(await renderCatalog(catalog));
      openUrlSheetFrom(initial);
      websiteNodes()
        .find(node => node.props.accessibilityLabel === 'dapps.website.input')
        ?.props.onChangeText?.(url);
      websiteNodes()
        .find(node => node.props.label === 'dapps.website.preview')
        ?.props.onPress?.();
      expect(record).not.toHaveBeenCalled();
      websiteNodes()
        .find(node => node.props.label === 'dapps.website.confirm')
        ?.props.onPress?.();
      await Promise.resolve();
      await Promise.resolve();
      expect(openExternalUrl).toHaveBeenCalledWith(url);
      expect(record).toHaveBeenCalledWith('https://example.org');
      expect(history.getSnapshot().origins).toEqual(['https://example.org']);
      websiteNodes()
        .filter(node => node.props.accessibilityState?.selected !== undefined)[1]
        ?.props.onPress?.();
      const recent = websiteNodes();
      expect(JSON.stringify(recent)).not.toContain('private');
      recent.find(node => node.props.label === 'https://example.org')?.props.onPress?.();
      websiteNodes()
        .find(node => node.props.label === 'dapps.website.confirm')
        ?.props.onPress?.();
      await Promise.resolve();
      await Promise.resolve();
      expect(openExternalUrl.mock.lastCall?.[0]).toBe('https://example.org/');
    } finally {
      record.mockRestore();
      global.URL = originalURL;
    }
  });

  it('opens only after explicit approval and records only the origin in shared Recent', async () => {
    const initial = elements(await renderCatalog(catalog));
    openUrlSheetFrom(initial);
    websiteNodes()
      .find(node => node.type === 'Field' && node.props.accessibilityLabel === 'dapps.website.input')
      ?.props.onChangeText?.('example.org/path');
    websiteNodes()
      .find(node => node.props.label === 'dapps.website.preview')
      ?.props.onPress?.();
    const proposal = websiteNodes();
    const confirm = proposal.find(node => node.props.label === 'dapps.website.confirm');
    expect(confirm).toBeDefined();
    confirm?.props.onPress?.();
    await Promise.resolve();
    await Promise.resolve();
    expect(openExternalUrl).toHaveBeenCalledTimes(1);
    expect(openExternalUrl).toHaveBeenCalledWith('https://example.org/path');
    const home = websiteNodes();
    const recent = home.filter(node => node.props.accessibilityState?.selected !== undefined)[1];
    recent?.props.onPress?.();
    const nodes = websiteNodes();
    expect(nodes.some(node => node.props.label === 'https://example.org')).toBe(true);
    expect(openExternalUrl).toHaveBeenCalledTimes(1);
  });
});

describe('catalog and browser lifecycle', () => {
  beforeEach(() => {
    resetHarness();
    openExternalUrl.mockClear();
  });
  it.each(['ready', 'unavailable'] as const)(
    'shows offline on first entry and recovers to %s when online',
    async kind => {
      let resolve!: (value: Awaited<ReturnType<DappCatalogPort['load']>>) => void;
      const load = jest.fn(
        () =>
          new Promise<Awaited<ReturnType<DappCatalogPort['load']>>>(done => {
            resolve = done;
          }),
      );
      const catalog = { load };
      const offline = elements(await renderCatalog(catalog, true, true, false));
      expect(offline.some(node => node.props.title === 'dapps.catalog.offline')).toBe(true);
      expect(offline.some(node => node.props.accessibilityLabel === 'dapps.catalog.loading')).toBe(false);
      expect(load).not.toHaveBeenCalled();
      const loading = elements(await renderCatalog(catalog, true, true, true));
      expect(load).toHaveBeenCalledTimes(1);
      expect(loading.some(node => node.props.accessibilityLabel === 'dapps.catalog.loading')).toBe(true);
      resolve(kind === 'ready' ? { kind, entries: [entry] } : { kind });
      await settle();
      const recovered = elements(await renderCatalog(catalog, true, true, true));
      expect(recovered.some(node => node.props.title === 'dapps.catalog.offline')).toBe(false);
      expect(recovered.some(node => node.props.accessibilityLabel === 'dapps.catalog.loading')).toBe(false);
      expect(
        recovered.some(node =>
          kind === 'ready' ? node.props.children === entry.title : node.props.title === 'dapps.catalog.unavailable',
        ),
      ).toBe(true);
      expect(load).toHaveBeenCalledTimes(1);
    },
  );
  it('gates loads on activity/connectivity, retains data on failed refresh and retries after recovery', async () => {
    const load = jest.fn().mockResolvedValue({ kind: 'ready', entries: [entry] });
    const catalog = { load };
    await renderCatalog(catalog, false, false);
    expect(load).not.toHaveBeenCalled();
    await renderCatalog(catalog);
    expect(load).toHaveBeenCalledTimes(1);
    await renderCatalog(catalog, false, true, false);
    expect(load).toHaveBeenCalledTimes(1);
    load.mockRejectedValueOnce(new Error('offline'));
    const stale = elements(await renderCatalog(catalog));
    expect(stale.some(node => node.props.children === entry.title)).toBe(true);
    expect(stale.some(node => node.props.children === 'dapps.catalog.stale')).toBe(true);
    stale.find(node => node.props.label === 'dapps.catalog.retry')?.props.onPress?.();
    const fresh = elements(await renderCatalog(catalog));
    expect(fresh.some(node => node.props.children === 'dapps.catalog.stale')).toBe(false);
    expect(load).toHaveBeenCalledTimes(3);
  });
  it('drops an old catalog completion after leaving and starts a new activation read', async () => {
    let resolve!: (value: { kind: 'ready'; entries: readonly DappCatalogEntry[] }) => void;
    const load = jest
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise(done => {
            resolve = done;
          }),
      )
      .mockResolvedValue({ kind: 'ready', entries: [] });
    const catalog = { load };
    await renderCatalog(catalog);
    await renderCatalog(catalog, false, false);
    resolve({ kind: 'ready', entries: [entry] });
    await settle();
    const resumed = elements(await renderCatalog(catalog));
    expect(resumed.some(node => node.props.children === entry.title)).toBe(false);
    expect(load).toHaveBeenCalledTimes(2);
  });
  it('clears a website proposal on leaving and blocks its queued confirmation callback', async () => {
    const catalog = { load: async () => ({ kind: 'unavailable' as const }) };
    const initial = elements(await renderCatalog(catalog));
    openUrlSheetFrom(initial);
    elements(await renderCatalog(catalog))
      .find(node => node.props.accessibilityLabel === 'dapps.website.input')
      ?.props.onChangeText?.('https://example.org');
    elements(await renderCatalog(catalog))
      .find(node => node.props.label === 'dapps.website.preview')
      ?.props.onPress?.();
    const confirm = elements(await renderCatalog(catalog)).find(node => node.props.label === 'dapps.website.confirm');
    expect(confirm).toBeDefined();
    await renderCatalog(catalog, false, false);
    confirm?.props.onPress?.();
    expect(openExternalUrl).not.toHaveBeenCalled();
    const resumed = elements(await renderCatalog(catalog));
    expect(resumed.some(node => node.props.label === 'dapps.website.confirm')).toBe(false);
    confirm?.props.onPress?.();
    expect(openExternalUrl).not.toHaveBeenCalled();
  });
  it('does not retain a different catalog provider snapshot after replacement fails', async () => {
    await renderCatalog({ load: async () => ({ kind: 'ready', entries: [entry] }) });
    const replacement = { load: jest.fn().mockRejectedValue(new Error('new provider failed')) };
    const nodes = elements(await renderCatalog(replacement));
    expect(nodes.some(node => node.props.children === entry.title)).toBe(false);
    expect(nodes.some(node => node.props.title === 'dapps.catalog.error')).toBe(true);
  });
  it('ignores a browser handoff completion after the screen leaves', async () => {
    let opened!: () => void;
    openExternalUrl.mockImplementationOnce(
      () =>
        new Promise<void>(resolve => {
          opened = resolve;
        }),
    );
    const catalog = { load: async () => ({ kind: 'unavailable' as const }) };
    const nodes = elements(await renderCatalog(catalog));
    openUrlSheetFrom(nodes);
    elements(await renderCatalog(catalog))
      .find(node => node.props.accessibilityLabel === 'dapps.website.input')
      ?.props.onChangeText?.('https://example.org');
    elements(await renderCatalog(catalog))
      .find(node => node.props.label === 'dapps.website.preview')
      ?.props.onPress?.();
    elements(await renderCatalog(catalog))
      .find(node => node.props.label === 'dapps.website.confirm')
      ?.props.onPress?.();
    expect(openExternalUrl).toHaveBeenCalledTimes(1);
    await renderCatalog(catalog, false, false);
    opened();
    await settle();
    elements(await renderCatalog(catalog))
      .filter(node => node.props.accessibilityState?.selected !== undefined)[1]
      ?.props.onPress?.();
    const recent = elements(await renderCatalog(catalog));
    expect(recent.some(node => node.props.label === 'https://example.org')).toBe(false);
  });
  it('records a confirmed OS browser handoff across backgrounding while the same route stays focused', async () => {
    let opened!: () => void;
    openExternalUrl.mockImplementationOnce(
      () =>
        new Promise<void>(resolve => {
          opened = resolve;
        }),
    );
    const catalog = { load: async () => ({ kind: 'unavailable' as const }) };
    openUrlSheetFrom(elements(await renderCatalog(catalog)));
    elements(await renderCatalog(catalog))
      .find(node => node.props.accessibilityLabel === 'dapps.website.input')
      ?.props.onChangeText?.('https://example.org');
    elements(await renderCatalog(catalog))
      .find(node => node.props.label === 'dapps.website.preview')
      ?.props.onPress?.();
    elements(await renderCatalog(catalog))
      .find(node => node.props.label === 'dapps.website.confirm')
      ?.props.onPress?.();
    await renderCatalog(catalog, false, false, true, true);
    opened();
    await settle();
    elements(await renderCatalog(catalog))
      .filter(node => node.props.accessibilityState?.selected !== undefined)[1]
      ?.props.onPress?.();
    expect(elements(await renderCatalog(catalog)).some(node => node.props.label === 'https://example.org')).toBe(true);
  });
});
