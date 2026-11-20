jest.mock('@fresnica/ui-native', () => ({ Button: () => null }));
import React from 'react';
import { createDappRecentHistory } from '@capabilities/dapp-interaction/dappRecentHistory';
import { Pressable, ScrollView } from 'react-native';
import type { DappCatalogPort, DappCatalogEntry } from '@capabilities/dapp-catalog/catalog';
import { ActionsScrollView } from '../ActionsScrollView';
import type { MainTabBarProps } from '../MainTabBar';

const mockEffects: Array<() => void> = [];
let mockRecentSessionRef: { current: unknown } = { current: undefined };
let mockActiveOverlayId: string | undefined;
jest.mock('react', () => {
  const actual = jest.requireActual('react') as typeof import('react');
  return {
    ...actual,
    useCallback: (callback: unknown) => callback,
    useState: (initial: unknown) => [typeof initial === 'function' ? (initial as () => unknown)() : initial, jest.fn()],
    useContext: () => undefined,
    useRef: () => mockRecentSessionRef,
    useSyncExternalStore: (_subscribe: unknown, getSnapshot: () => unknown) => getSnapshot(),
    useEffect: (effect: () => void) => {
      mockEffects.push(effect);
    },
  };
});

jest.mock('@react-navigation/native', () => ({ getFocusedRouteNameFromRoute: () => undefined }));
jest.mock('../../OverlayHost', () => ({
  useOverlay: () => ({
    activeOverlayId: mockActiveOverlayId,
    present: mockPresentOverlay,
    dismiss: mockDismissOverlay,
  }),
}));
jest.mock('../../../locale', () => ({
  useLocalization: () => ({ t: (key: string) => key }),
}));
jest.mock('../../../ui/theme', () => {
  const actual = jest.requireActual('../../../ui/theme') as typeof import('../../../ui/theme');
  return {
    ...actual,
    useThemedStyles: (factory: (theme: typeof actual.defaultTheme) => unknown) => factory(actual.defaultTheme),
  };
});

const mockPresentOverlay = jest.fn();
const mockDismissOverlay = jest.fn();
const { MainTabBar } = require('../MainTabBar') as typeof import('../MainTabBar');
type Props = Readonly<{
  children?: React.ReactNode;
  accessibilityLabel?: string;
  disabled?: boolean;
  label?: string;
  onPress?: () => void;
}>;

function findPressable(node: React.ReactNode, label: string): React.ReactElement<Props> | undefined {
  if (!React.isValidElement<Props>(node)) return undefined;
  if (node.type === Pressable && node.props.accessibilityLabel === label) return node;
  for (const child of React.Children.toArray(node.props.children)) {
    const found = findPressable(child, label);
    if (found) return found;
  }
  return undefined;
}

function renderSwap(
  enabled: boolean,
  syncMode?: MainTabBarProps['syncMode'],
  node: Partial<
    Pick<
      MainTabBarProps,
      'nodePhase' | 'nodeFailure' | 'onRetryNode' | 'selectedAccountId' | 'recentHistory' | 'catalog'
    >
  > = {},
  actionState?: MainTabBarProps['actionState'],
  open = true,
) {
  const navigate = jest.fn();
  const props = {
    state: {
      index: 0,
      routes: [
        { key: 'home', name: 'home' },
        { key: 'activity', name: 'activity' },
        { key: 'dapps', name: 'dapps' },
        { key: 'settings', name: 'settings' },
      ],
    },
    descriptors: {
      home: { options: {} },
      activity: { options: {} },
      dapps: { options: {} },
      settings: { options: {} },
    },
    navigation: { navigate, emit: jest.fn(() => ({ defaultPrevented: false })) },
    selectedAccountId: 'wallet-1',
    syncMode,
    ...node,
    actionAvailability: { send: enabled, swap: enabled, request: true },
    actionState,
  } as unknown as MainTabBarProps;
  const root = MainTabBar(props);
  const actionButton = findPressable(root, 'nav.actions');
  expect(actionButton?.props.onPress).toBeDefined();
  if (open) actionButton?.props.onPress?.();
  const overlay = mockPresentOverlay.mock.calls.at(-1)?.[1] as React.ReactNode;
  return { navigate, overlay, root };
}

describe('Swap action uses the current account route', () => {
  it('closes before an untrusted featured handoff and retires section work when the retained overlay hides', () => {
    const catalog: DappCatalogPort = { load: async () => ({ kind: 'ready', entries: [] }) };
    const entry: DappCatalogEntry = {
      id: 'demo',
      title: 'Demo',
      category: 'Tools',
      description: 'Public',
      websiteUrl: 'https://demo.example.org/testnet',
    };
    const { overlay, navigate } = renderSwap(true, undefined, { catalog });
    function findSection(
      node: React.ReactNode,
    ):
      | React.ReactElement<{ catalog: DappCatalogPort; onOpen: (value: DappCatalogEntry) => void; foreground: boolean }>
      | undefined {
      if (!React.isValidElement<{ children?: React.ReactNode; catalog?: DappCatalogPort }>(node)) return;
      if (node.props.catalog === catalog) return node as ReturnType<typeof findSection>;
      for (const child of React.Children.toArray(node.props.children)) {
        const found = findSection(child);
        if (found) return found;
      }
    }
    const section = findSection(overlay)!;
    const renderVisibility = () =>
      (
        section.type as (
          props: typeof section.props,
        ) => React.ReactElement<{
          active: boolean;
          inVerticalViewport: boolean;
          onLayout: unknown;
          onCardsLayout: unknown;
        }>
      )(section.props);
    mockActiveOverlayId = 'actions';
    expect(renderVisibility().props.active).toBe(true);
    expect(renderVisibility().props.inVerticalViewport).toBe(false);
    expect(typeof renderVisibility().props.onLayout).toBe('function');
    expect(typeof renderVisibility().props.onCardsLayout).toBe('function');
    section.props.onOpen(entry);
    expect(navigate).toHaveBeenCalledWith('dapps', { screen: 'dapps', params: { scannedUrl: entry.websiteUrl } });
    expect(mockDismissOverlay.mock.invocationCallOrder[0]).toBeLessThan(navigate.mock.invocationCallOrder[0]);
    mockActiveOverlayId = undefined;
    expect(renderVisibility().props.active).toBe(false);
    navigate.mockClear();
    renderSwap(true, undefined, { catalog, selectedAccountId: 'different-account' }, undefined, false);
    section.props.onOpen(entry);
    expect(navigate).not.toHaveBeenCalled();
  });

  it('shows only the latest four shared origins and dismisses into untrusted website review', () => {
    const history = createDappRecentHistory({ read: () => [], replace: () => {} }, 'testnet');
    for (let i = 0; i < 6; i++) history.record(`https://app${i}.example.org/path?token=private`);
    const { navigate, overlay } = renderSwap(true, undefined, { recentHistory: history });
    expect(findPressable(overlay, 'https://app5.example.org')).toBeDefined();
    expect(findPressable(overlay, 'https://app2.example.org')).toBeDefined();
    expect(findPressable(overlay, 'https://app1.example.org')).toBeUndefined();
    findPressable(overlay, 'https://app5.example.org')?.props.onPress?.();
    expect(mockDismissOverlay.mock.invocationCallOrder[0]).toBeLessThan(navigate.mock.invocationCallOrder[0]);
    expect(navigate).toHaveBeenCalledWith('dapps', {
      screen: 'dapps',
      params: { scannedUrl: 'https://app5.example.org' },
    });
    expect(JSON.stringify(overlay)).not.toContain('private');
  });

  it('reopens a hydrated React Native pathless-query visit without restoring query data', () => {
    const originalURL = global.URL;
    global.URL = jest.requireActual<{ URL: typeof URL }>('react-native/Libraries/Blob/URL').URL;
    try {
      let saved: readonly string[] = [];
      const repository = {
        read: () => saved,
        replace: (_network: string, origins: readonly string[]) => {
          saved = origins;
        },
      };
      const first = createDappRecentHistory(repository, 'testnet');
      first.record('https://example.org?session=private');
      first.close();
      const restored = createDappRecentHistory(repository, 'testnet');
      const { navigate, overlay } = renderSwap(true, undefined, { recentHistory: restored });
      expect(JSON.stringify(overlay)).not.toContain('private');
      findPressable(overlay, 'https://example.org')?.props.onPress?.();
      expect(navigate).toHaveBeenCalledWith('dapps', {
        screen: 'dapps',
        params: { scannedUrl: 'https://example.org' },
      });
    } finally {
      global.URL = originalURL;
    }
  });

  it('refreshes an open Actions panel after a visit and retires old network callbacks', () => {
    const repository = { read: () => [], replace: () => {} };
    const first = createDappRecentHistory(repository, 'testnet');
    first.record('https://test.example.org');
    const old = renderSwap(true, undefined, { recentHistory: first });
    const late = findPressable(old.overlay, 'https://test.example.org')?.props.onPress;
    first.record('https://latest.example.org');
    mockActiveOverlayId = 'actions';
    renderSwap(true, undefined, { recentHistory: first }, undefined, false);
    mockEffects.at(-1)?.();
    expect(findPressable(mockPresentOverlay.mock.lastCall?.[1], 'https://latest.example.org')).toBeDefined();
    const second = createDappRecentHistory(repository, 'mainnet');
    renderSwap(true, undefined, { recentHistory: second }, undefined, false);
    late?.();
    expect(old.navigate).not.toHaveBeenCalled();
  });

  beforeEach(() => {
    mockPresentOverlay.mockClear();
    mockDismissOverlay.mockClear();
    mockEffects.length = 0;
    mockRecentSessionRef = { current: undefined };
    mockActiveOverlayId = undefined;
  });

  it('opens the general QR scanner even when the wallet cannot send or swap', () => {
    const { navigate, overlay } = renderSwap(false, undefined, {}, 'inactive');
    const scan = findPressable(overlay, 'actions.scan');
    expect(scan?.props.disabled).toBeUndefined();
    scan?.props.onPress?.();
    expect(mockDismissOverlay).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith('home', {
      screen: 'request',
      params: { accountId: 'wallet-1', initialScan: true },
    });
  });

  it('routes eligible Swap to the current account Swap flow only', () => {
    const { navigate, overlay } = renderSwap(true);
    const button = findPressable(overlay, 'nav.swap');
    expect(button?.props.disabled).toBe(false);
    button?.props.onPress?.();
    expect(mockDismissOverlay).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith('home', {
      screen: 'swap',
      params: { accountId: 'wallet-1' },
    });
  });

  it('keeps swap unavailable for ineligible accounts without dispatching navigation', () => {
    const { navigate, overlay } = renderSwap(false);
    const button = findPressable(overlay, 'nav.swap');
    expect(button?.props.disabled).toBe(true);
    button?.props.onPress?.();
    expect(navigate).not.toHaveBeenCalled();
  });

  it('updates an open Actions sheet when a fresh inactive result arrives', () => {
    renderSwap(true);
    mockActiveOverlayId = 'actions';
    mockPresentOverlay.mockClear();
    renderSwap(false, undefined, {}, 'inactive', false);
    mockEffects.at(-1)?.();
    const overlay = mockPresentOverlay.mock.calls.at(-1)?.[1] as React.ReactNode;
    expect(findPressable(overlay, 'nav.send')?.props.disabled).toBe(true);
    expect(findPressable(overlay, 'nav.swap')?.props.disabled).toBe(true);
    expect(textValues(overlay)).toContain('nav.accountInactive');
  });

  it('uses the scrollable sheet and closes explicitly without dispatching an action', () => {
    const { overlay, navigate } = renderSwap(true);
    expect(React.isValidElement(overlay) && overlay.type).toBe(ActionsScrollView);
    const measuredScroll = ActionsScrollView({ children: null });
    expect(measuredScroll.type).toBe(ScrollView);
    expect(measuredScroll.props.scrollEventThrottle).toBe(16);
    expect(mockPresentOverlay.mock.lastCall?.[2]).toEqual({
      presentation: 'sheet',
      statusBarContent: 'light',
      closeLabel: 'nav.actionsClose',
      dragDismissLabel: 'nav.actionsDragClose',
    });
    expect(textValues(overlay)).toContain('nav.quickActions');
    findPressable(overlay, 'nav.actionsClose')?.props.onPress?.();
    expect(mockDismissOverlay).toHaveBeenCalledTimes(1);
    expect(navigate).not.toHaveBeenCalled();
  });

  it('replaces the open sheet callbacks after an account change', () => {
    renderSwap(true);
    mockActiveOverlayId = 'actions';
    const { navigate } = renderSwap(true, undefined, { selectedAccountId: 'wallet-2' }, undefined, false);
    mockEffects.at(-1)?.();
    const overlay = mockPresentOverlay.mock.lastCall?.[1] as React.ReactNode;
    findPressable(overlay, 'nav.send')?.props.onPress?.();
    expect(navigate).toHaveBeenCalledWith('home', { screen: 'send-form', params: { accountId: 'wallet-2' } });
  });

  it('closes an open sheet when the selected account disappears', () => {
    renderSwap(true);
    mockActiveOverlayId = 'actions';
    mockPresentOverlay.mockClear();
    renderSwap(true, undefined, { selectedAccountId: undefined }, undefined, false);
    mockEffects.at(-1)?.();
    expect(mockDismissOverlay).toHaveBeenCalled();
    expect(mockPresentOverlay).not.toHaveBeenCalled();
  });
});

function textValues(node: React.ReactNode): string[] {
  if (typeof node === 'string') return [node];
  if (!React.isValidElement<Props>(node)) return [];
  return React.Children.toArray(node.props.children).flatMap(textValues);
}
it.each(['paused', 'connecting', 'live', 'polling'] as const)(
  'keeps ordinary synchronization silent (%s)',
  syncMode => {
    mockPresentOverlay.mockClear();
    const { root } = renderSwap(true, syncMode);
    expect(textValues(root)).not.toContain('account.sync.polling');
  },
);

function findLabel(node: React.ReactNode, label: string): React.ReactElement<Props> | undefined {
  if (!React.isValidElement<Props>(node)) return undefined;
  if (node.props.label === label) return node;
  for (const child of React.Children.toArray(node.props.children)) {
    const found = findLabel(child, label);
    if (found) return found;
  }
  return undefined;
}
it.each([
  ['cooldown', 'rate-limited', 'node.read.rateLimited'],
  ['cooldown', 'unavailable', 'node.read.unavailable'],
  ['wrong-network', 'wrong-network', 'node.read.wrongNetwork'],
] as const)(
  'shows honest node state instead of a stream polling notice (%s / %s)',
  (nodePhase, nodeFailure, message) => {
    mockPresentOverlay.mockClear();
    const retry = jest.fn();
    const { root } = renderSwap(true, 'polling', { nodePhase, nodeFailure, onRetryNode: retry });
    expect(textValues(root)).toContain(message);
    expect(textValues(root)).not.toContain('account.sync.polling');
    const button = findLabel(root, 'node.read.retry');
    button?.props.onPress?.();
    expect(retry).toHaveBeenCalledTimes(1);
  },
);

it('keeps the empty-network bar visible but blocks Actions even if an availability flag is stale', () => {
  mockPresentOverlay.mockClear();
  const { root, navigate } = renderSwap(true, undefined, { selectedAccountId: undefined });
  for (const label of ['nav.home', 'nav.activity', 'nav.dapps', 'nav.settings']) {
    expect(findPressable(root, label)).toBeDefined();
  }
  const actions = findPressable(root, 'nav.actions');
  expect(actions?.props.disabled).toBe(true);
  actions?.props.onPress?.();
  expect(mockPresentOverlay).not.toHaveBeenCalled();
  expect(navigate).not.toHaveBeenCalled();
});

it('does not insert a notice during ordinary node checks', () => {
  const { root } = renderSwap(true, 'polling', { nodePhase: 'checking' });
  expect(textValues(root)).not.toContain('node.read.checking');
  expect(textValues(root)).not.toContain('account.sync.polling');
});
