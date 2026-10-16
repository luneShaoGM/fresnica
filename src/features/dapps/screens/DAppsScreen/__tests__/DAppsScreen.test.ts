import React from 'react';

import type {DappCatalogEntry, DappCatalogPort} from '@capabilities/dapp-catalog/catalog';

jest.mock('@fresnica/ui-native', () => {
  const ReactActual = jest.requireActual<typeof import('react')>('react');
  return {
    StateView: ({title}: {title: string}) => ReactActual.createElement('StateView', {title}),
    Field: (props: Record<string, unknown>) => ReactActual.createElement('Field', props),
    Button: (props: Record<string, unknown>) => ReactActual.createElement('Button', props),
    Screen: ({children}: {children?: React.ReactNode}) => ReactActual.createElement(ReactActual.Fragment, null, children),
  };
});

jest.mock('@ui/components', () => ({
  Screen: ({children}: {children?: React.ReactNode}) => children ?? null,
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

type StateSlot = {current: unknown};
type EffectSlot = {
  effect: () => void | (() => void);
  deps: readonly unknown[];
  cleanup?: () => void;
  pending: boolean;
};

const stateSlots: StateSlot[] = [];
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
  };
}) as typeof react.useEffect);

jest.spyOn(react, 'useMemo').mockImplementation(((factory: () => unknown) => factory()) as typeof react.useMemo);

const {DAppsScreen} = require('../DAppsScreen') as typeof import('../DAppsScreen');

const entry: DappCatalogEntry = {
  id: 'demo',
  title: 'Demo Exchange',
  description: 'A public catalog row',
  category: 'Exchange',
  websiteUrl: 'https://example.invalid',
};

function resetHarness() {
  stateSlots.length = 0;
  effectSlots.length = 0;
}

function beginRender() {
  stateCursor = 0;
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

async function renderCatalog(catalog: DappCatalogPort, showInterfaceSample = false) {
  const props = {catalog, showInterfaceSample};
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
  accessibilityState?: {selected?: boolean};
  autoCapitalize?: string;
  autoCorrect?: boolean;
  secureTextEntry?: boolean;
  onPress?: () => void;
  onChangeText?: (value: string) => void;
  disabled?: boolean;
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
    const catalog: DappCatalogPort = {load: jest.fn().mockResolvedValue({kind: 'unavailable'})};
    const tree = await renderCatalog(catalog);
    const nodes = elements(tree);

    expect(nodes.some(node => node.props.title === 'dapps.catalog.unavailable')).toBe(true);
    expect(nodes.some(node => node.type === 'Field')).toBe(false);
    expect(nodes.some(node => node.type === 'Button')).toBe(false);
  });

  it('shows a labeled layout sample under the unconfigured catalog', async () => {
    const catalog: DappCatalogPort = {load: jest.fn().mockResolvedValue({kind: 'unavailable'})};
    const tree = await renderCatalog(catalog, true);
    const nodes = elements(tree);
    const field = nodes.find(node => node.type === 'Field');
    const button = nodes.find(node => node.type === 'Button');

    expect(nodes.some(node => node.props.title === 'dapps.catalog.unavailable')).toBe(true);
    expect(nodes.some(node => node.props.children === 'dapps.catalog.previewNotice')).toBe(true);
    expect(nodes.some(node => node.props.children === 'dapps.catalog.sample.directory.title')).toBe(true);
    expect(field?.props.secureTextEntry).toBeUndefined();
    expect(button?.props.label).toBe('dapps.catalog.previewClear');

    field?.props.onChangeText?.('missing-sample');
    beginRender();
    const filtered = elements(DAppsScreen({catalog, showInterfaceSample: true}));
    expect(filtered.some(node => node.props.title === 'dapps.catalog.noMatch')).toBe(true);
    expect(filtered.some(node => node.props.children === 'dapps.catalog.sample.directory.title')).toBe(false);

    filtered.find(node => node.type === 'Button')?.props.onPress?.();
    beginRender();
    const cleared = elements(DAppsScreen({catalog, showInterfaceSample: true}));
    expect(cleared.find(node => node.type === 'Field')?.props.value).toBe('');
    expect(cleared.some(node => node.props.children === 'dapps.catalog.sample.tools.title')).toBe(true);
  });

  it('keeps search as a public text field and reports no match', async () => {
    const catalog: DappCatalogPort = {load: jest.fn().mockResolvedValue({kind: 'ready', entries: [entry]})};
    const tree = await renderCatalog(catalog);
    const field = elements(tree).find(node => node.type === 'Field');

    expect(field?.props.accessibilityLabel).toBe('dapps.catalog.search');
    expect(field?.props.autoCapitalize).toBe('none');
    expect(field?.props.autoCorrect).toBe(false);
    expect(field?.props.secureTextEntry).toBeUndefined();

    field?.props.onChangeText?.('missing-catalog-row');
    beginRender();
    const searched = DAppsScreen({catalog});
    const searchedNodes = elements(searched);
    const searchedField = searchedNodes.find(node => node.type === 'Field');

    expect(searchedField?.props.value).toBe('missing-catalog-row');
    expect(searchedNodes.some(node => node.props.title === 'dapps.catalog.noMatch')).toBe(true);
  });

  it('retries a failed catalog load from the native button', async () => {
    const load = jest.fn().mockRejectedValue(new Error('catalog-down'));
    const catalog = {load};
    const tree = await renderCatalog(catalog);
    const button = elements(tree).find(node => node.type === 'Button');

    expect(elements(tree).some(node => node.props.title === 'dapps.catalog.error')).toBe(true);
    expect(button?.props.label).toBe('dapps.catalog.retry');
    expect(button?.props.disabled).toBeUndefined();

    load.mockResolvedValueOnce({kind: 'unavailable'});
    button?.props.onPress?.();
    const retried = await renderCatalog(catalog);

    expect(load).toHaveBeenCalledTimes(2);
    expect(elements(retried).some(node => node.props.title === 'dapps.catalog.unavailable')).toBe(true);
  });

  it('leaves the catalog search behind when Recent is selected', async () => {
    const catalog: DappCatalogPort = {load: jest.fn().mockResolvedValue({kind: 'ready', entries: [entry]})};
    const tree = await renderCatalog(catalog);
    const recent = elements(tree).filter(node => node.props.accessibilityRole === 'button')[1];

    recent?.props.onPress?.();
    beginRender();
    const recentTree = DAppsScreen({catalog});
    const nodes = elements(recentTree);

    expect(nodes.some(node => node.props.title === 'dapps.catalog.recentUnavailable')).toBe(true);
    expect(nodes.some(node => node.type === 'Field')).toBe(false);
  });
});
