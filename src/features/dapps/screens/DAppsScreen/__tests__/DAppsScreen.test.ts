import React from 'react';

import type { DappCatalogEntry, DappCatalogPort } from '@capabilities/dapp-catalog/catalog';

jest.mock('@fresnica/ui-native', () => {
  const ReactActual = jest.requireActual<typeof import('react')>('react');
  return {
    StateView: ({ title }: { title: string }) => ReactActual.createElement('StateView', { title }),
    Field: (props: Record<string, unknown>) => ReactActual.createElement('Field', props),
    Button: (props: Record<string, unknown>) => ReactActual.createElement('Button', props),
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

const { DAppsScreen } = require('../DAppsScreen') as typeof import('../DAppsScreen');
const openExternalUrl = jest.fn(async (_url: string) => {});

const entry: DappCatalogEntry = {
  id: 'demo',
  title: 'Demo Exchange',
  description: 'A public catalog row',
  category: 'Exchange',
  websiteUrl: 'https://example.invalid',
};

function resetHarness() {
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
  autoCapitalize?: string;
  autoCorrect?: boolean;
  secureTextEntry?: boolean;
  onPress?: () => void;
  onChangeText?: (value: string) => void;
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

describe('DAppsScreen native field and retry', () => {
  afterAll(() => {
    jest.restoreAllMocks();
  });

  beforeEach(() => {
    resetHarness();
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

describe('S15 untrusted URL risk confirmation and in-session Recent', () => {
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

  it('never opens user URL on typing or preview, and Cancel discards the proposed origin', async () => {
    const initial = elements(await renderCatalog(catalog));
    const input = initial.find(
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
    first
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
    const input = initial.find(
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
    initial
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

  it('opens only after explicit approval and records the origin in session-only Recent', async () => {
    const initial = elements(await renderCatalog(catalog));
    initial
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
    initial
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
    nodes
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
