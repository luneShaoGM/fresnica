import React from 'react';
import { FlatList, Pressable, type FlatListProps } from 'react-native';
import type { DappCatalogEntry, DappCatalogLoadResult, DappCatalogPort } from '@capabilities/dapp-catalog/catalog';
import type { DappPublicMediaPort } from '@capabilities/dapp-catalog/dappPublicMedia';

jest.mock('@fresnica/ui-native', () => ({ Button: () => null }));
jest.mock('../../../../locale', () => ({ useLocalization: () => ({ t: (key: string) => key }) }));
jest.mock('@ui/theme', () => {
  const actual = jest.requireActual<typeof import('@ui/theme')>('@ui/theme');
  return {
    ...actual,
    useThemedStyles: (factory: (theme: typeof actual.defaultTheme) => unknown) => factory(actual.defaultTheme),
  };
});

type Effect = { deps: readonly unknown[]; run: () => void | (() => void); cleanup?: () => void; pending: boolean };
type Bucket = { states: unknown[]; refs: Array<{ current: unknown }>; effects: Effect[] };
const buckets = new Map<string, Bucket>();
let bucket: Bucket;
let si = 0,
  ri = 0,
  ei = 0;
const react = jest.requireActual<typeof import('react')>('react');
jest.spyOn(react, 'useState').mockImplementation(((initial: unknown) => {
  const slot = si++;
  const current = bucket;
  if (!(slot in current.states))
    current.states[slot] = typeof initial === 'function' ? (initial as () => unknown)() : initial;
  return [
    current.states[slot],
    (next: unknown) => {
      current.states[slot] =
        typeof next === 'function' ? (next as (value: unknown) => unknown)(current.states[slot]) : next;
    },
  ];
}) as typeof react.useState);
jest.spyOn(react, 'useRef').mockImplementation(((initial: unknown) => {
  const index = ri++;
  return bucket.refs[index] ?? (bucket.refs[index] = { current: initial });
}) as typeof react.useRef);
jest.spyOn(react, 'useMemo').mockImplementation(((factory: () => unknown) => factory()) as typeof react.useMemo);
jest
  .spyOn(react, 'useSyncExternalStore')
  .mockImplementation(((_subscribe: unknown, get: () => unknown) => get()) as typeof react.useSyncExternalStore);
jest.spyOn(react, 'useEffect').mockImplementation(((run: Effect['run'], deps: readonly unknown[] = []) => {
  const index = ei++;
  const previous = bucket.effects[index];
  const changed =
    !previous || deps.length !== previous.deps.length || deps.some((dep, i) => !Object.is(dep, previous.deps[i]));
  if (changed) previous?.cleanup?.();
  bucket.effects[index] = { deps, run, pending: changed, cleanup: changed ? undefined : previous?.cleanup };
}) as typeof react.useEffect);
const { ActionsFeatured } = require('../ActionsFeatured') as typeof import('../ActionsFeatured');
function renderWith<T>(key: string, run: () => T): T {
  bucket = buckets.get(key) ?? { states: [], refs: [], effects: [] };
  buckets.set(key, bucket);
  si = 0;
  ri = 0;
  ei = 0;
  return run();
}
async function flush() {
  for (const value of buckets.values())
    for (const effect of value.effects)
      if (effect.pending) {
        effect.pending = false;
        const cleanup = effect.run();
        if (cleanup) effect.cleanup = cleanup;
      }
  for (let i = 0; i < 12; i++) await Promise.resolve();
}
function find(
  node: React.ReactNode,
  predicate: (element: React.ReactElement<Record<string, unknown>>) => boolean,
): React.ReactElement<Record<string, unknown>> | undefined {
  if (!React.isValidElement<Record<string, unknown>>(node)) return;
  if (predicate(node)) return node;
  for (const child of React.Children.toArray(node.props.children as React.ReactNode)) {
    const value = find(child, predicate);
    if (value) return value;
  }
}
const entry: DappCatalogEntry = {
  id: 'featured',
  title: 'Featured',
  description: 'Public metadata',
  category: 'Tools',
  websiteUrl: 'https://featured.example.org/app',
};
const ready = (entries: readonly DappCatalogEntry[], stale = false): DappCatalogLoadResult => ({
  kind: 'ready',
  entries: [],
  featured: entries,
  stale,
});
function setup(catalog: DappCatalogPort) {
  const onOpen = jest.fn(() => true);
  const render = (active = true, online = true, owner = catalog, inVerticalViewport = true) =>
    renderWith('section', () => ActionsFeatured({ catalog: owner, active, online, inVerticalViewport, onOpen }));
  return { render, onOpen };
}
function items(tree: React.ReactNode): readonly DappCatalogEntry[] {
  return (find(tree, node => node.type === FlatList)?.props.data ?? []) as readonly DappCatalogEntry[];
}
function rowElement(tree: React.ReactNode) {
  const list = find(tree, node => node.type === FlatList)!;
  return (list.props.renderItem as (input: { item: DappCatalogEntry }) => React.ReactElement<Record<string, unknown>>)({
    item: items(tree)[0],
  });
}
function reportVisible(tree: React.ReactNode, indices: readonly number[]) {
  const list = find(tree, node => node.type === FlatList)!;
  const onChange = list.props.onViewableItemsChanged as FlatListProps<DappCatalogEntry>['onViewableItemsChanged'];
  onChange?.({
    viewableItems: indices.map(index => ({
      item: items(tree)[index],
      index,
      key: items(tree)[index].id,
      isViewable: true,
    })),
    changed: [],
  });
}
function pressRow(tree: React.ReactNode) {
  return rowElement(tree).props.onPress as () => void;
}
function text(tree: React.ReactNode, key: string) {
  return !!find(tree, node => node.props.children === key);
}
beforeEach(() => buckets.clear());
afterAll(() => jest.restoreAllMocks());

describe('Actions featured lifecycle', () => {
  it('renders cache synchronously, refreshes once, and retires old item callbacks on replacement', async () => {
    let resolve!: (value: DappCatalogLoadResult) => void;
    const catalog: DappCatalogPort = {
      readCached: () => ready([entry], true),
      load: jest.fn(
        () =>
          new Promise(done => {
            resolve = done;
          }),
      ),
    };
    const { render, onOpen } = setup(catalog);
    const initial = render();
    const late = pressRow(initial);
    expect(items(initial)).toEqual([entry]);
    expect(catalog.load).not.toHaveBeenCalled();
    await flush();
    expect(catalog.load).toHaveBeenCalledTimes(1);
    const fresh = { ...entry, id: 'fresh', title: 'Fresh' };
    resolve(ready([fresh]));
    await flush();
    const refreshed = render();
    expect(items(refreshed)).toEqual([fresh]);
    late();
    expect(onOpen).not.toHaveBeenCalled();
    const open = pressRow(refreshed);
    open();
    open();
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it('does not fetch if closed before its queued refresh starts, and a rejected handoff remains retryable', async () => {
    const catalog: DappCatalogPort = {
      readCached: () => ready([entry], true),
      load: jest.fn(async () => ready([entry])),
    };
    const { render, onOpen } = setup(catalog);
    render();
    render(false);
    await flush();
    expect(catalog.load).not.toHaveBeenCalled();
    const opened = render(true);
    await flush();
    onOpen.mockReturnValueOnce(false);
    const open = pressRow(opened);
    open();
    open();
    expect(onOpen).toHaveBeenCalledTimes(2);
  });

  it('keeps cached entries on failure and recovers on explicit retry', async () => {
    const load = jest.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(ready([]));
    const { render } = setup({ readCached: () => ready([entry], true), load });
    render();
    await flush();
    let tree = render();
    expect(items(tree)).toEqual([entry]);
    expect(text(tree, 'dapps.catalog.stale')).toBe(true);
    (find(tree, node => node.props.label === 'dapps.catalog.retry')?.props.onPress as () => void)();
    render();
    await flush();
    tree = render();
    expect(items(tree)).toEqual([]);
    expect(text(tree, 'actions.suggestions')).toBe(false);
  });

  it('ignores close-time results and callbacks, then refreshes on reopening', async () => {
    let resolve!: (value: DappCatalogLoadResult) => void;
    const load = jest.fn(
      () =>
        new Promise<DappCatalogLoadResult>(done => {
          resolve = done;
        }),
    );
    const { render, onOpen } = setup({ readCached: () => ready([entry], true), load });
    const late = pressRow(render());
    await flush();
    render(false);
    await flush();
    resolve(ready([{ ...entry, id: 'late' }]));
    await flush();
    expect(items(render(false))).toEqual([entry]);
    late();
    expect(onOpen).not.toHaveBeenCalled();
    render(true);
    await flush();
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('never displays an old network snapshot or accepts its late response/callback', async () => {
    let resolve!: (value: DappCatalogLoadResult) => void;
    const old: DappCatalogPort = {
      readCached: () => ready([entry], true),
      load: () =>
        new Promise(done => {
          resolve = done;
        }),
    };
    const nextEntry = { ...entry, id: 'main', websiteUrl: 'https://main.example.org/' };
    const next: DappCatalogPort = { readCached: () => ready([nextEntry], true), load: async () => ready([nextEntry]) };
    const { render, onOpen } = setup(old);
    const late = pressRow(render());
    await flush();
    expect(items(render(true, true, next))).toEqual([nextEntry]);
    await flush();
    resolve(ready([entry]));
    await flush();
    expect(items(render(true, true, next))).toEqual([nextEntry]);
    late();
    expect(onOpen).not.toHaveBeenCalled();
  });

  it('hides only confirmed empty suggestions, preserving loading and retry failures', async () => {
    const load = jest.fn().mockResolvedValueOnce(ready([])).mockRejectedValueOnce(new Error('offline'));
    const { render } = setup({ load });
    expect(text(render(), 'actions.suggestions')).toBe(true);
    await flush();
    expect(text(render(), 'actions.suggestions')).toBe(false);
    render(false);
    render(true);
    await flush();
    const failed = render();
    expect(text(failed, 'actions.suggestions')).toBe(true);
    expect(text(failed, 'dapps.catalog.stale')).toBe(true);
    expect(find(failed, node => node.props.label === 'dapps.catalog.retry')).toBeDefined();
  });

  it('shows legacy/all-only data as empty and cached suggestions offline without fetching', async () => {
    const load = jest.fn(async () => ({ kind: 'ready' as const, entries: [entry] }));
    const { render } = setup({ readCached: () => ({ kind: 'ready', entries: [entry] }), load });
    expect(items(render())).toEqual([]);
    await flush();
    expect(text(render(), 'actions.suggestions')).toBe(false);
    const offline: DappCatalogPort = { readCached: () => ready([entry], true), load: jest.fn() };
    expect(items(render(true, false, offline))).toEqual([entry]);
    await flush();
    expect(offline.load).not.toHaveBeenCalled();
  });

  it('cancels retained horizontal cards when their row leaves the outer vertical viewport', async () => {
    const loadIcon = jest.fn((_entry: DappCatalogEntry, _signal: AbortSignal) => new Promise<undefined>(() => {}));
    const media = {
      available: true,
      getIconState: () => ({ enabled: true, revision: 0 }),
      subscribeIcons: () => () => {},
      readIcon: () => undefined,
      loadIcon,
    } as unknown as DappPublicMediaPort;
    const catalog: DappCatalogPort = {
      readCached: () => ready([entry]),
      load: async () => ready([entry]),
      publicMedia: media,
    };
    const { render } = setup(catalog);
    reportVisible(render(true, true, catalog, false), [0]);
    const renderRow = (inVerticalViewport: boolean) => {
      const row = rowElement(render(true, true, catalog, inVerticalViewport));
      return renderWith('retained-row', () =>
        (row.type as (props: Record<string, unknown>) => React.ReactElement)(row.props),
      );
    };
    renderRow(false);
    await flush();
    expect(loadIcon).not.toHaveBeenCalled(); // Short viewport: row below Recent has never appeared.
    renderRow(true);
    await flush();
    expect(loadIcon).toHaveBeenCalledTimes(1);
    const first = loadIcon.mock.calls[0][1];
    renderRow(false);
    await flush();
    expect(first.aborted).toBe(true);
    expect(loadIcon).toHaveBeenCalledTimes(1);
    renderRow(true);
    await flush();
    expect(loadIcon).toHaveBeenCalledTimes(2);
    reportVisible(render(true, true, catalog, true), []);
    renderRow(true);
    await flush();
    expect(loadIcon.mock.calls[1][1].aborted).toBe(true); // Vertical visibility cannot bypass horizontal gating.
  });

  it('does not request icons for retained offscreen rows and aborts when a mounted row scrolls out', async () => {
    const loadIcon = jest.fn((_entry: DappCatalogEntry, _signal: AbortSignal) => new Promise<undefined>(() => {}));
    const media = {
      available: true,
      getIconState: () => ({ enabled: true, revision: 0 }),
      subscribeIcons: () => () => {},
      readIcon: () => undefined,
      loadIcon,
    } as unknown as DappPublicMediaPort;
    const other = { ...entry, id: 'other' };
    const catalog: DappCatalogPort = {
      readCached: () => ready([entry, other]),
      load: async () => ready([entry, other]),
      publicMedia: media,
    };
    const { render } = setup(catalog);
    const ViewabilityHelper = jest.requireActual<{
      default: new (config: unknown) => { onUpdate: (...args: unknown[]) => void; dispose: () => void };
    }>('@react-native/virtualized-lists/Lists/ViewabilityHelper').default;
    const nativeViewability = new ViewabilityHelper(
      find(render(), node => node.type === FlatList)!.props.viewabilityConfig,
    );
    const reportScroll = (offset: number) => {
      const tree = render();
      const data = items(tree);
      nativeViewability.onUpdate(
        { data, getItemCount: (rows: readonly DappCatalogEntry[]) => rows.length },
        offset,
        140,
        { getCellMetrics: (index: number) => ({ offset: index * 148, length: 140 }) },
        (index: number, isViewable: boolean) => ({ item: data[index], index, key: data[index].id, isViewable }),
        find(tree, node => node.type === FlatList)!.props.onViewableItemsChanged,
      );
    };
    const renderRetainedRow = () => {
      const row = rowElement(render());
      return renderWith('retained-row', () =>
        (row.type as (props: Record<string, unknown>) => React.ReactElement)(row.props),
      );
    };
    renderRetainedRow();
    await flush();
    expect(loadIcon).not.toHaveBeenCalled(); // Mounted before the first native visibility report.
    reportScroll(148);
    renderRetainedRow();
    await flush();
    expect(loadIcon).not.toHaveBeenCalled(); // First row stays mounted, but only the second is visible.
    reportScroll(0);
    renderRetainedRow();
    await flush();
    expect(loadIcon).toHaveBeenCalledTimes(1);
    const signal = loadIcon.mock.calls[0][1];
    expect(signal.aborted).toBe(false);
    reportScroll(148);
    renderRetainedRow();
    await flush();
    expect(signal.aborted).toBe(true);
    expect(loadIcon).toHaveBeenCalledTimes(1);
    reportScroll(0);
    renderRetainedRow();
    await flush();
    expect(loadIcon).toHaveBeenCalledTimes(2); // A fresh request is allowed when it becomes visible again.
    nativeViewability.dispose();
  });

  it('requires a fresh visibility report when the recommendation order changes', async () => {
    let resolve!: (value: DappCatalogLoadResult) => void;
    const other = { ...entry, id: 'other' };
    const catalog: DappCatalogPort = {
      readCached: () => ready([entry, other]),
      load: () =>
        new Promise(done => {
          resolve = done;
        }),
    };
    const { render } = setup(catalog);
    const initial = render();
    await flush();
    reportVisible(initial, [0]);
    const old = render();
    expect(rowElement(old).props.visible).toBe(true);
    await flush();
    resolve(ready([other, entry]));
    await flush();
    const reordered = render();
    expect(find(reordered, node => node.type === FlatList)?.key).not.toBe(
      find(old, node => node.type === FlatList)?.key,
    );
    expect(rowElement(reordered).props.visible).toBe(false);
    reportVisible(old, [0]);
    expect(rowElement(render()).props.visible).toBe(false);
    reportVisible(reordered, [0]);
    expect(rowElement(render()).props.visible).toBe(true);
  });

  it("does not reuse another provider's visibility or accept its retired list callback", () => {
    const catalog: DappCatalogPort = { readCached: () => ready([entry]), load: async () => ready([entry]) };
    const next: DappCatalogPort = { ...catalog };
    const { render } = setup(catalog);
    const first = render();
    reportVisible(first, [0]);
    expect(rowElement(render()).props.visible).toBe(true);
    const switched = render(true, true, next);
    expect(find(switched, node => node.type === FlatList)?.key).not.toBe(
      find(first, node => node.type === FlatList)?.key,
    );
    expect(rowElement(switched).props.visible).toBe(false);
    reportVisible(first, [0]);
    expect(rowElement(render(true, true, next)).props.visible).toBe(false);
    reportVisible(switched, [0]);
    expect(rowElement(render(true, true, next)).props.visible).toBe(true);
  });

  it('loads visible row icons only after opt-in and aborts when hidden', async () => {
    let enabled = false;
    const loadIcon = jest.fn(async () => undefined);
    const media = {
      available: true,
      getIconState: () => ({ enabled, revision: 0 }),
      subscribeIcons: () => () => {},
      readIcon: () => undefined,
      loadIcon,
    } as unknown as DappPublicMediaPort;
    const catalog: DappCatalogPort = {
      readCached: () => ready([entry]),
      load: async () => ready([entry]),
      publicMedia: media,
    };
    const { render } = setup(catalog);
    reportVisible(render(), [0]);
    const row = rowElement(render());
    const renderRow = (active: boolean, online = true) =>
      renderWith('row', () =>
        (row.type as (props: Record<string, unknown>) => React.ReactElement)({ ...row.props, active, online }),
      );
    renderRow(true);
    await flush();
    expect(loadIcon).not.toHaveBeenCalled();
    enabled = true;
    renderRow(true);
    await flush();
    expect(loadIcon).toHaveBeenCalledTimes(1);
    const signal = (loadIcon.mock.calls[0] as unknown as [DappCatalogEntry, AbortSignal])[1];
    renderRow(true, false);
    await flush();
    expect(signal.aborted).toBe(true);
    renderRow(true);
    await flush();
    expect(loadIcon).toHaveBeenCalledTimes(2);
    const second = (loadIcon.mock.calls[1] as unknown as [DappCatalogEntry, AbortSignal])[1];
    enabled = false;
    renderRow(true);
    await flush();
    expect(second.aborted).toBe(true);
    expect(loadIcon).toHaveBeenCalledTimes(2);
    enabled = true;
    renderRow(true);
    await flush();
    const third = (loadIcon.mock.calls[2] as unknown as [DappCatalogEntry, AbortSignal])[1];
    renderRow(false);
    await flush();
    expect(third.aborted).toBe(true);
    expect(find(renderRow(false), node => node.type === Pressable)?.props.disabled).toBe(true);
  });
});
